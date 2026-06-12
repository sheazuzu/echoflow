/**
 * 统一错误处理中间件
 * 捕获路由抛出的异常，返回统一格式的错误响应
 */

const logger = require('../utils/logger');

/**
 * Express 错误处理中间件
 * 保持与原代码相同的 HTTP 状态码和响应格式
 */
function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const requestId = req.requestId || 'unknown';

    // 记录详细错误日志（结构化 JSON）
    logger.error('REQUEST_ERROR', {
        request_id: requestId,
        method: req.method,
        path: req.path,
        status: statusCode,
        error: err.message,
        code: err.code,
        stack: err.stack,
    });

    res.status(statusCode).json({
        success: false,
        message: err.message || '服务器内部错误',
        error: err.message,
        errorCode: err.code || undefined,
        requestId: requestId
    });
}

module.exports = errorHandler;
