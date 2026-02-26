/**
 * 请求日志中间件
 * 记录每个请求的方法、路径和来源信息
 */

const logger = require('../utils/logger');

/**
 * Express 请求日志中间件
 */
function requestLogger(req, res, next) {
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    logger('REQUEST', `${req.method} ${req.path} from ${origin}`);
    next();
}

module.exports = requestLogger;
