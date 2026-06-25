/**
 * Bilibili 直连下载服务
 *
 * 背景：yt-dlp 的 BiliBili extractor 在 2026 年与 B 站 anti-bot 系统对抗中频繁出现 HTTP 412，
 * 即使提供了 buvid3 / b_nut cookies、UA、Referer 等也无法稳定通过 playurl 接口。
 *
 * 但 B 站官方的 web API（api.bilibili.com/x/web-interface/view 与 /x/player/playurl）
 * 在带上常规浏览器 UA + Referer 后是可以稳定 200 响应的（curl/Node 实测）。
 *
 * 因此本模块绕过 yt-dlp，直接调用 B 站 API：
 *   1. /x/web-interface/view?bvid=BVxxx     -> 元数据（title、duration、owner、cid、pic）
 *   2. /x/player/playurl?bvid=&cid=&fnval=16 -> dash.audio[].baseUrl（m4a/AAC 流）
 *   3. Node https GET baseUrl（必须带 Referer），流式写入本地 .m4a 文件
 *
 * 仅供 platform=bilibili 的 URL 使用。YouTube 仍然走 videoDownloadService 中的 yt-dlp 实现。
 *
 * 安全：
 *   - 所有外部输入仅经过白名单字段提取（bvid/cid 用正则校验），不拼 shell
 *   - 下载请求严格设定超时和最大字节上限
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const config = require('../config');
const logger = require('../utils/logger');

const DEFAULT_BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const API_TIMEOUT_MS = 30000; // B 站 API 调用超时（30s）
const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;

function getApiTimeoutMs(timeoutMs) {
    const parsed = Number(timeoutMs || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return API_TIMEOUT_MS;
    }
    return Math.min(parsed, API_TIMEOUT_MS);
}

/**
 * 与 videoDownloadService 中的 ERROR_CODES 保持一致的错误构造，便于路由层统一处理。
 */
function buildError(code, detail = '') {
    const errMap = {
        not_a_video_url: { en: 'The URL does not appear to be a Bilibili video link.', zh: '链接看起来不是有效的 Bilibili 视频地址。' },
        video_unavailable: { en: 'Video is unavailable or has been removed.', zh: '视频不可用或已被删除。' },
        geo_restricted: { en: 'This video is not available in your region.', zh: '该视频在当前地区不可访问。' },
        private_video: { en: 'This video is private and requires login.', zh: '该视频为私密视频，需要登录后才能访问。' },
        network_error: { en: 'Network error while accessing Bilibili API.', zh: '访问 Bilibili 接口时网络异常，请稍后重试。' },
        timeout: { en: 'Bilibili request timed out, please try a shorter video or try again later.', zh: 'Bilibili 请求超时，请尝试较短的视频或稍后重试。' },
        unknown: { en: 'Failed to download the Bilibili video.', zh: 'Bilibili 视频下载失败，请稍后重试。' },
    };
    const info = errMap[code] || errMap.unknown;
    const err = new Error(info.zh);
    err.code = code;
    err.userMessage = info;
    err.stderr = String(detail || '');
    return err;
}

/**
 * 从 URL 中提取 BVid。支持 https://www.bilibili.com/video/BVxxxxxxxxxx/ 等常见格式，
 * 以及 b23.tv 短链（需先 follow redirect 由 videoUrlParser 展开后传进来）。
 *
 * @param {string} videoUrl
 * @returns {string} bvid，未匹配则抛错
 */
function extractBvid(videoUrl) {
    if (typeof videoUrl !== 'string' || !videoUrl.trim()) {
        throw buildError('not_a_video_url');
    }
    // 直接匹配 URL 中的 BV 号
    const m = videoUrl.match(/BV[0-9A-Za-z]{10}/);
    if (!m || !BVID_PATTERN.test(m[0])) {
        throw buildError('not_a_video_url', `无法从 URL 中识别 BVid: ${videoUrl}`);
    }
    return m[0];
}

/**
 * 通用：发起一个带浏览器伪装头的 GET 请求，返回字符串 body。
 *
 * @param {string} requestUrl
 * @param {object} [opts]
 * @returns {Promise<{ statusCode: number, body: string, headers: object }>}
 */
function httpGetText(requestUrl, opts = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(requestUrl);
        const req = https.request({
            method: 'GET',
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            headers: {
                'User-Agent': DEFAULT_BROWSER_UA,
                'Referer': opts.referer || 'https://www.bilibili.com',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Origin': 'https://www.bilibili.com',
                ...(opts.extraHeaders || {}),
            },
            timeout: opts.timeoutMs || API_TIMEOUT_MS,
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                resolve({ statusCode: res.statusCode || 0, body, headers: res.headers });
            });
            res.on('error', (err) => reject(err));
        });
        req.on('timeout', () => {
            req.destroy(new Error('request timeout'));
        });
        req.on('error', (err) => reject(err));
        req.end();
    });
}

