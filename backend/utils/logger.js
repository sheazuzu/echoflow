/**
 * 集中化日志模块（Winston）
 *
 * 功能：
 * - JSON 结构化日志输出
 * - 同时输出到控制台 (Docker logs) 和文件 (/app/logs/backend.log)
 * - 支持 info / warn / error / debug 等级
 * - 自动注入 timestamp / level / service 字段
 * - 兼容历史调用方式 logger(stage, message)（保持原有行为不变）
 *
 * 文件落盘路径优先取自环境变量 LOG_DIR，
 * 默认在容器内为 /app/logs；本地开发时若该目录不可写，
 * 会自动回退到 backend/logs 目录，避免影响应用运行。
 */

const fs = require('fs');
const path = require('path');
const winston = require('winston');

const SERVICE_NAME = 'echoflow-backend';

/**
 * 解析日志目录，确保目录存在且可写
 */
function resolveLogDir() {
    const candidates = [];
    if (process.env.LOG_DIR) {
        candidates.push(process.env.LOG_DIR);
    }
    // 容器内默认路径
    candidates.push('/app/logs');
    // 本地开发回退路径：backend/logs
    candidates.push(path.resolve(__dirname, '..', 'logs'));

    for (const dir of candidates) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // 写入测试，确保目录可写
            fs.accessSync(dir, fs.constants.W_OK);
            return dir;
        } catch (err) {
            // 尝试下一个候选目录
        }
    }
    // 兜底：返回最后一个候选（即便不可写，winston 会自行报错而不影响主流程）
    return candidates[candidates.length - 1];
}

const LOG_DIR = resolveLogDir();
const LOG_FILE = path.join(LOG_DIR, 'backend.log');

/**
 * JSON 输出格式
 *  - timestamp 使用 ISO 字符串
 *  - 默认字段顺序：timestamp / level / service / event / ...meta
 */
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
        const { timestamp, level, message, service, ...rest } = info;
        const payload = {
            timestamp,
            level,
            service: service || SERVICE_NAME,
        };
        // message 在新接口中作为 event 字段；为兼容旧调用，仍保留 message
        if (message !== undefined && message !== null && message !== '') {
            payload.event = message;
        }
        // 合并附加上下文字段
        for (const key of Object.keys(rest)) {
            if (key === 'splat' || key === Symbol.for('splat')) continue;
            payload[key] = rest[key];
        }
        return JSON.stringify(payload);
    })
);

/**
 * 控制台输出：依然使用 JSON 格式，方便 Docker logs 与 CLS 一致
 * 如需更易读的开发环境输出，可通过 LOG_PRETTY=1 切换为彩色格式
 */
const consoleFormat = process.env.LOG_PRETTY === '1'
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info) => {
            const { timestamp, level, message, ...rest } = info;
            const meta = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
            return `[${timestamp}] [${level}] ${message}${meta}`;
        })
    )
    : jsonFormat;

const winstonLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: SERVICE_NAME },
    format: jsonFormat,
    transports: [
        new winston.transports.Console({ format: consoleFormat }),
        new winston.transports.File({
            filename: LOG_FILE,
            format: jsonFormat,
            maxsize: 50 * 1024 * 1024, // 单文件 50MB
            maxFiles: 10,               // 最多保留 10 个滚动文件
            tailable: true,
        }),
    ],
    exitOnError: false,
});

/**
 * 兼容历史 API：logger(stage, message)
 * - 历史代码大量使用 logger('XXX_EVENT', '人类可读消息')，记录为 info 级别
 * - 通过给函数对象挂方法的方式，同时支持 logger.info / warn / error / debug
 */
function legacyLogger(stage, message) {
    // 保持旧行为：将 stage 视为 event，message 视为附加描述
    if (message === undefined) {
        winstonLogger.info(stage);
        return;
    }
    winstonLogger.info(stage, { detail: message });
}

/**
 * 新 API: logger.info / warn / error / debug
 * 用法：logger.info('EVENT_NAME', { key: 'value' })
 *
 * 兼容写法：
 * - logger.error('EVENT', 'plain message')      → message 字段
 * - logger.error('EVENT', errorObject)          → 自动展开 message / stack
 */
function makeLevelFn(level) {
    return function (event, meta) {
        if (meta instanceof Error) {
            winstonLogger.log(level, event, {
                error: meta.message,
                stack: meta.stack,
                code: meta.code,
            });
            return;
        }
        if (meta === undefined || meta === null) {
            winstonLogger.log(level, event);
            return;
        }
        if (typeof meta === 'object') {
            winstonLogger.log(level, event, meta);
            return;
        }
        // 字符串等基本类型
        winstonLogger.log(level, event, { detail: meta });
    };
}

legacyLogger.info = makeLevelFn('info');
legacyLogger.warn = makeLevelFn('warn');
legacyLogger.error = makeLevelFn('error');
legacyLogger.debug = makeLevelFn('debug');

// 暴露底层 winston 实例以便测试或扩展
legacyLogger.winston = winstonLogger;
legacyLogger.logFile = LOG_FILE;
legacyLogger.logDir = LOG_DIR;

module.exports = legacyLogger;
