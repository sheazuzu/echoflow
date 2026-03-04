/**
 * 请求日志中间件
 * 记录每个请求的方法、路径和来源信息
 */

const logger = require('../utils/logger');

/**
 * Express 请求日志中间件
 * 对高频轮询接口（如进度查询）进行日志降频，避免刷屏
 */
function requestLogger(req, res, next) {
    // 跳过进度查询轮询请求的日志（每秒1次，太频繁）
    // 进度变化时会由 progress.js 中的 PROGRESS_QUERY 日志记录
    if (req.path.startsWith('/api/progress/')) {
        return next();
    }
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    logger('REQUEST', `${req.method} ${req.path} from ${origin}`);
    next();
}

module.exports = requestLogger;
