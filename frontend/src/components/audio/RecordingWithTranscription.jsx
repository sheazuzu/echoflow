/**
 * RecordingWithTranscription Component
 * 集成录音和实时转录功能的组件
 */

import React, { useState, useEffect } from 'react';
import { useRealtimeTranscription } from '../../hooks/useRealtimeTranscription';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import { RealtimeTranscription } from './RealtimeTranscription';
import { useNotification } from '../../contexts/NotificationContext';
import { getI18nText } from '../../i18n/realtimeTranscription';
import { AUDIO_SOURCE_TYPES } from '../../utils/audioSourceManager';
import './RecordingWithTranscription.css';

export const RecordingWithTranscription = ({ uiLanguage = 'zh' }) => {
  const notification = useNotification();
  
  // 先声明状态变量
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [isSupported, setIsSupported] = useState(true);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [audioSourceType, setAudioSourceType] = useState(() => {
    // 从 localStorage 读取用户上次的选择
    return localStorage.getItem('audioSourceType') || AUDIO_SOURCE_TYPES.ALL;
  });
  const [showFirstTimeGuide, setShowFirstTimeGuide] = useState(() => {
    // 检查是否首次使用
    return !localStorage.getItem('hasSeenAudioGuide');
  });
  
  // 获取国际化文本
  const t = getI18nText(uiLanguage);

  // 使用 useAudioCapture Hook
  const {
    audioStream,
    activeSourcesStatus,
    isCapturing,
    error: audioCaptureError,
    startCapture,
    stopCapture,
    canCaptureMicrophone,
    canCaptureSystemAudio
  } = useAudioCapture({
    defaultSourceType: audioSourceType,
    onError: (err) => {
      console.error('[RecordingWithTranscription] Audio capture error:', err);
      notification.error(
        (uiLanguage === 'zh' ? '音频捕获失败: ' : 'Audio capture failed: ') + err.message
      );
    },
    onStreamReady: (stream) => {
      console.log('[RecordingWithTranscription] Audio stream ready:', stream.id);
    }
  });

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
      // 使用 useAudioCapture Hook 捕获音频
      const stream = await startCapture(audioSourceType);

      if (!stream) {
        throw new Error(uiLanguage === 'zh' ? '无法获取音频流' : 'Failed to get audio stream');
      }

      setIsRecording(true);
      setIsPaused(false);

      // 如果启用了实时转录，启动转录
      if (enableTranscription) {
        await startTranscription(stream);
      }

      notification.success(
        uiLanguage === 'zh' ? '录音已开始' : 'Recording started'
      );
    } catch (error) {
      console.error('启动录音失败:', error);
      notification.error(
        (uiLanguage === 'zh' ? '无法访问音频设备: ' : 'Cannot access audio device: ') + error.message
      );
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
    
    // 停止音频捕获
    stopCapture();

    setIsRecording(false);
    setIsPaused(false);

    notification.info(
      uiLanguage === 'zh' ? '录音已停止' : 'Recording stopped'
    );
  };

  /**
   * 清理资源
   */
  useEffect(() => {
    return () => {
      // 组件卸载时自动清理，useAudioCapture 会处理资源释放
      if (isRecording) {
        stopCapture();
      }
    };
  }, [isRecording, stopCapture]);

  /**
   * 语言变化时更新Hook
   */
  useEffect(() => {
    if (setCurrentLanguage) {
      setCurrentLanguage(selectedLanguage);
    }
  }, [selectedLanguage, setCurrentLanguage]);

  /**
   * 保存音频源类型到 localStorage
   */
  useEffect(() => {
    localStorage.setItem('audioSourceType', audioSourceType);
  }, [audioSourceType]);

  /**
   * 处理音频源类型变更
   */
  const handleAudioSourceChange = (newSourceType) => {
    if (isRecording) {
      // 如果正在录音，提示用户需要重新开始
      const confirmChange = window.confirm(
        uiLanguage === 'zh' 
          ? '更改音频源设置需要重新开始录音，是否继续？' 
          : 'Changing audio source requires restarting recording. Continue?'
      );
      if (!confirmChange) {
        return;
      }
      // 停止当前录音
      handleStop();
    }
    setAudioSourceType(newSourceType);
  };

  /**
   * 关闭首次使用引导
   */
  const handleCloseGuide = () => {
    setShowFirstTimeGuide(false);
    localStorage.setItem('hasSeenAudioGuide', 'true');
  };

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

