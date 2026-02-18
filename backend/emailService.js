const nodemailer = require('nodemailer');

/**
 * 创建Nodemailer传输器
 * @returns {Object|null} 传输器对象或null（如果配置缺失）
 */
function createTransporter() {
    // 检查必需的配置
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    // 检查配置是否完整
    const missingConfigs = [];
    if (!host) missingConfigs.push('SMTP_HOST');
    if (!user) missingConfigs.push('SMTP_USER');
    if (!pass) missingConfigs.push('SMTP_PASS');
    
    if (missingConfigs.length > 0) {
        console.error('[邮件服务] ❌ SMTP配置缺失，邮件发送功能将不可用');
        console.error('[邮件服务] 配置检查:');
        console.error(`  - SMTP_HOST: ${host || '❌ 未设置'}`);
        console.error(`  - SMTP_PORT: ${process.env.SMTP_PORT || 587}`);
        console.error(`  - SMTP_SECURE: ${process.env.SMTP_SECURE || 'false'}`);
        console.error(`  - SMTP_USER: ${user ? user.replace(/(.{3}).*(@.*)/, '$1***$2') : '❌ 未设置 - 请输入邮箱地址'}`);
        console.error(`  - SMTP_PASS: ${pass ? '已设置(长度:' + pass.length + ')' : '❌ 未设置 - 请输入邮箱密码或应用专用密码'}`);
        console.error('');
        console.error('[邮件服务] ⚠️  缺失的配置项:');
        missingConfigs.forEach(config => {
            if (config === 'SMTP_USER') {
                console.error(`  ❌ ${config} - 请输入发件人邮箱地址 (例如: your-email@gmail.com)`);
            } else if (config === 'SMTP_PASS') {
                console.error(`  ❌ ${config} - 请输入邮箱密码或应用专用密码`);
                console.error(`     提示: Gmail需要使用应用专用密码，不是普通登录密码`);
            } else {
                console.error(`  ❌ ${config} - 请输入SMTP服务器地址 (例如: smtp.gmail.com)`);
            }
        });
        console.error('');
        console.error('[邮件服务] 📝 请在项目根目录的 .env 文件中配置以上参数');
        return null;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: host,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: user,
                pass: pass,
            },
            // 增加超时时间和重试机制，解决网络不稳定问题
            connectionTimeout: 60000,  // 连接超时：60秒（默认2分钟）
            greetingTimeout: 30000,    // 握手超时：30秒（默认30秒）
            socketTimeout: 60000,      // Socket超时：60秒（默认10分钟）
            pool: true,                // 使用连接池
            maxConnections: 5,         // 最大连接数
            maxMessages: 100,          // 每个连接最多发送100封邮件
            rateDelta: 1000,           // 限流：每秒最多发送的邮件数
            rateLimit: 5,              // 限流：每rateDelta时间内最多5封
        });
        
        console.log('[邮件服务] ✅ SMTP传输器创建成功');
        console.log(`[邮件服务] 配置: ${host}:${process.env.SMTP_PORT || 587} (${user.replace(/(.{3}).*(@.*)/, '$1***$2')})`);
        return transporter;
    } catch (error) {
        console.error('[邮件服务] ❌ 创建SMTP传输器失败:', error.message);
        return null;
    }
}

/**
 * 生成邮件内容
 * @param {Object} minutesData 会议纪要数据对象
 * @returns {Object} 包含subject、html和text的对象
 */
