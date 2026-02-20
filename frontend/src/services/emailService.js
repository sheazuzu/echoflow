/**
 * 邮件服务
 * 处理邮件相关的 API 请求
 */

import apiClient from './api';
import { API_ENDPOINTS, ERROR_MESSAGES, EMAIL_CONFIG } from '../constants';

/**
 * 验证邮箱地址
 */
export const validateEmail = (email) => {
  if (!email || !email.trim()) {
    return { valid: false, error: '邮箱地址不能为空' };
  }

  const trimmedEmail = email.trim();

  if (!EMAIL_CONFIG.EMAIL_REGEX.test(trimmedEmail)) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_EMAIL };
  }

  return { valid: true, email: trimmedEmail };
};

/**
 * 验证多个邮箱地址
 */
export const validateEmails = (emails) => {
  if (!emails || emails.length === 0) {
    return { valid: false, error: ERROR_MESSAGES.NO_RECIPIENTS };
  }

  if (emails.length > EMAIL_CONFIG.MAX_RECIPIENTS) {
    return {
      valid: false,
      error: `收件人数量不能超过 ${EMAIL_CONFIG.MAX_RECIPIENTS} 个`,
    };
  }

  const invalidEmails = [];
  const validEmails = [];

  emails.forEach((email) => {
    const validation = validateEmail(email);
    if (validation.valid) {
      validEmails.push(validation.email);
    } else {
      invalidEmails.push(email);
    }
  });

  if (invalidEmails.length > 0) {
    return {
      valid: false,
      error: `以下邮箱地址格式不正确：${invalidEmails.join(', ')}`,
      invalidEmails,
    };
  }

  return { valid: true, emails: validEmails };
};

/**
 * 发送邮件
 */
export const sendEmail = async (emailData) => {
  const {
    recipients,
    subject,
    content,
    attachments = [],
  } = emailData;

  // 验证收件人
  const validation = validateEmails(recipients);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error,
    };
  }

  // 发送邮件
  return await apiClient.post(API_ENDPOINTS.SEND_EMAIL, {
    recipients: validation.emails,
    subject,
    content,
    attachments,
  });
};

/**
 * 批量发送邮件
 */
export const sendBatchEmails = async (emailData, onProgress) => {
  const {
    recipients,
    subject,
    content,
    attachments = [],
  } = emailData;

  // 验证收件人
  const validation = validateEmails(recipients);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const results = {
    success: [],
    failed: [],
    total: validation.emails.length,
  };

  // 分批发送（每批 10 个）
  const batchSize = 10;
  const batches = [];

  for (let i = 0; i < validation.emails.length; i += batchSize) {
    batches.push(validation.emails.slice(i, i + batchSize));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      const response = await apiClient.post(API_ENDPOINTS.SEND_EMAIL, {
        recipients: batch,
        subject,
        content,
        attachments,
      });

      if (response.success) {
        results.success.push(...batch);
      } else {
        results.failed.push(...batch);
      }
    } catch (error) {
      results.failed.push(...batch);
    }

    // 更新进度
    if (onProgress) {
      const progress = ((i + 1) / batches.length) * 100;
      onProgress(progress, results);
    }
  }

  return {
    success: results.failed.length === 0,
    message: results.failed.length === 0
      ? `成功发送 ${results.success.length} 封邮件`
      : `成功发送 ${results.success.length} 封，失败 ${results.failed.length} 封`,
    data: results,
  };
};

/**
 * 发送会议纪要邮件
 */
export const sendMeetingMinutesEmail = async (recipients, minutesData) => {
  const {
    title = '会议纪要',
    date = new Date().toLocaleDateString('zh-CN'),
    content,
  } = minutesData;

  // 构建邮件内容
  const emailContent = formatMeetingMinutesEmail(minutesData);

  return await sendEmail({
    recipients,
    subject: `${title} - ${date}`,
    content: emailContent,
  });
};

/**
 * 格式化会议纪要邮件内容
 */
const formatMeetingMinutesEmail = (minutesData) => {
  const {
    title = '会议纪要',
    date = new Date().toLocaleDateString('zh-CN'),
    participants = [],
    content = {},
  } = minutesData;

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">${title}</h1>
      <p style="color: #666;"><strong>日期：</strong>${date}</p>
  `;

  if (participants.length > 0) {
    html += `<p style="color: #666;"><strong>参会人员：</strong>${participants.join('、')}</p>`;
  }

  html += `<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">`;

  // 会议主题
  if (content.topic) {
    html += `
      <h2 style="color: #333; margin-top: 20px;">会议主题</h2>
      <p style="color: #666; line-height: 1.6;">${content.topic}</p>
    `;
  }

  // 讨论内容
  if (content.discussion) {
    html += `
      <h2 style="color: #333; margin-top: 20px;">讨论内容</h2>
      <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${content.discussion}</p>
    `;
  }

  // 决策事项
  if (content.decisions && content.decisions.length > 0) {
    html += `
      <h2 style="color: #333; margin-top: 20px;">决策事项</h2>
      <ol style="color: #666; line-height: 1.8;">
    `;
    content.decisions.forEach((decision) => {
      html += `<li>${decision}</li>`;
    });
    html += `</ol>`;
  }

  // 行动项
  if (content.actionItems && content.actionItems.length > 0) {
    html += `
      <h2 style="color: #333; margin-top: 20px;">行动项</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">任务</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">负责人</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">截止日期</th>
          </tr>
        </thead>
        <tbody>
    `;
    content.actionItems.forEach((item) => {
      html += `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">${item.task}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${item.assignee || '-'}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${item.deadline || '-'}</td>
        </tr>
      `;
    });
    html += `
        </tbody>
      </table>
    `;
  }

  // 下次会议
  if (content.nextMeeting) {
    html += `
      <h2 style="color: #333; margin-top: 20px;">下次会议</h2>
      <p style="color: #666; line-height: 1.6;">${content.nextMeeting}</p>
    `;
  }

  html += `
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 20px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">
        此邮件由 EchoFlow 智能会议助手自动生成
      </p>
    </div>
  `;

  return html;
};

/**
 * 保存默认收件人
 */
export const saveDefaultRecipients = (emails) => {
  try {
    const validation = validateEmails(emails);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error,
      };
    }

    localStorage.setItem('default_recipients', JSON.stringify(validation.emails));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: '保存失败',
    };
  }
};

/**
 * 获取默认收件人
 */
export const getDefaultRecipients = () => {
  try {
    const saved = localStorage.getItem('default_recipients');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

/**
 * 清除默认收件人
 */
export const clearDefaultRecipients = () => {
  try {
    localStorage.removeItem('default_recipients');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: '清除失败',
    };
  }
};
