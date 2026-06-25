/**
 * 会议纪要和转录结果路由
 *
 * 注意：processManager 维护的内存状态会被定时清理（默认 30 分钟），
 * 为避免历史任务的纪要在内存过期后查不到，下面所有读取接口在内存未命中时
 * 都会回退到持久化层（MySQL `auth_activity_logs` + COS transcripts/）兜底，
 * 并把数据回填到 processManager，下一次访问可直接命中内存缓存。
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const logger = require('../utils/logger');
const processManager = require('../utils/processManager');
const cosService = require('../services/cosService');
const userStore = require('../utils/userStore');
const { requireAuth, assertResourceOwner, isAdminUser } = require('../middleware/auth');

/**
 * 从 activity 持久化记录还原一个最小可用的“status”对象，
 * 与 processManager 内存中的结构对齐，方便复用现有路由后续逻辑。
 */
function buildStatusFromActivity(activity) {
    if (!activity) return null;

    const metadata = activity.metadata || {};
    const minutesData = metadata.minutesData || null;
    const transcriptCosKey = metadata.transcriptCosKey || '';
    const cosKey = metadata.cosKey || '';

    return {
        status: activity.status || 'unknown',
        progress: 100,
        minutesData,
        transcript: '', // 文本不在 MySQL 里，需要时再从 COS 拉
        transcriptCosKey,
        cosKey,
        ownerUserId: activity.userId || null,
        ownerDisplayName: activity.userDisplayName || '',
        meetingTopic: metadata.meetingTopic || '',
        originalFilename: metadata.originalFilename || '',
        normalizedFilename: metadata.normalizedFilename || '',
        createdAt: activity.createdAt || null,
        requester: metadata.requester || null,
        _restoredFromActivity: true, // 调试标记
    };
}

/**
 * 解析任务 status：先查内存，未命中则回退到持久化层。
 * 返回一个 { status, source } 元组，source 用于日志区分。
 * admin 用户走“不带 userId 过滤”的查询，可访问任意用户的任务。
 */
async function resolveTaskStatus(req, fileId) {
    const memoryStatus = processManager.getStatus(fileId);
    if (memoryStatus) {
        return { status: memoryStatus, source: 'memory' };
    }

    const userId = req.auth?.user?.id;
    if (!userId) {
        return { status: null, source: 'none' };
    }

    const isAdmin = isAdminUser(req.auth?.user);

    try {
        // admin 不带 userId，可查任意用户的 fileId；普通用户仅查自己的
        const activity = await userStore.findActivityByFileId(
            isAdmin ? { fileId } : { fileId, userId },
        );
        if (!activity) {
            return { status: null, source: 'none' };
        }

        const restored = buildStatusFromActivity(activity);
        if (!restored) {
            return { status: null, source: 'none' };
        }

        // 回填内存缓存，下一次访问可直接命中
        processManager.setStatus(fileId, restored);
        logger('MINUTES_RESTORE', `内存未命中，已从持久化层恢复任务状态: ${fileId}${isAdmin ? ' (admin)' : ''}`);

        return { status: restored, source: isAdmin ? 'persistent_admin' : 'persistent' };
    } catch (error) {
        logger('MINUTES_RESTORE_ERROR', `从持久化层恢复任务状态失败: ${fileId}, 错误: ${error.message}`);
        return { status: null, source: 'error' };
    }
}

/**
 * 按需懒加载 transcript 文本：
 *  - 优先读取 status.transcript（内存里已有）
 *  - 其次根据 transcriptCosKey 判断是 COS 路径（transcripts/ 前缀）还是本地路径
 *  - 一律读到字符串后回填 status.transcript，避免重复 IO
 */
async function ensureTranscriptText(fileId, status) {
    if (status.transcript) {
        return status.transcript;
    }

    const cosKey = status.transcriptCosKey || '';
    if (!cosKey) {
        return '';
    }

    try {
        if (cosKey.startsWith('transcripts/')) {
            const localFilePath = await cosService.downloadFromCOS(cosKey);
            const text = fs.readFileSync(localFilePath, 'utf8');
            try { fs.unlinkSync(localFilePath); } catch (_) { /* ignore */ }
            status.transcript = text;
            processManager.setStatus(fileId, { transcript: text });
            return text;
        }

        if (fs.existsSync(cosKey)) {
            const text = fs.readFileSync(cosKey, 'utf8');
            status.transcript = text;
            processManager.setStatus(fileId, { transcript: text });
            return text;
        }
    } catch (error) {
        logger('TRANSCRIPT_RESTORE_ERROR', `加载 transcript 文本失败: ${fileId}, 错误: ${error.message}`);
    }

    return '';
}

