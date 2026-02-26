/**
 * 用户反馈路由
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const emailService = require('../emailService');

// 邮件传输器引用（由 app.js 注入）
let emailTransporter = null;

/**
 * 设置邮件传输器
 */
function setTransporter(transporter) {
    emailTransporter = transporter;
}

// 用户反馈API端点
router.post('/send-feedback', async (req, res) => {
    const { name, email, message, recipients } = req.body;
    
    // 验证参数
    if (!name || !email || !message) {
        return res.status(400).json({ 
            success: false, 
            message: '请填写所有必需字段（姓名、邮箱、反馈内容）' 
        });
    }
    
    // 验证发件人邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            message: '发件人邮箱地址格式无效' 
        });
    }
    
    // 验证收件人列表
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '请至少添加一个收件人邮箱' 
        });
    }
    
    // 验证所有收件人邮箱格式
    for (const recipientEmail of recipients) {
        if (!emailRegex.test(recipientEmail)) {
            return res.status(400).json({ 
                success: false, 
                message: `收件人邮箱地址格式无效: ${recipientEmail}` 
            });
        }
    }
    
    // 验证消息长度
    if (message.length < 10) {
        return res.status(400).json({ 
            success: false, 
            message: '反馈内容至少需要10个字符' 
        });
    }
    
    if (message.length > 5000) {
        return res.status(400).json({ 
            success: false, 
            message: '反馈内容不能超过5000个字符' 
        });
    }
    
    try {
        // 检查邮件传输器是否可用
        if (!emailTransporter) {
            logger('FEEDBACK_CONFIG_ERROR', `SMTP邮件服务未配置，无法发送反馈邮件`);
            return res.status(500).json({ 
                success: false, 
                message: 'SMTP邮件服务未配置，请联系管理员' 
            });
        }
        
        // 生成反馈邮件内容
        const feedbackEmailContent = {
            subject: `EchoFlow 用户反馈 - ${name}`,
            html: `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>用户反馈</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #6366f1;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #6366f1;
            margin: 0;
            font-size: 24px;
        }
        .field {
            margin-bottom: 20px;
        }
        .field-label {
            font-weight: bold;
            color: #4b5563;
            margin-bottom: 8px;
            display: block;
        }
        .field-content {
            color: #1f2937;
            padding: 12px;
            background-color: #f9fafb;
            border-radius: 6px;
            border-left: 3px solid #6366f1;
        }
        .message-content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💬 EchoFlow 用户反馈</h1>
        </div>
        
        <div class="field">
            <span class="field-label">👤 用户姓名：</span>
            <div class="field-content">${name}</div>
        </div>
        
        <div class="field">
            <span class="field-label">📧 联系邮箱：</span>
            <div class="field-content">${email}</div>
        </div>
        
        <div class="field">
            <span class="field-label">💭 反馈内容：</span>
            <div class="field-content message-content">${message}</div>
        </div>
        
        <div class="footer">
            <p>此邮件由 EchoFlow 系统自动生成</p>
            <p>发送时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
        </div>
    </div>
</body>
</html>
            `,
            text: `
EchoFlow 用户反馈
==================

用户姓名：${name}
联系邮箱：${email}

反馈内容：
${message}

==================
此邮件由 EchoFlow 系统自动生成
发送时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
            `
        };
        
        // 发送反馈邮件到所有收件人
        logger('EMAIL', `📧 准备发送用户反馈 - 发件人: ${name} (${email}), 收件人: ${recipients.join(', ')}`);
        
        const sendResults = [];
        let successCount = 0;
        let failCount = 0;
        
        // 逐个发送给每个收件人
        for (const recipientEmail of recipients) {
            const result = await emailService.sendEmail(emailTransporter, recipientEmail, feedbackEmailContent);
            sendResults.push({ email: recipientEmail, ...result });
            
            if (result.success) {
                successCount++;
                logger('EMAIL', `✅ 反馈邮件发送成功 - 收件人: ${recipientEmail}, MessageID: ${result.messageId}`);
            } else {
                failCount++;
                logger('FEEDBACK_SEND_ERROR', `反馈邮件发送失败 - 收件人: ${recipientEmail}`);
                logger('FEEDBACK_SEND_ERROR', `错误详情: ${result.error} (代码: ${result.code || '无'})`);
            }
        }
        
        // 根据发送结果返回响应
        if (successCount === recipients.length) {
            // 全部成功
            res.json({ 
                success: true, 
                message: `感谢您的反馈！邮件已成功发送给 ${successCount} 位收件人。` 
            });
        } else if (successCount > 0) {
            // 部分成功
            const failedEmails = sendResults.filter(r => !r.success).map(r => r.email).join(', ');
            res.json({ 
                success: true, 
                message: `邮件已发送给 ${successCount} 位收件人，但发送给以下收件人失败：${failedEmails}` 
            });
        } else {
            // 全部失败
            const firstError = sendResults[0];
            let userMessage = '反馈发送失败，请稍后重试';
            if (firstError.code === 'EAUTH') {
                userMessage = '邮件服务器认证失败，请联系管理员';
            } else if (firstError.code === 'ECONNECTION' || firstError.code === 'ETIMEDOUT') {
                userMessage = '网络连接失败，请稍后重试';
            } else if (firstError.error) {
                userMessage = `发送失败: ${firstError.error}`;
            }
            
            res.status(500).json({ 
                success: false, 
                message: userMessage
            });
        }
    } catch (error) {
        logger('FEEDBACK_EXCEPTION', `反馈邮件发送异常`);
        logger('FEEDBACK_EXCEPTION', `异常信息: ${error.message}`);
        logger('FEEDBACK_EXCEPTION', `异常堆栈: ${error.stack}`);
        res.status(500).json({ 
            success: false,
            message: '发送过程中发生异常，请稍后重试' 
        });
    }
});

module.exports = { router, setTransporter };