/**
 * 通过 B 站 API 获取视频元数据。
 *
 * @param {string} videoUrl - 已规范化后的 BiliBili 视频 URL
 * @param {object} [opts]
 * @returns {Promise<object>} { title, duration, uploader, uploadDate, thumbnail, videoId, platform, webpageUrl, ext, cid }
 */
async function fetchVideoMetadata(videoUrl, opts = {}) {
    const bvid = extractBvid(videoUrl);
    logger('BILI_DIRECT_META_START', `BiliBili 直连获取元数据: bvid=${bvid}`);

    let resp;
    try {
        resp = await httpGetText(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
            timeoutMs: getApiTimeoutMs(opts.timeoutMs),
        });
    } catch (err) {
        logger('BILI_DIRECT_META_ERROR', `调用 view API 失败: ${err.message}`);
        throw buildError(err.message === 'request timeout' ? 'timeout' : 'network_error', err.message);
    }

    if (resp.statusCode !== 200) {
        logger('BILI_DIRECT_META_HTTP', `view API HTTP=${resp.statusCode}`);
        throw buildError('network_error', `view API returned HTTP ${resp.statusCode}`);
    }

    let json;
    try {
        json = JSON.parse(resp.body);
    } catch (_e) {
        throw buildError('unknown', `view API 返回非 JSON: ${resp.body.slice(0, 200)}`);
    }

    if (json.code !== 0) {
        // B 站常见错误码：
        //   -404 视频不存在；62002 稿件不可见；-403 私密；62004 审核中
        logger('BILI_DIRECT_META_BIZERR', `view API 业务错误 code=${json.code} msg=${json.message}`);
        if (json.code === -404 || json.code === 62002 || json.code === 62004) {
            throw buildError('video_unavailable', json.message || '');
        }
        if (json.code === -403) {
            throw buildError('private_video', json.message || '');
        }
        throw buildError('unknown', `view code=${json.code} msg=${json.message}`);
    }

    const data = json.data || {};
    const metadata = {
        title: String(data.title || '').trim() || 'Untitled',
        duration: Number(data.duration || 0),
        uploader: String(data.owner?.name || '').trim(),
        uploadDate: data.pubdate ? formatDate(data.pubdate * 1000) : '',
        // B 站封面默认是 http://，强制改成 https 避免前端混合内容警告
        thumbnail: String(data.pic || '').replace(/^http:/, 'https:'),
        videoId: bvid,
        platform: 'bilibili',
        extractor: 'bilibili-direct',
        webpageUrl: videoUrl,
        ext: 'm4a',
        // 内部使用：后续 playurl 接口需要 cid
        cid: Number(data.cid || 0),
    };

    if (!metadata.cid) {
        throw buildError('unknown', '视频元数据缺失 cid 字段');
    }

    logger('BILI_DIRECT_META_OK', `元数据获取成功 title="${metadata.title.slice(0, 80)}" duration=${metadata.duration}s cid=${metadata.cid}`);
    return metadata;
}

function formatDate(tsMs) {
    try {
        const d = new Date(tsMs);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    } catch (_e) {
        return '';
    }
}

/**
 * 获取最低音质 m4a 流的 baseUrl。
 *
 * @param {string} bvid
 * @param {number} cid
 * @returns {Promise<{ baseUrl: string, bandwidth: number, codec: string }>}
 */
async function fetchAudioStreamUrl(bvid, cid, opts = {}) {
    // fnval=16 = 启用 DASH 模式（返回分离的 audio/video 流）
    // qn=64 = 720P（dash 模式下 qn 实际用于挑选 video 流，audio 流总是返回全部音质）
    const url = `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${cid}&qn=64&fnval=16&fnver=0&fourk=1`;
    logger('BILI_DIRECT_PLAYURL_START', `获取播放地址: bvid=${bvid} cid=${cid}`);

    let resp;
    try {
        resp = await httpGetText(url, { timeoutMs: getApiTimeoutMs(opts.timeoutMs) });
    } catch (err) {
        throw buildError(err.message === 'request timeout' ? 'timeout' : 'network_error', err.message);
    }

    if (resp.statusCode !== 200) {
        throw buildError('network_error', `playurl HTTP ${resp.statusCode}`);
    }

    let json;
    try {
        json = JSON.parse(resp.body);
    } catch (_e) {
        throw buildError('unknown', `playurl 非 JSON: ${resp.body.slice(0, 200)}`);
    }

    if (json.code !== 0) {
        logger('BILI_DIRECT_PLAYURL_BIZERR', `playurl 业务错误 code=${json.code} msg=${json.message}`);
        throw buildError('video_unavailable', `playurl code=${json.code} msg=${json.message}`);
    }

    const audios = json.data?.dash?.audio || [];
    if (!audios.length) {
        throw buildError('unknown', 'playurl 未返回任何音频流，可能是大会员专享视频或视频已下架');
    }

    // 选择带宽最低的音频流即可（语音转录质量足够，且体积最小）
    audios.sort((a, b) => (a.bandwidth || 0) - (b.bandwidth || 0));
    const chosen = audios[0];
    const baseUrl = chosen.baseUrl || chosen.base_url;
    if (!baseUrl) {
        throw buildError('unknown', 'playurl 返回的 audio 缺少 baseUrl');
    }

    logger('BILI_DIRECT_PLAYURL_OK', `选定音频流 bandwidth=${chosen.bandwidth} codec=${chosen.codecs}`);
    return {
        baseUrl,
        bandwidth: Number(chosen.bandwidth || 0),
        codec: String(chosen.codecs || 'mp4a.40.2'),
    };
}

