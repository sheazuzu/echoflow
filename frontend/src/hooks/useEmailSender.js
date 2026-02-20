/**
 * useEmailSender Hook
 * 封装邮件发送逻辑（多收件人管理、批量发送）
 */

import { useState, useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import {
  sendMeetingMinutesEmail,
  validateEmail,
  validateEmails,
  getDefaultRecipients,
  saveDefaultRecipients,
} from '../services/emailService';
import { SUCCESS_MESSAGES } from '../constants';

export const useEmailSender = () => {
  const notification = useNotification();

  const [recipients, setRecipients] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResult, setSendResult] = useState(null);

  // 加载默认收件人
  const loadDefaultRecipients = useCallback(() => {
    const defaultRecipients = getDefaultRecipients();
    setRecipients(defaultRecipients);
  }, []);

  // 添加收件人
  const addRecipient = useCallback((email) => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return false;
    }

    // 验证邮箱
    const validation = validateEmail(trimmedEmail);
    if (!validation.valid) {
      notification.error(validation.error);
      return false;
    }

    // 检查是否已存在
    if (recipients.includes(validation.email)) {
      notification.warning('该邮箱已添加');
      return false;
    }

    // 添加到列表
    setRecipients(prev => [...prev, validation.email]);
    setCurrentInput('');
    return true;
  }, [recipients, notification]);

  // 移除收件人
  const removeRecipient = useCallback((index) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 清空收件人
  const clearRecipients = useCallback(() => {
    setRecipients([]);
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback((value) => {
    setCurrentInput(value);
  }, []);

  // 处理输入键盘事件
  const handleInputKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addRecipient(currentInput);
    } else if (event.key === 'Backspace' && !currentInput && recipients.length > 0) {
      // 删除最后一个收件人
      removeRecipient(recipients.length - 1);
    }
  }, [currentInput, recipients, addRecipient, removeRecipient]);

  // 批量添加收件人（从粘贴的文本）
  const addRecipientsFromText = useCallback((text) => {
    // 分割文本（支持逗号、分号、空格、换行）
    const emails = text.split(/[,;\s\n]+/).filter(e => e.trim());

    let addedCount = 0;
    let failedCount = 0;

    emails.forEach(email => {
      const success = addRecipient(email);
      if (success) {
        addedCount++;
      } else {
        failedCount++;
      }
    });

    if (addedCount > 0) {
      notification.success(`成功添加 ${addedCount} 个收件人`);
    }

    if (failedCount > 0) {
      notification.warning(`${failedCount} 个邮箱格式不正确或已存在`);
    }
  }, [addRecipient, notification]);

  // 发送邮件
  const sendEmail = useCallback(async (minutesData) => {
    // 验证收件人
    const validation = validateEmails(recipients);
    if (!validation.valid) {
      notification.error(validation.error);
      return false;
    }

    try {
      setIsSending(true);
      setSendProgress(0);
      setSendResult(null);

      // 发送邮件
      const response = await sendMeetingMinutesEmail(recipients, minutesData);

      if (response.success) {
        setSendProgress(100);
        setSendResult({ success: true });
        notification.success(SUCCESS_MESSAGES.EMAIL_SENT);
        return true;
      } else {
        setSendResult({ success: false, error: response.message });
        notification.error(response.message);
        return false;
      }
    } catch (error) {
      setSendResult({ success: false, error: error.message });
      notification.error(error.message || '邮件发送失败');
      return false;
    } finally {
      setIsSending(false);
    }
  }, [recipients, notification]);

  // 重试发送
  const retrySend = useCallback(async (minutesData) => {
    return await sendEmail(minutesData);
  }, [sendEmail]);

  // 保存为默认收件人
  const saveAsDefault = useCallback(() => {
    const result = saveDefaultRecipients(recipients);
    if (result.success) {
      notification.success('已保存为默认收件人');
      return true;
    } else {
      notification.error(result.message);
      return false;
    }
  }, [recipients, notification]);

  // 重置状态
  const reset = useCallback(() => {
    setRecipients([]);
    setCurrentInput('');
    setIsSending(false);
    setSendProgress(0);
    setSendResult(null);
  }, []);

  return {
    // 状态
    recipients,
    currentInput,
    isSending,
    sendProgress,
    sendResult,
    hasRecipients: recipients.length > 0,
    recipientCount: recipients.length,

    // 收件人管理
    addRecipient,
    removeRecipient,
    clearRecipients,
    addRecipientsFromText,
    loadDefaultRecipients,
    saveAsDefault,

    // 输入处理
    handleInputChange,
    handleInputKeyDown,

    // 发送操作
    sendEmail,
    retrySend,

    // 重置
    reset,
  };
};
