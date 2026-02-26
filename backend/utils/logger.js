/**
 * 日志工具模块
 * 提供统一的日志输出格式
 */

const logger = (stage, message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${stage}] ${message}`);
};

module.exports = logger;
