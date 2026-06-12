/**
 * EchoFlow 后端服务入口
 * 负责加载配置、启动服务器、初始化邮件服务和状态清理
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { app, setEmailTransporter } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const emailService = require('./emailService');
const cosService = require('./services/cosService');
const processManager = require('./utils/processManager');
const { initializeAdminActivityStore } = require('./utils/adminActivityStore');

// 全局错误处理器，防止进程崩溃
process.on('uncaughtException', (error) => {
    logger.error('UNCAUGHT_EXCEPTION', {
        error: error && error.message,
        code: error && error.code,
        stack: error && error.stack,
    });

    // 记录错误但不退出进程
    if (error && error.code === 'EPIPE') {
        logger.warn('NETWORK_ERROR', {
            reason: 'EPIPE',
            message: '网络连接错误(EPIPE)，继续运行服务',
        });
    } else {
        logger.warn('UNCAUGHT_ERROR_HANDLED', {
            message: '其他未捕获错误，继续运行服务',
        });
    }
});

process.on('unhandledRejection', (reason, promise) => {
    const isError = reason instanceof Error;
    logger.error('UNHANDLED_REJECTION', {
        reason: isError ? reason.message : String(reason),
        stack: isError ? reason.stack : undefined,
    });
    logger.warn('REJECTION_HANDLED', {
        message: 'Promise拒绝已处理，继续运行服务',
    });
});

// 启动日志
logger.info('APPLICATION_STARTED', {
    node_version: process.version,
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
    port: config.PORT,
});

// 初始化邮件传输器并注入到路由
const emailTransporter = emailService.createTransporter();
setEmailTransporter(emailTransporter);

// 启动状态定时清理
processManager.startCleanupTimer();
initializeAdminActivityStore();

// 启动 HTTP 服务器
app.listen(config.PORT, async () => {
    logger.info('SERVER_LISTENING', {
        message: 'EchoFlow 后端服务已启动',
        url: `http://localhost:${config.PORT}`,
        port: config.PORT,
    });

    // 测试SMTP服务器连通性
    logger.info('SMTP_CHECK_START', { message: '正在测试SMTP服务器连通性...' });
    const smtpTestResult = await emailService.testSMTPConnection(emailTransporter);

    if (smtpTestResult.success) {
        logger.info('SMTP_CHECK_OK', { message: smtpTestResult.message });
    } else {
        logger.error('SMTP_CHECK_FAILED', {
            message: smtpTestResult.message,
            hint: '邮件发送功能将不可用，请检查.env文件中的SMTP配置',
        });
    }

    // 测试COS连接连通性
    logger.info('COS_CHECK_START', { message: '正在测试COS连接连通性...' });
    const cosTestResult = await cosService.checkCOSConnection();

    if (cosTestResult.success) {
        logger.info('COS_CHECK_OK', { message: cosTestResult.message });
    } else {
        logger.error('COS_CHECK_FAILED', {
            message: cosTestResult.message,
            hint: 'COS上传功能将不可用，将回退到本地文件存储模式',
        });
    }
});