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

// 初始化邮件传输器并注入到路由
const emailTransporter = emailService.createTransporter();
setEmailTransporter(emailTransporter);

// 启动状态定时清理
processManager.startCleanupTimer();

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