function generateEmailContent(minutesData) {
    const { chinese, english } = minutesData;
    
    // 邮件主题
    const subject = `会议纪要 - ${chinese.title || '未命名会议'}`;
    
    // 生成HTML内容
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>会议纪要</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
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
            font-size: 28px;
        }
        .header p {
            color: #666;
            margin: 10px 0 0 0;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            color: #6366f1;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
        }
        .field {
            margin-bottom: 15px;
        }
        .field-label {
            font-weight: bold;
            color: #4b5563;
            margin-bottom: 5px;
        }
        .field-content {
            color: #1f2937;
            padding-left: 10px;
        }
        .list-item {
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        .list-item:last-child {
            border-bottom: none;
        }
        .action-item {
            background-color: #fef3c7;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .risk-item {
            background-color: #fee2e2;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 14px;
        }
        .divider {
            height: 2px;
            background: linear-gradient(to right, #6366f1, #a855f7);
            margin: 40px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 EchoFlow 会议纪要</h1>
            <p>Meeting Minutes Generated by EchoFlow</p>
        </div>

        <!-- 中文会议纪要 -->
        <div class="section">
            <div class="section-title">📝 中文会议纪要</div>
            
            <div class="field">
                <div class="field-label">会议标题：</div>
                <div class="field-content">${chinese.title || '未提供'}</div>
            </div>
            
            <div class="field">
                <div class="field-label">会议日期：</div>
                <div class="field-content">${chinese.date || '未提供'}</div>
            </div>
            
            <div class="field">
                <div class="field-label">参会人员：</div>
                <div class="field-content">${chinese.participants || '未提供'}</div>
            </div>
            
            <div class="field">
                <div class="field-label">会议摘要：</div>
                <div class="field-content">${chinese.summary || '未提供'}</div>
            </div>
            
            ${chinese.discussion_points && chinese.discussion_points.length > 0 ? `
            <div class="field">
                <div class="field-label">关键讨论点：</div>
                <div class="field-content">
                    ${chinese.discussion_points.map((point, index) => `
                        <div class="list-item">${index + 1}. ${point}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${chinese.decisions && chinese.decisions.length > 0 ? `
            <div class="field">
                <div class="field-label">决策事项：</div>
                <div class="field-content">
                    ${chinese.decisions.map((decision, index) => `
                        <div class="list-item">${index + 1}. ${decision}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${chinese.action_items && chinese.action_items.length > 0 ? `
            <div class="field">
                <div class="field-label">行动项：</div>
                <div class="field-content">
                    ${chinese.action_items.map(item => `
                        <div class="action-item">
                            <strong>任务：</strong> ${item.task || '未提供'}<br>
                            <strong>负责人：</strong> ${item.owner || '未指定'}<br>
                            <strong>截止日期：</strong> ${item.deadline || '未设定'}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${chinese.risks && chinese.risks.length > 0 ? `
            <div class="field">
                <div class="field-label">风险和问题：</div>
                <div class="field-content">
                    ${chinese.risks.map((risk, index) => `
                        <div class="risk-item">${index + 1}. ${risk}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>

        <div class="divider"></div>

        <!-- 英文会议纪要 -->
        <div class="section">
            <div class="section-title">📄 English Meeting Minutes</div>
            
            <div class="field">
                <div class="field-label">Meeting Title:</div>
                <div class="field-content">${english.title || 'Not provided'}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Meeting Date:</div>
                <div class="field-content">${english.date || 'Not provided'}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Participants:</div>
                <div class="field-content">${english.participants || 'Not provided'}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Summary:</div>
                <div class="field-content">${english.summary || 'Not provided'}</div>
            </div>
            
            ${english.discussion_points && english.discussion_points.length > 0 ? `
            <div class="field">
                <div class="field-label">Key Discussion Points:</div>
                <div class="field-content">
                    ${english.discussion_points.map((point, index) => `
                        <div class="list-item">${index + 1}. ${point}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${english.decisions && english.decisions.length > 0 ? `
            <div class="field">
                <div class="field-label">Decisions:</div>
                <div class="field-content">
                    ${english.decisions.map((decision, index) => `
                        <div class="list-item">${index + 1}. ${decision}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${english.action_items && english.action_items.length > 0 ? `
            <div class="field">
                <div class="field-label">Action Items:</div>
                <div class="field-content">
                    ${english.action_items.map(item => `
                        <div class="action-item">
                            <strong>Task:</strong> ${item.task || 'Not provided'}<br>
                            <strong>Owner:</strong> ${item.owner || 'Not assigned'}<br>
                            <strong>Deadline:</strong> ${item.deadline || 'Not set'}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${english.risks && english.risks.length > 0 ? `
            <div class="field">
                <div class="field-label">Risks and Issues:</div>
                <div class="field-content">
                    ${english.risks.map((risk, index) => `
                        <div class="risk-item">${index + 1}. ${risk}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>此邮件由 EchoFlow 系统自动生成</p>
            <p>Generated at ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
        </div>
    </div>
</body>
</html>
    `;
    
    // 生成纯文本版本
    const text = `
EchoFlow 会议纪要
==================

中文会议纪要
------------
会议标题：${chinese.title || '未提供'}
会议日期：${chinese.date || '未提供'}
参会人员：${chinese.participants || '未提供'}
会议摘要：${chinese.summary || '未提供'}

${chinese.discussion_points && chinese.discussion_points.length > 0 ? `
关键讨论点：
${chinese.discussion_points.map((point, index) => `${index + 1}. ${point}`).join('\n')}
` : ''}

${chinese.decisions && chinese.decisions.length > 0 ? `
决策事项：
${chinese.decisions.map((decision, index) => `${index + 1}. ${decision}`).join('\n')}
` : ''}

${chinese.action_items && chinese.action_items.length > 0 ? `
行动项：
${chinese.action_items.map(item => `- 任务：${item.task || '未提供'}\n  负责人：${item.owner || '未指定'}\n  截止日期：${item.deadline || '未设定'}`).join('\n')}
` : ''}

${chinese.risks && chinese.risks.length > 0 ? `
风险和问题：
${chinese.risks.map((risk, index) => `${index + 1}. ${risk}`).join('\n')}
` : ''}

==================

English Meeting Minutes
-----------------------
Meeting Title: ${english.title || 'Not provided'}
Meeting Date: ${english.date || 'Not provided'}
Participants: ${english.participants || 'Not provided'}
Summary: ${english.summary || 'Not provided'}

${english.discussion_points && english.discussion_points.length > 0 ? `
Key Discussion Points:
${english.discussion_points.map((point, index) => `${index + 1}. ${point}`).join('\n')}
` : ''}

${english.decisions && english.decisions.length > 0 ? `
Decisions:
${english.decisions.map((decision, index) => `${index + 1}. ${decision}`).join('\n')}
` : ''}

${english.action_items && english.action_items.length > 0 ? `
Action Items:
${english.action_items.map(item => `- Task: ${item.task || 'Not provided'}\n  Owner: ${item.owner || 'Not assigned'}\n  Deadline: ${item.deadline || 'Not set'}`).join('\n')}
` : ''}

${english.risks && english.risks.length > 0 ? `
Risks and Issues:
${english.risks.map((risk, index) => `${index + 1}. ${risk}`).join('\n')}
` : ''}

==================
此邮件由 EchoFlow 系统自动生成
Generated at ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
    `;
    
    return { subject, html, text };
}

/**
 * 测试SMTP服务器连通性
 * @param {Object} transporter Nodemailer传输器
 * @returns {Promise<Object>} 测试结果 {success: boolean, message: string, details: object}
 */
async function testSMTPConnection(transporter) {
    if (!transporter) {
        return { 
            success: false, 
            message: 'SMTP传输器未配置，邮件发送功能将不可用',
            details: {
                configured: false
            }
        };
    }

    try {
        console.log('[邮件服务] 正在测试SMTP连接...');
        await transporter.verify();
        console.log('[邮件服务] ✅ SMTP连接测试成功');
        const maskedUser = process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : '';
        return { 
            success: true, 
            message: 'SMTP服务器连接成功，邮件发送功能已就绪',
            details: {
                server: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                user: maskedUser,
                secure: process.env.SMTP_SECURE === 'true'
            }
        };
    } catch (error) {
        console.error('[邮件服务] ❌ SMTP连接测试失败');
        console.error('[邮件服务]    错误类型:', error.name || 'Error');
        console.error('[邮件服务]    错误代码:', error.code || '无');
        console.error('[邮件服务]    完整错误信息:', error.message);
        if (error.response) {
            console.error('[邮件服务]    SMTP响应:', error.response);
        }
        if (error.responseCode) {
            console.error('[邮件服务]    响应代码:', error.responseCode);
        }
        
        const maskedUser = process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : '';
        return { 
            success: false, 
            message: `SMTP服务器连接失败: ${error.message}`,
            details: {
                server: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                user: maskedUser,
                error: error.message,
                code: error.code,
                response: error.response || error.responseCode
            }
        };
    }
}

/**
 * 发送邮件
 * @param {Object} transporter Nodemailer传输器
 * @param {string} recipientEmail 收件人邮箱
 * @param {Object} emailContent 邮件内容（subject、html、text）
 * @returns {Promise<Object>} 发送结果
 */
async function sendEmail(transporter, recipientEmail, emailContent) {
    if (!transporter) {
        console.error('[邮件服务] ❌ 传输器未初始化，无法发送邮件');
        return { success: false, error: 'SMTP传输器未配置' };
    }

    const mailOptions = {
        from: `${process.env.SMTP_FROM_NAME || 'EchoFlow'} <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
    };

    try {
        console.log(`[邮件服务] 📧 正在发送邮件...`);
        console.log(`[邮件服务]    收件人: ${recipientEmail}`);
        console.log(`[邮件服务]    主题: ${emailContent.subject}`);
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log(`[邮件服务] ✅ 邮件发送成功！`);
        console.log(`[邮件服务]    收件人: ${recipientEmail}`);
        console.log(`[邮件服务]    MessageID: ${info.messageId}`);
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[邮件服务] ❌ 邮件发送失败！`);
        console.error(`[邮件服务]    收件人: ${recipientEmail}`);
        console.error(`[邮件服务]    错误类型: ${error.name || 'Error'}`);
        console.error(`[邮件服务]    错误代码: ${error.code || '无'}`);
        console.error(`[邮件服务]    完整错误信息: ${error.message}`);
        
        if (error.response) {
            console.error(`[邮件服务]    SMTP完整响应: ${error.response}`);
        }
        if (error.responseCode) {
            console.error(`[邮件服务]    响应代码: ${error.responseCode}`);
        }
        if (error.command) {
            console.error(`[邮件服务]    失败命令: ${error.command}`);
        }
        
        return { success: false, error: error.message, code: error.code, response: error.response };
    }
}

module.exports = {
    createTransporter,
    generateEmailContent,
    sendEmail,
    testSMTPConnection,
};