const response = await fetch('/api/generate-meeting-summary', {
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

      const response = await fetch('/api/send-email', {
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

        {/* 高级设置 - 音频源选择 */}
        <div className="advanced-settings">
          <button
            className="advanced-settings-toggle"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            title={uiLanguage === 'zh' ? '自定义音频源设置' : 'Customize audio source settings'}
          >
            ⚙️ {uiLanguage === 'zh' ? '高级设置' : 'Advanced Settings'}
            <span className={`toggle-icon ${showAdvancedSettings ? 'open' : ''}`}>▼</span>
          </button>
          
          {showAdvancedSettings && (
            <div className="audio-source-settings">
              <div className="settings-header">
                <span className="settings-title">
                  {uiLanguage === 'zh' ? '音频源设置' : 'Audio Source Settings'}
                </span>
              </div>
              
              <div className="audio-source-options">
                <label className="audio-source-option">
                  <input
                    type="radio"
                    name="audioSource"
                    value={AUDIO_SOURCE_TYPES.ALL}
                    checked={audioSourceType === AUDIO_SOURCE_TYPES.ALL}
                    onChange={(e) => handleAudioSourceChange(e.target.value)}
                  />
                  <span className="option-label">
                    🎤🔊 {uiLanguage === 'zh' ? '所有音频源（推荐）' : 'All Audio Sources (Recommended)'}
                  </span>
                  <span className="option-description">
                    {uiLanguage === 'zh' ? '自动捕获麦克风和系统音频' : 'Auto capture microphone and system audio'}
                  </span>
                </label>

                <label className="audio-source-option">
                  <input
                    type="radio"
                    name="audioSource"
                    value={AUDIO_SOURCE_TYPES.MICROPHONE}
                    checked={audioSourceType === AUDIO_SOURCE_TYPES.MICROPHONE}
                    onChange={(e) => handleAudioSourceChange(e.target.value)}
                  />
                  <span className="option-label">
                    🎤 {uiLanguage === 'zh' ? '仅麦克风' : 'Microphone Only'}
                  </span>
                  <span className="option-description">
                    {uiLanguage === 'zh' ? '只录制麦克风音频' : 'Record microphone audio only'}
                  </span>
                </label>

                <label className="audio-source-option">
                  <input
                    type="radio"
                    name="audioSource"
                    value={AUDIO_SOURCE_TYPES.SYSTEM}
                    checked={audioSourceType === AUDIO_SOURCE_TYPES.SYSTEM}
                    onChange={(e) => handleAudioSourceChange(e.target.value)}
                  />
                  <span className="option-label">
                    🔊 {uiLanguage === 'zh' ? '仅系统音频' : 'System Audio Only'}
                  </span>
                  <span className="option-description">
                    {uiLanguage === 'zh' ? '只录制系统播放的音频' : 'Record system audio only'}
                  </span>
                </label>

                <label className="audio-source-option">
                  <input
                    type="radio"
                    name="audioSource"
                    value={AUDIO_SOURCE_TYPES.BOTH}
                    checked={audioSourceType === AUDIO_SOURCE_TYPES.BOTH}
                    onChange={(e) => handleAudioSourceChange(e.target.value)}
                  />
                  <span className="option-label">
                    🎤🔊 {uiLanguage === 'zh' ? '麦克风 + 系统音频' : 'Microphone + System Audio'}
                  </span>
                  <span className="option-description">
                    {uiLanguage === 'zh' ? '同时录制麦克风和系统音频' : 'Record both microphone and system audio'}
                  </span>
                </label>
              </div>
            </div>
          )}
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

        {/* 音频源状态指示器 */}
        {isRecording && (
          <div className="audio-source-status">
            <div className="status-header">
              <span className="status-title">
                {uiLanguage === 'zh' ? '音频源状态' : 'Audio Source Status'}
              </span>
            </div>
            <div className="source-status-indicators">
              {/* 麦克风状态 */}
              <div 
                className={`source-indicator ${
                  activeSourcesStatus.microphone ? 'active' : 'inactive'
                }`}
                title={uiLanguage === 'zh' 
                  ? (activeSourcesStatus.microphone ? '麦克风：活跃' : '麦克风：不可用')
                  : (activeSourcesStatus.microphone ? 'Microphone: Active' : 'Microphone: Unavailable')
                }
              >
                <span className="source-icon">🎤</span>
                <span className="source-label">
                  {uiLanguage === 'zh' ? '麦克风' : 'Microphone'}
                </span>
                <span className="source-status-badge">
                  {activeSourcesStatus.microphone
                    ? (uiLanguage === 'zh' ? '活跃' : 'Active')
                    : (uiLanguage === 'zh' ? '不可用' : 'Unavailable')
                  }
                </span>
              </div>

              {/* 系统音频状态 */}
              <div 
                className={`source-indicator ${
                  activeSourcesStatus.systemAudio ? 'active' : 'inactive'
                }`}
                title={uiLanguage === 'zh' 
                  ? (activeSourcesStatus.systemAudio ? '系统音频：活跃' : '系统音频：不可用')
                  : (activeSourcesStatus.systemAudio ? 'System Audio: Active' : 'System Audio: Unavailable')
                }
              >
                <span className="source-icon">🔊</span>
                <span className="source-label">
                  {uiLanguage === 'zh' ? '系统音频' : 'System Audio'}
                </span>
                <span className="source-status-badge">
                  {activeSourcesStatus.systemAudio
                    ? (uiLanguage === 'zh' ? '活跃' : 'Active')
                    : (uiLanguage === 'zh' ? '不可用' : 'Unavailable')
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 提示信息 */}
        {!isSupported && (
          <div className="warning-message">
            ⚠️ {t.controlPanel.browserNotSupported}
          </div>
        )}
        
        {!canCaptureMicrophone && (
          <div className="error-message">
            ❌ {uiLanguage === 'zh' 
              ? '当前浏览器不支持麦克风录音功能，请使用 Chrome、Firefox 或 Edge 浏览器' 
              : 'Current browser does not support microphone recording. Please use Chrome, Firefox, or Edge browser'}
          </div>
        )}

        {!canCaptureSystemAudio && canCaptureMicrophone && (
          <div className="warning-message">
            ⚠️ {uiLanguage === 'zh' 
              ? '当前浏览器不支持系统音频捕获，将仅使用麦克风录音' 
              : 'Current browser does not support system audio capture. Will use microphone only'}
          </div>
        )}

        {audioCaptureError && (
          <div className="error-message">
            ❌ {audioCaptureError.message}
          </div>
        )}
        
        {connectionError && enableTranscription && (
          <div className="error-message">
            ❌ {connectionError}
          </div>
        )}
      </div>

      {/* 首次使用引导提示 */}
      {showFirstTimeGuide && !isRecording && (
        <div className="first-time-guide">
          <div className="guide-content">
            <div className="guide-header">
              <span className="guide-title">{t.guide.firstTimeTitle}</span>
              <button 
                className="guide-close-btn"
                onClick={handleCloseGuide}
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>
            <p className="guide-message">{t.guide.firstTimeMessage}</p>
            <button 
              className="guide-got-it-btn"
              onClick={handleCloseGuide}
            >
              {t.guide.gotIt}
            </button>
          </div>
        </div>
      )}

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
