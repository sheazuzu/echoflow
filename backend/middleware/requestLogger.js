/**
 * HTTP 请求日志中间件
 *
 * - 记录每个请求的 method / url / ip / user-agent
 * - 记录响应状态码以及处理耗时（毫秒）
 * - 输出统一事件 HTTP_REQUEST，便于 CLS 聚合分析
 * - 对高频轮询接口（/api/progress/）进行降噪，避免日志刷屏
 */

const logger = require('../utils/logger');

/**
 * 跳过日志的高频接口前缀，可按需扩展
 */
const SILENT_PATH_PREFIXES = ['/api/progress/'];

function shouldSkip(req) {
    return SILENT_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix));
}

function getClientIp(req) {
    // 优先取代理头部，兼容 Traefik / Nginx 转发
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return String(forwarded).split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
}

function requestLogger(req, res, next) {
    if (shouldSkip(req)) {
        return next();
    }

    const startNs = process.hrtime.bigint();
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // 请求到达日志
    logger.info('REQUEST_RECEIVED', {
        method: req.method,
        path: req.originalUrl || req.url,
        ip,
        user_agent: userAgent,
    });

    // 响应完成时记录综合 HTTP 日志
    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
        const payload = {
            event_type: 'access',
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            duration_ms: Math.round(durationMs * 100) / 100,
            ip,
            user_agent: userAgent,
        };

        if (res.statusCode >= 500) {
            logger.error('HTTP_REQUEST', payload);
        } else if (res.statusCode >= 400) {
            logger.warn('HTTP_REQUEST', payload);
        } else {
            logger.info('HTTP_REQUEST', payload);
        }
    });

    next();
}

module.exports = requestLogger;
