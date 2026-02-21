/**
 * RealtimeTranscription Component
 * 实时转录文字显示组件
 */

import React, { useRef, useEffect, useState } from 'react';
import { getI18nText } from '../../i18n/realtimeTranscription';
import './RealtimeTranscription.css';

export const RealtimeTranscription = ({
  transcriptionText = '',
  transcriptionStatus = 'idle',
  isConnected = false,
  connectionError = null,
  retryCount = 0,
  onCopy = null,
  onDownload = null,
  onClear = null,
  onGenerateSummary = null,
  onSendEmail = null,
  language = 'zh' // 新增语言参数
}) => {
  const t = getI18nText(language); // 获取国际化文本
  const textAreaRef = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);

  /**
   * 自动滚动到底部（如果用户没有手动滚动）
   */
  useEffect(() => {
    if (textAreaRef.current && !isUserScrolling) {
      textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
    }
  }, [transcriptionText, isUserScrolling]);

  /**
   * 检测用户是否手动滚动
   */
  const handleScroll = (e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    
    // 如果用户滚动到底部，恢复自动滚动
    if (isAtBottom) {
      setIsUserScrolling(false);
    } else if (element.scrollTop < lastScrollTop) {
      // 用户向上滚动
      setIsUserScrolling(true);
    }
    
    setLastScrollTop(element.scrollTop);
  };

  /**
   * 获取状态显示文本
   */
  const getStatusText = () => {
    if (connectionError) {
      return `❌ ${connectionError}${retryCount > 0 ? ` (${language === 'zh' ? '重试' : 'Retry'} ${retryCount}/3)` : ''}`;
    }
    
    switch (transcriptionStatus) {
      case 'listening':
        return `🎤 ${t.status.listening}`;
      case 'paused':
        return `⏸️ ${t.status.paused}`;
      case 'processing':
        return `⚙️ ${t.status.processing}`;
      case 'idle':
      default:
        return `⏹️ ${t.status.idle}`;
    }
  };

  /**
   * 获取占位符文本
   */
  const getPlaceholderText = () => {
    if (transcriptionStatus === 'idle') {
      return t.placeholder.idle;
    }
    if (transcriptionStatus === 'listening') {
      return t.placeholder.listening;
    }
    if (transcriptionStatus === 'paused') {
      return t.placeholder.paused;
    }
    return '';
  };

  /**
   * 获取字符计数
   */
  const getCharCount = () => {
    return transcriptionText.length;
  };

  return (
    <div className="realtime-transcription">
      {/* 标题栏 */}
      <div className="transcription-header">
        <h3 className="transcription-title">
          📝 {t.title}
          <span className="beta-badge">{t.betaBadge}</span>
        </h3>
        <div className="transcription-status">
          <span className={`status-indicator ${transcriptionStatus} ${connectionError ? 'error' : ''}`}>
            {getStatusText()}
          </span>
          {isConnected && !connectionError && (
            <span className="connection-indicator">🟢 {t.status.connected}</span>
          )}
        </div>
      </div>

      {/* 转录文字区域 */}
      <div className="transcription-content">
        <textarea
          ref={textAreaRef}
          className="transcription-text"
          value={transcriptionText}
          placeholder={getPlaceholderText()}
          onScroll={handleScroll}
          readOnly
        />
        
        {/* 用户滚动提示 */}
        {isUserScrolling && transcriptionText && (
          <div className="scroll-hint" onClick={() => setIsUserScrolling(false)}>
            ⬇️ {t.hints.scrollToBottom}
          </div>
        )}
      </div>

      {/* 底部工具栏 */}
      <div className="transcription-footer">
        <div className="char-count">
          {t.hints.charCount}: {getCharCount()}
        </div>
        
        <div className="transcription-actions">
          {onCopy && transcriptionText && (
            <button
              className="action-btn copy-btn"
              onClick={onCopy}
              title={t.titles.copyTranscription}
            >
              📋 {t.buttons.copy}
            </button>
          )}
          
          {onDownload && transcriptionText && getCharCount() > 1000 && (
            <button
              className="action-btn download-btn"
              onClick={onDownload}
              title={t.titles.downloadAsText}
            >
              💾 {t.buttons.download}
            </button>
          )}
          
          {onGenerateSummary && transcriptionText && getCharCount() >= 100 && (
            <button
              className="action-btn summary-btn"
              onClick={onGenerateSummary}
              title={t.titles.generateMeetingSummary}
            >
              📝 {t.buttons.generateSummary}
            </button>
          )}
          
          {onSendEmail && transcriptionText && getCharCount() >= 100 && (
            <button
              className="action-btn email-btn"
              onClick={onSendEmail}
              title={t.titles.sendEmail}
            >
              📧 {t.buttons.sendEmail}
            </button>
          )}
          
          {onClear && transcriptionText && (
            <button
              className="action-btn clear-btn"
              onClick={onClear}
              title={t.titles.clearTranscription}
            >
              🗑️ {t.buttons.clear}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealtimeTranscription;
