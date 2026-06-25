/**
 * 视频链接转录组件
 * 用户输入 YouTube / Bilibili 视频 URL，提交后由后端下载音频、转录并生成会议纪要
 *
 * 通过 onTaskStarted(fileId, videoMeta) 把任务交接给 App.jsx 的全局进度/结果渲染逻辑
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import ProgressBar from '../common/ProgressBar.jsx';
import './VideoUrlTranscription.css';

// 与后端 backend/utils/videoUrlParser.js 保持一致的轻量级前端识别
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];
const BILIBILI_HOSTS = ['bilibili.com', 'www.bilibili.com', 'm.bilibili.com', 'b23.tv'];

function detectPlatform(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const trimmed = url.trim();
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase();
    if (YOUTUBE_HOSTS.includes(host)) return 'youtube';
    if (BILIBILI_HOSTS.includes(host)) return 'bilibili';
    return null;
  } catch {
    return null;
  }
}

function hasPlaylistHint(url) {
  if (typeof url !== 'string') return false;
  try {
    const trimmed = url.trim();
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    return parsed.searchParams.has('list') || parsed.searchParams.has('p') || parsed.searchParams.has('index');
  } catch {
    return false;
  }
}

function formatDuration(seconds) {
  const s = Number(seconds || 0);
  if (!s) return '-';
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  if (hh > 0) return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function VideoUrlTranscription({ onTaskStarted, disabled }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [videoMeta, setVideoMeta] = useState(null);
  const [submittedFileId, setSubmittedFileId] = useState('');

  const platform = useMemo(() => detectPlatform(url), [url]);
  const playlistHint = useMemo(() => hasPlaylistHint(url), [url]);

  const canSubmit = !!platform && !submitting && !disabled;

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    if (!canSubmit) return;

    setError('');
    setErrorCode('');
    setVideoMeta(null);
    setSubmittedFileId('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/video-url/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim() }),
      });

      let payload = null;
      try { payload = await response.json(); } catch { /* ignore */ }

      if (!response.ok || !payload || (payload.code && payload.code !== 200)) {
        const code = (payload && payload.errorCode) || 'unknown';
        setErrorCode(code);
        const i18nKey = `videoUrl.errors.${code}`;
        const fallback = (payload && payload.message) || t('videoUrl.errors.unknown');
        const translated = t(i18nKey);
        // 当没有命中翻译时退回到后端返回的中文消息
        const finalMsg = (translated && translated !== i18nKey) ? translated : fallback;
        throw new Error(finalMsg);
      }

      setVideoMeta(payload.videoMeta || null);
      setSubmittedFileId(payload.fileId || '');

      if (typeof onTaskStarted === 'function') {
        onTaskStarted(payload.fileId, payload.videoMeta, { cached: !!payload.cached });
      }
    } catch (err) {
      const msg = err && err.message ? err.message : t('videoUrl.errors.unknown');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const platformLabel = platform === 'youtube'
    ? t('videoUrl.platform.youtube')
    : platform === 'bilibili'
      ? t('videoUrl.platform.bilibili')
      : (url ? t('videoUrl.platform.unsupported') : '');

  const platformClass = platform === 'youtube' ? 'badge-youtube'
    : platform === 'bilibili' ? 'badge-bilibili'
    : (url ? 'badge-unsupported' : 'badge-idle');

  const platformEmoji = platform === 'youtube' ? '🎬'
    : platform === 'bilibili' ? '📺'
    : (url ? '⚠️' : '');

  return (
    <section className="video-url-module">
      <form className="video-url-card" onSubmit={handleSubmit}>
        <div className="video-url-header">
          <div className="video-url-icon" aria-hidden="true">📺</div>
          <div className="video-url-header-text">
            <h2 className="video-url-title">{t('videoUrl.title')}</h2>
            <p className="video-url-subtitle">{t('videoUrl.subtitle')}</p>
            <div className="video-url-platforms">
              <span className="video-url-platform-chip youtube">
                <span className="dot" /> YouTube
              </span>
              <span className="video-url-platform-chip bilibili">
                <span className="dot" /> Bilibili
              </span>
            </div>
          </div>
        </div>

        <div className="video-url-input-wrap">
          <span className="video-url-input-icon" aria-hidden="true">🔗</span>
          <input
            type="url"
            className="video-url-input"
            placeholder={t('videoUrl.urlPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={submitting || disabled}
            spellCheck={false}
            autoComplete="off"
          />
          {url && !submitting && (
            <button
              type="button"
              className="video-url-clear-btn"
              onClick={() => { setUrl(''); setError(''); setVideoMeta(null); setSubmittedFileId(''); }}
              aria-label="clear"
              title="Clear"
            >
              ✕
            </button>
          )}
          {url && (
            <span className={`video-url-badge ${platformClass}`}>
              {platformEmoji && <span aria-hidden="true">{platformEmoji}</span>}
              {platformLabel}
            </span>
          )}
        </div>

        {playlistHint && platform && (
          <div className="video-url-hint">
            <span className="video-url-hint-icon" aria-hidden="true">ℹ️</span>
            <span>{t('videoUrl.hints.playlistOnlyCurrent')}</span>
          </div>
        )}

        <div className="video-url-actions">
          <button
            type="submit"
            className="video-url-submit-btn"
            disabled={!canSubmit}
          >
            {submitting && <span className="video-url-spinner" aria-hidden="true" />}
            {submitting ? t('videoUrl.submitting') : t('videoUrl.submit')}
          </button>
        </div>

        {error && (
          <div className="video-url-error" role="alert">
            <span className="video-url-error-icon" aria-hidden="true">⚠️</span>
            <span><strong>{t('videoUrl.errorLabel')}：</strong>{error}</span>
          </div>
        )}

        {videoMeta && (
          <div className="video-url-meta-card">
            {videoMeta.thumbnail && (
              <div className="video-url-thumb">
                <img src={videoMeta.thumbnail} alt={videoMeta.title || ''} loading="lazy" />
              </div>
            )}
            <div className="video-url-meta-body">
              <div className="video-url-meta-title">{videoMeta.title || '-'}</div>
              <div className="video-url-meta-row">
                <span className="video-url-meta-tag">
                  <span className="tag-label">{t('videoUrl.meta.platform')}:</span>
                  <span className="tag-value">{videoMeta.platform || '-'}</span>
                </span>
                <span className="video-url-meta-tag">
                  <span className="tag-label">{t('videoUrl.meta.duration')}:</span>
                  <span className="tag-value">{formatDuration(videoMeta.duration)}</span>
                </span>
                {videoMeta.uploader && (
                  <span className="video-url-meta-tag">
                    <span className="tag-label">{t('videoUrl.meta.uploader')}:</span>
                    <span className="tag-value">{videoMeta.uploader}</span>
                  </span>
                )}
              </div>
              {submittedFileId && (
                <div className="video-url-task-note" title={submittedFileId}>
                  ✓ {t('videoUrl.taskStarted', { fileId: submittedFileId })}
                </div>
              )}
            </div>
          </div>
        )}

        {submitting && (
          <div className="video-url-progress">
            <ProgressBar progress={5} label={t('videoUrl.progress.fetchingMeta')} variant="primary" size="medium" />
          </div>
        )}
      </form>
    </section>
  );
}
