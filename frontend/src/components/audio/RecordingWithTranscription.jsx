/**
 * RecordingWithTranscription Component
 * 集成录音和实时转录功能的组件
 */

import React, { useState, useEffect } from 'react';
import { useRealtimeTranscription } from '../../hooks/useRealtimeTranscription';
import { RealtimeTranscription } from './RealtimeTranscription';
import { useNotification } from '../../contexts/NotificationContext';
import { getI18nText } from '../../i18n/realtimeTranscription';
import './RecordingWithTranscription.css';

export const RecordingWithTranscription = ({ uiLanguage = 'zh' }) => {
  const notification = useNotification();
  
  // 先声明状态变量
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [audioStream, setAudioStream] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // 获取国际化文本
  const t = getI18nText(uiLanguage);

  // 检查浏览器支持
  useEffect(() => {
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setIsSupported(supported);
  }, []);

  const {
    isTranscribing,
    transcriptionText,
    transcriptionStatus,
    isConnected,
    connectionError,
    retryCount,
    currentLanguage,
    startTranscription,
    pauseTranscription,
    resumeTranscription,
    stopTranscription,
    clearTranscription,
    copyTranscription,
    downloadTranscription,
    setCurrentLanguage
  } = useRealtimeTranscription({ language: selectedLanguage });

  /**
   * 开始录音和转录
   */
  const handleStart = async () => {
    try {
      // 请求麦克风权限并获取音频流
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      setAudioStream(stream);
      setIsRecording(true);
      setIsPaused(false);

      // 如果启用了实时转录，启动转录
      if (enableTranscription) {
        await startTranscription(stream);
      }
    } catch (error) {
      console.error('启动录音失败:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  /**
   * 暂停录音和转录
   */
  const handlePause = () => {
    if (enableTranscription && isTranscribing) {
      pauseTranscription();
    }
    setIsPaused(true);
  };

  /**
   * 恢复录音和转录
   */
  const handleResume = () => {
    if (enableTranscription && isTranscribing) {
      resumeTranscription();
    }
    setIsPaused(false);
  };

  /**
   * 停止录音和转录
   */
  const handleStop = async () => {
    if (enableTranscription && isTranscribing) {
      await stopTranscription();
    }
    
    // 停止音频流
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }

    setIsRecording(false);
    setIsPaused(false);
  };

  /**
   * 清理资源
   */
  useEffect(() => {
    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioStream]);

  /**
   * 语言变化时更新Hook
   */
  useEffect(() => {
    if (setCurrentLanguage) {
      setCurrentLanguage(selectedLanguage);
    }
  }, [selectedLanguage, setCurrentLanguage]);

  /**
   * 生成会议纪要
   */
  const handleGenerateSummary = async () => {
    if (!transcriptionText || transcriptionText.length < 100) {
      notification.warning(t.notifications.transcriptionTooShort);
      return;
    }

    setIsGeneratingSummary(true);
    
    try {
      notification.info(t.notifications.generatingSummary);

      const response = await fetch('http://localhost:3000/api/generate-meeting-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: transcriptionText
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`${uiLanguage === 'zh' ? '生成会议纪要失败' : 'Failed to generate meeting summary'}: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.summary) {
        setMeetingSummary(result.summary);
        notification.success(t.notifications.summarySuccess);
        
        // 自动复制到剪贴板
        try {
          const summaryText = formatSummaryForCopy(result.summary);
          await navigator.clipboard.writeText(summaryText);
          notification.info(t.notifications.summaryCopied);
        } catch (copyError) {
          console.error('复制失败:', copyError);
        }
      } else {
        throw new Error(result.message || (uiLanguage === 'zh' ? '生成失败' : 'Generation failed'));
      }
    } catch (error) {
      console.error('生成会议纪要失败:', error);
      notification.error((uiLanguage === 'zh' ? '生成会议纪要失败: ' : 'Failed to generate meeting summary: ') + error.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  /**
   * 格式化会议纪要用于复制
   */
  const formatSummaryForCopy = (summary) => {
    let text = '=== 会议纪要 ===\n\n';
    
    if (summary.chinese) {
      text += '【中文版】\n';
      text += `标题: ${summary.chinese.title || '未提供'}\n`;
      text += `日期: ${summary.chinese.date || '未提供'}\n`;
      text += `参会人员: ${summary.chinese.attendees?.join(', ') || '未提供'}\n\n`;
      text += `摘要:\n${summary.chinese.summary || '未提供'}\n\n`;
      
      if (summary.chinese.key_discussion_points?.length > 0) {
        text += '关键讨论点:\n';
        summary.chinese.key_discussion_points.forEach((point, i) => {
          text += `${i + 1}. ${point}\n`;
        });
        text += '\n';
      }
      
      if (summary.chinese.decisions_made?.length > 0) {
        text += '决策事项:\n';
        summary.chinese.decisions_made.forEach((decision, i) => {
          text += `${i + 1}. ${decision}\n`;
        });
        text += '\n';
      }
      
      if (summary.chinese.action_items?.length > 0) {
        text += '行动项:\n';
        summary.chinese.action_items.forEach((item, i) => {
          text += `${i + 1}. ${item.task} - 负责人: ${item.assignee || '未指定'}, 截止日期: ${item.deadline || '未设定'}\n`;
        });
        text += '\n';
      }
    }
    
    return text;
  };

  /**
   * 打开发送邮件对话框
   */
  const handleOpenEmailDialog = () => {
    if (!transcriptionText || transcriptionText.length < 100) {
      notification.warning(t.notifications.emailTooShort);
      return;
    }
    
    setShowEmailDialog(true);
  };

  /**
   * 添加邮件收件人
   */
  const handleAddEmailRecipient = () => {
    const email = emailInput.trim();
    
    if (!email) {
      notification.warning(t.notifications.enterEmail);
      return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      notification.error(t.notifications.invalidEmail);
      return;
    }
    
    // 检查是否已存在
    if (emailRecipients.includes(email)) {
      notification.warning(t.notifications.emailExists);
      return;
    }
    
    setEmailRecipients([...emailRecipients, email]);
    setEmailInput('');
  };

  /**
   * 删除邮件收件人
   */
  const handleRemoveEmailRecipient = (email) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email));
  };

  /**
   * 发送邮件
   */
  const handleSendEmail = async () => {
    if (emailRecipients.length === 0) {
      notification.warning(t.notifications.addRecipient);
      return;
    }

    // 如果还没有生成会议纪要，先生成
    if (!meetingSummary) {
      notification.info(t.notifications.generatingSummary);
      await handleGenerateSummary();
      
      // 等待会议纪要生成完成
      if (!meetingSummary) {
        notification.error(t.notifications.generateSummaryFirst);
        return;
      }
    }

    setIsSendingEmail(true);

    try {
      notification.info(t.notifications.sendingEmail);

      const response = await fetch('http://localhost:3000/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients: emailRecipients,
          minutesData: meetingSummary || {
            chinese: {
              title: uiLanguage === 'zh' ? '实时转录会议纪要' : 'Real-time Transcription Meeting Summary',
              date: new Date().toLocaleDateString(uiLanguage === 'zh' ? 'zh-CN' : 'en-US'),
              summary: transcriptionText
            }
          }
        }),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        notification.success(result.message || t.notifications.emailSuccess);
        setShowEmailDialog(false);
        setEmailRecipients([]);
        setEmailInput('');
      } else {
        throw new Error(result.message || (uiLanguage === 'zh' ? '邮件发送失败' : 'Email sending failed'));
      }
    } catch (error) {
      console.error('发送邮件失败:', error);
      notification.error((uiLanguage === 'zh' ? '发送邮件失败: ' : 'Failed to send email: ') + error.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="recording-with-transcription">
      {/* 控制面板 */}
      <div className="control-panel">
        <div className="control-header">
          <h2>🎤️ {t.controlPanel.title}</h2>
          <div className="control-options">
            <label className="transcription-toggle">
              <input
                type="checkbox"
                checked={enableTranscription}
                onChange={(e) => setEnableTranscription(e.target.checked)}
                disabled={isRecording}
              />
              <span>{t.controlPanel.enableTranscription}</span>
            </label>
            
            {enableTranscription && (
              <div className="language-selector">
                <label htmlFor="language-select">{t.controlPanel.language}：</label>
                <select
                  id="language-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={isRecording}
                  className="language-select"
                >
                  <option value="auto">{t.controlPanel.autoDetect}</option>
                  <option value="zh">{t.languageOptions.chinese}</option>
                  <option value="en">{t.languageOptions.english}</option>
                  <option value="ja">{t.languageOptions.japanese}</option>
                  <option value="ko">{t.languageOptions.korean}</option>
                  <option value="es">{t.languageOptions.spanish}</option>
                  <option value="fr">{t.languageOptions.french}</option>
                  <option value="de">{t.languageOptions.german}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="control-buttons">
          {!isRecording ? (
            <button
              className="control-btn start-btn"
              onClick={handleStart}
              disabled={!isSupported}
            >
              🎤 {t.buttons.start}
            </button>
          ) : (
            <>
              {!isPaused ? (
                <button
                  className="control-btn pause-btn"
                  onClick={handlePause}
                >
                  ⏸️ {t.buttons.pause}
                </button>
              ) : (
                <button
                  className="control-btn resume-btn"
                  onClick={handleResume}
                >
                  ▶️ {t.buttons.resume}
                </button>
              )}
              <button
                className="control-btn stop-btn"
                onClick={handleStop}
              >
                ⏹️ {t.buttons.stop}
              </button>
            </>
          )}
        </div>

        {/* 状态指示器 */}
        <div className="status-indicators">
          <div className={`indicator ${isRecording ? 'active' : ''}`}>
            <span className="indicator-dot"></span>
            <span className="indicator-text">
              {isRecording ? (isPaused ? t.status.recordingPaused : t.status.recording) : t.status.notRecording}
            </span>
          </div>
          
          {enableTranscription && (
            <div className={`indicator ${isTranscribing ? 'active' : ''}`}>
              <span className="indicator-dot"></span>
              <span className="indicator-text">
                {isTranscribing ? t.status.transcribing : t.status.transcriptionNotStarted}
              </span>
            </div>
          )}
        </div>

        {/* 提示信息 */}
        {!isSupported && (
          <div className="warning-message">
            ⚠️ {t.controlPanel.browserNotSupported}
          </div>
        )}
        
        {connectionError && enableTranscription && (
          <div className="error-message">
            ❌ {connectionError}
          </div>
        )}
      </div>

      {/* 实时转录显示区域 */}
      {enableTranscription && (
        <div className="transcription-panel">
          <RealtimeTranscription
            transcriptionText={transcriptionText}
            transcriptionStatus={transcriptionStatus}
            isConnected={isConnected}
            connectionError={connectionError}
            retryCount={retryCount}
            onCopy={copyTranscription}
            onDownload={downloadTranscription}
            onClear={clearTranscription}
            onGenerateSummary={handleGenerateSummary}
            onSendEmail={handleOpenEmailDialog}
            language={uiLanguage}
          />
        </div>
      )}

      {/* 邮件发送对话框 */}
      {showEmailDialog && (
        <div className="email-dialog-overlay" onClick={() => setShowEmailDialog(false)}>
          <div className="email-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="email-dialog-header">
              <h3>📧 {t.emailDialog.title}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowEmailDialog(false)}
              >
                ✕
              </button>
            </div>

            <div className="email-dialog-body">
              <div className="email-input-group">
                <input
                  type="email"
                  className="email-input"
                  placeholder={t.emailDialog.inputPlaceholder}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmailRecipient();
                    }
                  }}
                />
                <button 
                  className="add-email-btn"
                  onClick={handleAddEmailRecipient}
                >
                  {t.buttons.add}
                </button>
              </div>

              {emailRecipients.length > 0 && (
                <div className="email-recipients">
                  <div className="recipients-label">
                    {t.emailDialog.recipientsLabel} ({emailRecipients.length}):
                  </div>
                  <div className="recipients-list">
                    {emailRecipients.map((email, index) => (
                      <div key={index} className="recipient-tag">
                        <span>{email}</span>
                        <button
                          className="remove-recipient-btn"
                          onClick={() => handleRemoveEmailRecipient(email)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="email-dialog-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowEmailDialog(false)}
              >
                {t.buttons.cancel}
              </button>
              <button
                className="send-email-btn"
                onClick={handleSendEmail}
                disabled={isSendingEmail || emailRecipients.length === 0}
              >
                {isSendingEmail ? t.buttons.sending : t.buttons.send}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordingWithTranscription;
