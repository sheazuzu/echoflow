/**
 * 邮件发送路由
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const processManager = require('../utils/processManager');
const emailService = require('../emailService');

// 邮件传输器（在模块级别缓存）
let emailTransporter = null;

/**
 * 初始化邮件传输器
 * 由 app.js 调用注入
 */
function setTransporter(transporter) {
    emailTransporter = transporter;
}

/**
 * 获取邮件传输器
 */
function getTransporter() {
    return emailTransporter;
}

// 邮件发送API端点
router.post('/send-email', async (req, res) => {
    const { fileId, recipients } = req.body;
    
    // 验证参数
    if (!fileId || !recipients) {
        return res.status(400).json({ 
            success: false, 
            message: '缺少必需参数：fileId 或 recipients' 
        });
    }
    
    // 验证recipients是数组且不为空
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '收件人列表必须是非空数组' 
        });
    }
    
    // 验证所有邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
        return res.status(400).json({ 
            success: false, 
            message: `以下邮箱地址格式无效: ${invalidEmails.join(', ')}` 
        });
    }
    
    // 从processingStatus中获取会议纪要数据
    const status = processManager.getStatus(fileId);
    
    if (!status) {
        return res.status(404).json({ 
            success: false, 
            message: '文件处理状态未找到' 
        });
    }
    
    if (status.status !== 'completed') {
        return res.status(400).json({ 
            success: false, 
            message: '文件处理尚未完成，无法发送邮件' 
        });
    }
    
    const minutesData = status.minutesData;
    
    if (!minutesData) {
        return res.status(404).json({ 
            success: false, 
            message: '会议纪要数据未找到' 
        });
    }
    
    try {
        // 检查邮件传输器是否可用
        if (!emailTransporter) {
            const maskedUser = process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : '未设置';
            logger('EMAIL_CONFIG_ERROR', `SMTP邮件服务未配置，无法发送会议纪要`);
            logger('EMAIL_CONFIG_ERROR', `配置检查: HOST=${process.env.SMTP_HOST || '未设置'}, PORT=${process.env.SMTP_PORT || 587}, USER=${maskedUser}, PASS=${process.env.SMTP_PASS ? '已设置' : '未设置'}`);
            return res.status(500).json({ 
                success: false, 
                message: 'SMTP邮件服务未配置，请联系管理员配置邮件服务器' 
            });
        }
        
        // 生成邮件内容
        const emailContent = emailService.generateEmailContent(minutesData);
        
        // 批量发送邮件
        logger('EMAIL', `📧 准备发送会议纪要 - 收件人数量: ${recipients.length}, 会议ID: ${fileId}`);
        logger('EMAIL', `收件人列表: ${recipients.join(', ')}`);
        
        const sendResults = [];
        let successCount = 0;
        let failCount = 0;
        
        // 逐个发送邮件
        for (const recipientEmail of recipients) {
            try {
                logger('EMAIL', `📤 正在发送给: ${recipientEmail}`);
                const result = await emailService.sendEmail(emailTransporter, recipientEmail, emailContent);
                
                if (result.success) {
                    logger('EMAIL', `✅ 发送成功 - 收件人: ${recipientEmail}, MessageID: ${result.messageId}`);
                    sendResults.push({ email: recipientEmail, success: true });
                    successCount++;
                } else {
                    logger('EMAIL_SEND_ERROR', `发送失败 - 收件人: ${recipientEmail}, 错误: ${result.error}`);
                    sendResults.push({ email: recipientEmail, success: false, error: result.error });
                    failCount++;
                }
            } catch (error) {
                logger('EMAIL_SEND_ERROR', `发送异常 - 收件人: ${recipientEmail}, 异常: ${error.message}`);
                sendResults.push({ email: recipientEmail, success: false, error: error.message });
                failCount++;
            }
        }
        
        // 返回发送结果
        logger('EMAIL', `📊 发送完成 - 成功: ${successCount}, 失败: ${failCount}, 总计: ${recipients.length}`);
        
        if (successCount === recipients.length) {
            // 全部成功
            res.json({ 
                success: true, 
                message: `邮件发送成功！会议纪要已发送到 ${successCount} 个邮箱`,
                results: sendResults
            });
        } else if (successCount > 0) {
            // 部分成功
            const failedEmails = sendResults.filter(r => !r.success).map(r => r.email);
            res.json({ 
                success: true, 
                message: `部分邮件发送成功：${successCount} 个成功，${failCount} 个失败。失败的邮箱: ${failedEmails.join(', ')}`,
                results: sendResults
            });
        } else {
            // 全部失败
            res.status(500).json({ 
                success: false, 
                message: '所有邮件发送失败，请检查邮箱地址或稍后重试',
                results: sendResults
            });
        }
    } catch (error) {
        logger('EMAIL_EXCEPTION', `邮件发送异常 - 会议ID: ${fileId}`);
        logger('EMAIL_EXCEPTION', `异常信息: ${error.message}`);
        logger('EMAIL_EXCEPTION', `异常堆栈: ${error.stack}`);
        res.status(500).json({ 
            success: false,
            message: '邮件发送过程中发生异常，请稍后重试' 
        });
    }
});

// SMTP连接测试API端点
router.get('/test-smtp', async (req, res) => {
    try {
        const result = await emailService.testSMTPConnection(emailTransporter);
        
        if (result.success) {
            console.log('✅ SMTP连接测试成功 - 服务器:', result.details.server);
            res.json({
                success: true,
                message: result.message,
                details: result.details
            });
        } else {
            console.error('❌ SMTP连接测试失败:', result.message);
            console.error('SMTP配置检查:');
            if (result.details) {
                console.error('- 服务器:', result.details.server || process.env.SMTP_HOST || '未设置');
                console.error('- 端口:', result.details.port || process.env.SMTP_PORT || 587);
                console.error('- 用户:', result.details.user || '未设置');
                console.error('- 密码配置:', process.env.SMTP_PASS ? '已设置(长度:' + process.env.SMTP_PASS.length + ')' : '未设置');
                if (result.details.error) {
                    console.error('- 完整错误:', result.details.error);
                }
                if (result.details.response) {
                    console.error('- SMTP响应:', result.details.response);
                }
            }
            
            const maskedUser = process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : '未设置';
            res.status(500).json({
                success: false,
                message: result.message,
                details: result.details || {
                    server: process.env.SMTP_HOST || '未设置',
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    user: maskedUser,
                    configured: false
                }
            });
        }
    } catch (error) {
        console.error('❌ SMTP测试异常:', error.message);
        res.status(500).json({
            success: false,
            message: 'SMTP测试异常: ' + error.message,
            details: {
                error: error.message
            }
        });
    }
});

module.exports = { router, setTransporter, getTransporter };