/**
 * 流式下载音频到 outputPathNoExt + '.m4a'。
 *
 * @param {string} videoUrl
 * @param {string} outputPathNoExt - 不带扩展名的输出路径前缀
 * @param {object} [opts]
 * @param {(percent:number)=>void} [opts.onProgress]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ filePath: string, fileSizeBytes: number }>}
 */
async function downloadAudio(videoUrl, outputPathNoExt, opts = {}) {
    if (!outputPathNoExt) {
        throw new Error('outputPathNoExt 不能为空');
    }

    const bvid = extractBvid(videoUrl);

    // 优先复用上游在 submit 阶段已经拿到的 metadata/cid，避免下载阶段再次请求 view API。
    // 之前这里会二次调用 fetchVideoMetadata，并继承 10 分钟下载超时；一旦 B 站接口偶发卡住，
    // 整个任务看起来就像“后台卡死”。
    const upstreamMeta = opts.videoMeta && typeof opts.videoMeta === 'object' ? opts.videoMeta : null;
    let cid = Number(upstreamMeta?.cid || 0);
    if (!cid) {
        const meta = await fetchVideoMetadata(videoUrl, { timeoutMs: getApiTimeoutMs(opts.timeoutMs) });
        cid = Number(meta.cid || 0);
    }
    if (!cid) {
        throw buildError('unknown', '无法获取视频 cid');
    }

    const { baseUrl, bandwidth } = await fetchAudioStreamUrl(bvid, cid, { timeoutMs: getApiTimeoutMs(opts.timeoutMs) });

    const maxBytes = (config.videoUrl?.maxFileSizeMB || 500) * 1024 * 1024;
    const filePath = `${outputPathNoExt}.m4a`;

    // 清理可能残留的同名文件
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_e) { /* ignore */ }

    logger('BILI_DIRECT_DOWNLOAD_START', `开始下载音频流 -> ${filePath} bandwidth=${bandwidth}`);

    await new Promise((resolve, reject) => {
        const u = new URL(baseUrl);
        const req = https.request({
            method: 'GET',
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            headers: {
                'User-Agent': DEFAULT_BROWSER_UA,
                'Referer': 'https://www.bilibili.com',
                'Origin': 'https://www.bilibili.com',
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            timeout: opts.timeoutMs || (config.videoUrl?.ytDlpTimeoutMs || 600000),
        }, (res) => {
            if (res.statusCode !== 200 && res.statusCode !== 206) {
                res.resume();
                return reject(buildError('network_error', `CDN HTTP ${res.statusCode}`));
            }

            const totalBytes = Number(res.headers['content-length'] || 0);
            let receivedBytes = 0;
            let lastReportedPercent = 0;

            const fileStream = fs.createWriteStream(filePath);

            res.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (receivedBytes > maxBytes) {
                    res.destroy();
                    fileStream.destroy();
                    try { fs.unlinkSync(filePath); } catch (_e) { /* ignore */ }
                    return reject(buildError('unknown', `文件大小超过上限 ${config.videoUrl?.maxFileSizeMB}MB`));
                }
                if (totalBytes > 0 && typeof opts.onProgress === 'function') {
                    const percent = Math.min(99, Math.floor((receivedBytes / totalBytes) * 100));
                    if (percent > lastReportedPercent) {
                        lastReportedPercent = percent;
                        try { opts.onProgress(percent); } catch (_e) { /* ignore */ }
                    }
                }
            });

            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(() => {
                    if (typeof opts.onProgress === 'function') {
                        try { opts.onProgress(100); } catch (_e) { /* ignore */ }
                    }
                    resolve();
                });
            });
            fileStream.on('error', (err) => {
                try { fs.unlinkSync(filePath); } catch (_e) { /* ignore */ }
                reject(buildError('unknown', `写文件失败: ${err.message}`));
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error('request timeout'));
        });
        req.on('error', (err) => {
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_e) { /* ignore */ }
            const isTimeout = String(err.message || '').toLowerCase().includes('timeout');
            reject(buildError(isTimeout ? 'timeout' : 'network_error', err.message));
        });
        req.end();
    });

    const stat = fs.statSync(filePath);
    logger('BILI_DIRECT_DOWNLOAD_OK', `下载完成 ${filePath} size=${stat.size}`);
    return {
        filePath,
        fileSizeBytes: stat.size,
    };
}

module.exports = {
    fetchVideoMetadata,
    downloadAudio,
    extractBvid,
    // 测试可用
    _internal: {
        httpGetText,
        fetchAudioStreamUrl,
    },
};
