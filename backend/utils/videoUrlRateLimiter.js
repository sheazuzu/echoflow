/**
 * 视频 URL 转录任务的限流与去重工具
 *
 * 限流策略：
 *  - 基于内存的滑动窗口，记录每个用户最近 1 小时内的提交时间戳
 *  - 超出 config.videoUrl.maxTasksPerHour 即拒绝
 *
 * 去重策略：
 *  - 同一用户 24 小时内提交相同（规范化后的）URL，若上一次任务已完成则直接返回上次的 fileId
 *  - 实现上查询 auth_activity_logs，匹配 activityType='video_url_task' + metadata.normalizedVideoUrl
 */

const config = require('../config');
const userStore = require('./userStore');
const logger = require('./logger');

const WINDOW_MS = 60 * 60 * 1000; // 1 小时
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 小时

/** @type {Map<string|number, number[]>} */
const submissionMap = new Map();

/**
 * 清理过期时间戳。
 * @param {string|number} userId
 * @returns {number[]} 仍在窗口内的时间戳数组
 */
function pruneAndGet(userId) {
    const now = Date.now();
    const list = submissionMap.get(userId) || [];
    const pruned = list.filter(ts => now - ts < WINDOW_MS);
    submissionMap.set(userId, pruned);
    return pruned;
}

/**
 * 检查用户是否允许新提交。
 * @param {string|number} userId
 * @returns {{ allowed: boolean, current: number, limit: number, retryAfterMs: number }}
 */
function checkRateLimit(userId) {
    const limit = Math.max(1, Number(config.videoUrl?.maxTasksPerHour || 5));
    if (userId === undefined || userId === null || userId === '') {
        return { allowed: true, current: 0, limit, retryAfterMs: 0 };
    }
    const list = pruneAndGet(userId);
    if (list.length < limit) {
        return { allowed: true, current: list.length, limit, retryAfterMs: 0 };
    }
    const oldest = list[0];
    const retryAfterMs = Math.max(0, WINDOW_MS - (Date.now() - oldest));
    return { allowed: false, current: list.length, limit, retryAfterMs };
}

/**
 * 记录一次提交（应在通过限流检查后调用）。
 * @param {string|number} userId
 */
function recordSubmission(userId) {
    if (userId === undefined || userId === null || userId === '') return;
    const list = pruneAndGet(userId);
    list.push(Date.now());
    submissionMap.set(userId, list);
}

/**
 * 释放一次记录（用于提交后处理失败时回滚配额）。
 * @param {string|number} userId
 */
function releaseSubmission(userId) {
    if (userId === undefined || userId === null || userId === '') return;
    const list = submissionMap.get(userId) || [];
    if (list.length > 0) {
        list.pop();
        submissionMap.set(userId, list);
    }
}

/**
 * 在最近 24 小时内查找同一用户已经成功完成的同 URL 任务。
 * @param {string|number} userId
 * @param {string} normalizedUrl - normalizeUrl() 输出的规范化 URL
 * @returns {Promise<null|{fileId:string, createdAt:string, title:string}>}
 */
async function findRecentSuccessfulTask(userId, normalizedUrl) {
    if (!userId || !normalizedUrl) return null;
    try {
        const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
        const dateFrom = since.toISOString().slice(0, 19).replace('T', ' ');

        const result = await userStore.listUserActivities({
            userId,
            filters: {
                activityType: 'video_url_task',
                status: 'success',
                dateFrom,
            },
            page: 1,
            pageSize: 50,
        });

        if (!result || !Array.isArray(result.items)) return null;

        const hit = result.items.find(item => {
            const meta = item.metadata || {};
            return meta.normalizedVideoUrl === normalizedUrl
                || meta.videoUrl === normalizedUrl;
        });

        if (!hit) return null;
        return {
            fileId: hit.fileId || (hit.metadata && hit.metadata.fileId) || null,
            createdAt: hit.createdAt || null,
            title: hit.title || (hit.metadata && hit.metadata.videoTitle) || '',
        };
    } catch (err) {
        logger('VIDEO_URL_DEDUPE_WARN', `去重查询失败，忽略并继续: ${err.message}`);
        return null;
    }
}

/**
 * 仅用于测试：清空所有用户的限流记录。
 */
function _resetForTest() {
    submissionMap.clear();
}

module.exports = {
    checkRateLimit,
    recordSubmission,
    releaseSubmission,
    findRecentSuccessfulTask,
    _resetForTest,
};
