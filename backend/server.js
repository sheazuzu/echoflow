/**
 * EchoFlow 后端服务入口
 * 负责加载配置、启动服务器、初始化邮件服务和状态清理
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { app, setEmailTransporter } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const emailService = require('./emailService');
const processManager = require('./utils/processManager');
const { initializeAdminActivityStore } = require('./utils/adminActivityStore');

// 全局错误处理器，防止进程崩溃
process.on('uncaughtException', (error) => {
    logger('UNCAUGHT_EXCEPTION', `未捕获的异常: ${error.message}`);
    logger('UNCAUGHT_EXCEPTION', `堆栈: ${error.stack}`);
    
    // 记录错误但不退出进程
    if (error.code === 'EPIPE') {
        logger('NETWORK_ERROR', `网络连接错误(EPIPE)，继续运行服务`);
    } else {
        logger('UNCAUGHT_ERROR', `其他未捕获错误，继续运行服务`);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger('UNHANDLED_REJECTION', `未处理的Promise拒绝: ${reason}`);
    logger('UNHANDLED_REJECTION', `Promise: ${promise}`);
    
    // 记录错误但不退出进程
    logger('REJECTION_HANDLED', `Promise拒绝已处理，继续运行服务`);
});

// 初始化邮件传输器并注入到路由
const emailTransporter = emailService.createTransporter();
setEmailTransporter(emailTransporter);

// 启动状态定时清理
processManager.startCleanupTimer();
initializeAdminActivityStore();

// 启动 HTTP 服务器
app.listen(config.PORT, async () => {
    logger('SYSTEM', `EchoFlow 后端服务已启动: http://localhost:${config.PORT}`);
    
    // 测试SMTP服务器连通性
    logger('SYSTEM', '正在测试SMTP服务器连通性...');
    const smtpTestResult = await emailService.testSMTPConnection(emailTransporter);
    
    if (smtpTestResult.success) {
        logger('SYSTEM', `✓ ${smtpTestResult.message}`);
    } else {
        logger('SMTP_ERROR', `✗ ${smtpTestResult.message}`);
        logger('SMTP_ERROR', '邮件发送功能将不可用，请检查.env文件中的SMTP配置');
    }
});