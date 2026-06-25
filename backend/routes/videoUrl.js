/**
 * 视频链接转录路由（YouTube / Bilibili）
 *
 * 流程：
 *  URL 校验 → 平台识别 → 限流 → 24h 去重 → 获取元数据 → 时长校验 →
 *  立即响应 → 异步：下载音频 → 校验文件大小 → 上传 COS → 复用 processFile
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');
const config = require('../config');
const { getUploadDir } = require('../utils/fileHelper');
const processManager = require('../utils/processManager');
const cosService = require('../services/cosService');
const videoDownloadService = require('../services/videoDownloadService');
const rateLimiter = require('../utils/videoUrlRateLimiter');
const {
    detectPlatform,
    normalizeUrl,
    extractVideoId,
    sanitizeTitle,
    hasPlaylistHint,
} = require('../utils/videoUrlParser');
const { requireAuth, buildAuthenticatedRequester } = require('../middleware/auth');
const { processFile, recordUploadActivity } = require('./upload');

/**
 * 检查功能是否启用；未启用时返回 404，让前端入口与后端语义保持一致。
 */
function ensureFeatureEnabled(req, res, next) {
    if (!config.videoUrl || !config.videoUrl.featureEnabled) {
        return res.status(404).json({
            success: false,
            code: 404,
            message: 'Video URL transcription feature is disabled',
        });
    }
    next();
}

/**
 * 生成标准化 fileId：YYYYMMDD_HHMMSS_<platform>_<videoId>_<cleanTitle>
 */