// 获取会议纪要数据接口
router.get('/minutes/:fileId', requireAuth, async (req, res) => {
    const fileId = req.params.fileId;
    logger('MINUTES_QUERY', `收到会议纪要获取请求: ${fileId}`);

    const { status, source } = await resolveTaskStatus(req, fileId);

    if (!status) {
        logger('MINUTES_ERROR', `会议纪要获取失败: 文件处理状态未找到: ${fileId}`);
        return res.status(404).json({ message: "文件处理状态未找到" });
    }

    if (status.status !== 'completed') {
        logger('MINUTES_WARN', `会议纪要获取失败: 文件处理尚未完成: ${fileId}, 当前状态: ${status.status}`);
        return res.status(400).json({ message: "文件处理尚未完成" });
    }

    // admin 可访问任意用户资源，跳过 owner 校验
    if (!isAdminUser(req.auth?.user)) {
        assertResourceOwner(req, status);
    }

    if (!status.minutesData) {
        logger('MINUTES_ERROR', `会议纪要获取失败: 纪要数据未找到: ${fileId}`);
        return res.status(404).json({ message: "会议纪要数据未找到" });
    }

    // 如果是从持久化层恢复的，transcript 文本可能为空，按需懒加载
    let transcriptText = status.transcript || '';
    if (!transcriptText && (source === 'persistent' || source === 'persistent_admin')) {
        transcriptText = await ensureTranscriptText(fileId, status);
    }

    logger('MINUTES_SUCCESS', `会议纪要获取成功: ${fileId} (source=${source})`);
    res.json({
        fileId,
        status: status.status,
        minutesData: status.minutesData,
        transcript: transcriptText,
    });
});

// 获取转录结果接口
router.get('/transcript/:fileId', requireAuth, async (req, res) => {
    const fileId = req.params.fileId;
    logger('TRANSCRIPT_QUERY', `收到转录结果获取请求: ${fileId}`);

    const { status, source } = await resolveTaskStatus(req, fileId);

    if (!status) {
        logger('TRANSCRIPT_ERROR', `转录结果获取失败: 文件处理状态未找到: ${fileId}`);
        return res.status(404).json({ message: "文件处理状态未找到" });
    }

    if (status.status !== 'completed') {
        logger('TRANSCRIPT_WARN', `转录结果获取失败: 文件处理尚未完成: ${fileId}, 当前状态: ${status.status}`);
        return res.status(400).json({ message: "文件处理尚未完成" });
    }

    // admin 可访问任意用户资源，跳过 owner 校验
    if (!isAdminUser(req.auth?.user)) {
        assertResourceOwner(req, status);
    }

    if (!status.transcriptCosKey) {
        logger('TRANSCRIPT_ERROR', `转录结果获取失败: COS键未找到: ${fileId}`);
        return res.status(404).json({ message: "转录结果未找到" });
    }

    try {
        // 如果转录结果存储在COS中，从COS下载
        if (status.transcriptCosKey.startsWith('transcripts/')) {
            const localFilePath = await cosService.downloadFromCOS(status.transcriptCosKey);
            const transcriptText = fs.readFileSync(localFilePath, 'utf8');

            // 清理本地临时文件
            try { fs.unlinkSync(localFilePath); } catch (_) { /* ignore */ }

            // 顺手回填内存
            processManager.setStatus(fileId, { transcript: transcriptText });

            res.json({
                fileId,
                transcript: transcriptText,
                transcriptCosKey: status.transcriptCosKey,
                storage: 'cos',
                source,
            });
        } else {
            // 如果转录结果存储在本地
            res.json({
                fileId,
                transcript: status.transcript,
                transcriptPath: status.transcriptCosKey,
                storage: 'local',
                source,
            });
        }
    } catch (error) {
        logger('TRANSCRIPT_ERROR', `获取转录结果失败: ${fileId}, 错误: ${error.message}`);
        logger('TRANSCRIPT_ERROR', `错误堆栈: ${error.stack}`);
        res.status(500).json({ message: "获取转录结果失败", error: error.message });
    }
});

module.exports = router;