function buildFileId(platform, videoId, title) {
    const now = new Date();
    const ts = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('') + '_' + [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const safeId = String(videoId || 'unknown').replace(/[^\w\-:]/g, '_').slice(0, 30);
    const safeTitle = sanitizeTitle(title || '', 50);
    return `${ts}_${platform}_${safeId}_${safeTitle}`;
}

/**
 * POST /api/video-url/submit
 * 提交视频链接转录任务
 *
 * 请求体：{ url: string }
 * 响应：{ code: 200, fileId, videoMeta }
 */
router.post('/video-url/submit', ensureFeatureEnabled, requireAuth, express.json(), async (req, res) => {
    const rawUrl = (req.body && req.body.url ? String(req.body.url) : '').trim();
    const requester = buildAuthenticatedRequester(req);
    const ownerUserId = req.auth.user.id;
    const ownerDisplayName = req.auth.user.displayName;

    // 1. URL 合法性与平台识别
    const platform = detectPlatform(rawUrl);
    if (!platform) {
        logger('VIDEO_URL_REJECT', `不支持的平台或非法 URL: ${rawUrl.slice(0, 200)}`);
        return res.status(400).json({
            success: false,
            code: 400,
            errorCode: 'unsupported_platform',
            message: '仅支持 YouTube 和 Bilibili 视频链接',
            messageEn: 'Only YouTube and Bilibili video URLs are supported',
        });
    }

    const normalized = normalizeUrl(rawUrl) || rawUrl;
    const playlistHint = hasPlaylistHint(rawUrl);

    // 2. 限流检查
    const rl = rateLimiter.checkRateLimit(ownerUserId);
    if (!rl.allowed) {
        logger('VIDEO_URL_RATE_LIMITED', `用户 ${ownerUserId} 触发限流 current=${rl.current}/${rl.limit}`);
        res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
        return res.status(429).json({
            success: false,
            code: 429,
            errorCode: 'rate_limited',
            message: `提交过于频繁，请在 ${Math.ceil(rl.retryAfterMs / 60000)} 分钟后再试`,
            messageEn: `Too many submissions, please retry after ${Math.ceil(rl.retryAfterMs / 60000)} minutes`,
            retryAfterMs: rl.retryAfterMs,
        });
    }

    // 3. 24h 去重缓存
    try {
        const cached = await rateLimiter.findRecentSuccessfulTask(ownerUserId, normalized);
        if (cached && cached.fileId) {
            logger('VIDEO_URL_DEDUPE_HIT', `命中 24h 去重缓存: user=${ownerUserId} fileId=${cached.fileId}`);
            return res.json({
                code: 200,
                cached: true,
                fileId: cached.fileId,
                message: '该视频已在 24 小时内成功转录过，直接返回上次结果',
                messageEn: 'This video has been transcribed within last 24 hours, returning cached result',
                videoMeta: {
                    title: cached.title || '',
                    platform,
                    webpageUrl: normalized,
                },
            });
        }
    } catch (err) {
        logger('VIDEO_URL_DEDUPE_WARN', `去重查询失败，继续正常流程: ${err.message}`);
    }

    // 4. 获取视频元数据
    let metadata;
    try {
        metadata = await videoDownloadService.fetchVideoMetadata(normalized);
    } catch (err) {
        const code = err.code || 'unknown';
        const msg = err.userMessage || { zh: err.message, en: err.message };
        logger('VIDEO_URL_META_FAILED', `获取元数据失败 code=${code} url=${normalized}`);
        return res.status(400).json({
            success: false,
            code: 400,
            errorCode: code,
            message: msg.zh,
            messageEn: msg.en,
        });
    }

    // 5. 时长校验
    const maxDuration = Number(config.videoUrl.maxDurationSeconds || 14400);
    if (metadata.duration && metadata.duration > maxDuration) {
        const limitHours = Math.round(maxDuration / 3600);
        logger('VIDEO_URL_DURATION_EXCEEDED', `视频时长超限 ${metadata.duration}s > ${maxDuration}s`);
        return res.status(400).json({
            success: false,
            code: 400,
            errorCode: 'duration_exceeded',
            message: `视频时长超过 ${limitHours} 小时限制，请提交较短的视频`,
            messageEn: `Video duration exceeds the ${limitHours}-hour limit, please submit a shorter video`,
            duration: metadata.duration,
            maxDurationSeconds: maxDuration,
        });
    }

    // 6. 校正平台标识（以 yt-dlp 返回为准）
    const finalPlatform = metadata.platform || platform;
    const videoId = metadata.videoId || extractVideoId(normalized, finalPlatform) || 'unknown';
    const fileId = buildFileId(finalPlatform, videoId, metadata.title);

    const videoMeta = {
        title: metadata.title,
        duration: metadata.duration,
        uploader: metadata.uploader,
        uploadDate: metadata.uploadDate,
        thumbnail: metadata.thumbnail,
        videoId,
        platform: finalPlatform,
        webpageUrl: metadata.webpageUrl || normalized,
        normalizedUrl: normalized,
        ext: metadata.ext || 'm4a',
        // 对 Bilibili 直连下载而言，cid 是拿播放地址必需的内部字段。
        // 在 submit 阶段已经拿到时，直接透传给后续下载步骤，避免再次请求 view API。
        cid: metadata.cid,
    };

    // 7. 记录限流配额
    rateLimiter.recordSubmission(ownerUserId);

    // 8. 立即响应前端，后续处理异步进行
    res.json({
        code: 200,
        cached: false,
        fileId,
        message: '视频链接接收成功，开始处理',
        messageEn: 'Video URL accepted, processing started',
        videoMeta,
        playlistHint,
    });

    // 9. 初始化处理状态
    processManager.setStatus(fileId, {
        status: 'downloading_video',
        progress: 5,
        ownerUserId,
        ownerDisplayName,
        requester,
        meetingTopic: metadata.title || '',
        originalFilename: `${videoId}.${videoMeta.ext}`,
        normalizedFilename: `${videoId}.${videoMeta.ext}`,
        videoMeta,
    });

    // 10. 异步执行下载 + 转录管线
    const adminSource = finalPlatform === 'youtube' ? 'video_url_youtube'
        : finalPlatform === 'bilibili' ? 'video_url_bilibili'
        : 'video_url';

    handleVideoUrlPipeline({
        fileId,
        normalizedUrl: normalized,
        videoMeta,
        ownerUserId,
        ownerDisplayName,
        requester,
        adminSource,
    }).catch((err) => {
        // handleVideoUrlPipeline 内部已捕获并记录，这里只做兜底
        logger('VIDEO_URL_PIPELINE_UNCAUGHT', `异步管线未捕获错误: ${err && err.message}`);
    });
});

/**
 * 异步执行视频下载 + 复用 upload.processFile 的转录管线
 */
async function handleVideoUrlPipeline({
    fileId,
    normalizedUrl,
    videoMeta,
    ownerUserId,
    ownerDisplayName,
    requester,
    adminSource,
}) {
    const uploadDir = getUploadDir();
    const outputPathNoExt = path.join(uploadDir, fileId);
    let downloadedFilePath = null;

    const baseActivityPayload = {
        dedupeKey: `video-url-task:${ownerUserId}:${fileId}`,
        userId: ownerUserId,
        fileId,
        activityType: 'video_url_task',
        meetingTopic: videoMeta.title || '',
        originalFilename: `${videoMeta.videoId}.${videoMeta.ext}`,
        normalizedFilename: `${videoMeta.videoId}.${videoMeta.ext}`,
        requester,
        videoMeta,
    };

    try {
        // 记录"处理中"
        await recordUploadActivity({
            ...baseActivityPayload,
            status: 'processing',
            title: videoMeta.title || fileId,
            summary: '已接收视频链接，正在下载音频。',
            detail: {
                progress: 5,
                stage: 'downloading_video',
                videoUrl: videoMeta.webpageUrl,
                videoPlatform: videoMeta.platform,
            },
        });

        // 步骤 1：下载音频
        logger('VIDEO_URL_DOWNLOAD_START', `开始下载视频音频: fileId=${fileId} url=${normalizedUrl}`);
        const dlResult = await videoDownloadService.downloadAudio(normalizedUrl, outputPathNoExt, {
            timeoutMs: config.videoUrl.ytDlpTimeoutMs,
            videoMeta,
            onProgress: (percent) => {
                // yt-dlp 0~100% 映射到管线 5~30%
                const mapped = Math.max(5, Math.min(30, Math.round(5 + (percent / 100) * 25)));
                processManager.setStatus(fileId, {
                    status: 'downloading_video',
                    progress: mapped,
                    videoDownloadPercent: percent,
                });
            },
        });
        downloadedFilePath = dlResult.filePath;
        const fileSizeMB = dlResult.fileSizeBytes / (1024 * 1024);

        // 步骤 2：文件大小校验
        const maxSizeMB = Number(config.videoUrl.maxFileSizeMB || 500);
        if (fileSizeMB > maxSizeMB) {
            throw Object.assign(new Error(`下载后音频体积 ${fileSizeMB.toFixed(2)}MB 超过 ${maxSizeMB}MB 限制`), {
                code: 'size_exceeded',
            });
        }

        // 步骤 3：上传 COS（复用 upload.js 的命名习惯：fileId 作为 key）
        // 重要：必须保留实际下载文件的扩展名（如 .m4a / .webm / .opus），
        // 否则后续 ffmpeg 切片时无法识别容器格式，会导致 "Conversion failed (code 234)"
        logger('VIDEO_URL_DOWNLOAD_OK', `音频下载完成 ${downloadedFilePath} (${fileSizeMB.toFixed(2)}MB)`);
        processManager.setStatus(fileId, { status: 'uploading_to_cos', progress: 30 });

        const downloadedExt = path.extname(downloadedFilePath) || `.${videoMeta.ext || 'm4a'}`;
        const cosObjectName = `${fileId}${downloadedExt}`;
        const fileBuffer = fs.readFileSync(downloadedFilePath);
        const cosKey = await cosService.uploadToCOS(fileBuffer, cosObjectName);
        processManager.setStatus(fileId, { status: 'uploaded_to_cos', progress: 35 });
        logger('VIDEO_URL_COS_OK', `已上传到 COS: ${cosKey}`);

        // 上传 COS 后立即删除本地音频（节省磁盘）
        try {
            if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
                fs.unlinkSync(downloadedFilePath);
                logger('VIDEO_URL_CLEANUP_LOCAL', `已清理本地下载文件: ${downloadedFilePath}`);
                downloadedFilePath = null;
            }
        } catch (cleanupErr) {
            logger('VIDEO_URL_CLEANUP_WARN', `清理本地文件失败: ${cleanupErr.message}`);
        }

        // 步骤 4：复用 processFile（COS 下载 → 切片 → 转录 → 总结 → 记录历史）
        await processFile(fileId, cosKey, fileSizeMB, {
            ownerUserId,
            ownerDisplayName,
            requester,
            meetingTopic: videoMeta.title || '',
            originalFilename: `${videoMeta.videoId}.${videoMeta.ext}`,
            normalizedFilename: `${videoMeta.videoId}.${videoMeta.ext}`,
            // 以下字段让 upload.js 中的活动记录与管理端来源标识能区分视频任务
            activityType: 'video_url_task',
            dedupeKey: baseActivityPayload.dedupeKey,
            adminSource,
            videoMeta,
        });

    } catch (error) {
        const errCode = error.code || 'unknown';
        logger('VIDEO_URL_PIPELINE_ERROR', `管线失败 fileId=${fileId} code=${errCode}: ${error.message}`);

        processManager.setStatus(fileId, {
            status: 'error',
            progress: 0,
            error: error.message || '视频处理失败',
            errorCode: errCode,
        });

        // 失败时回滚一次限流配额，避免下载失败也占用配额
        try { rateLimiter.releaseSubmission(ownerUserId); } catch (_e) { /* ignore */ }

        try {
            await recordUploadActivity({
                ...baseActivityPayload,
                status: 'failed',
                title: videoMeta.title || fileId,
                summary: error.message || '视频处理失败',
                detail: {
                    progress: 0,
                    stage: 'error',
                    error: error.message || '',
                    errorCode: errCode,
                    videoUrl: videoMeta.webpageUrl,
                    videoPlatform: videoMeta.platform,
                },
            });
        } catch (recordErr) {
            logger('VIDEO_URL_RECORD_WARN', `记录失败活动失败: ${recordErr.message}`);
        }
    } finally {
        // 兜底清理本地音频
        try {
            if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
                fs.unlinkSync(downloadedFilePath);
                logger('VIDEO_URL_FINALLY_CLEANUP', `finally 清理本地下载文件: ${downloadedFilePath}`);
            }
        } catch (cleanupErr) {
            logger('VIDEO_URL_CLEANUP_WARN', `finally 清理失败: ${cleanupErr.message}`);
        }
    }
}

module.exports = router;
module.exports.handleVideoUrlPipeline = handleVideoUrlPipeline;