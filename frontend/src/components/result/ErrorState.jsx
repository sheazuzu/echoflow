/**
 * ErrorState - 失败态恢复组件
 *
 * 按错误码渲染用户可读文案 + 推荐恢复操作
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../i18n/index.js';
import './ErrorState.css';

const VIDEO_RELATED_CODES = new Set([
  'video_unavailable',
  'video_url_invalid',
  'video_download_failed',
  'video_meta_failed',
  'platform_not_supported',
  'live_video_unsupported',
  'private_video',
  'age_restricted',
]);

const ErrorState = ({
  code = 'unknown',
  message = '',
  actions = [],
  videoActions = [],
}) => {
  const { t } = useTranslation();

  const i18nTitleKey = `errors.codes.${code}.title`;
  const i18nDescKey = `errors.codes.${code}.description`;

  const title = t(i18nTitleKey);
  const description = t(i18nDescKey);

  const finalTitle = title && title !== i18nTitleKey ? title : t('errors.codes.unknown.title');
  const finalDescription = description && description !== i18nDescKey ? description : (message || t('errors.codes.unknown.description'));

  const isVideoIssue = VIDEO_RELATED_CODES.has(code);
  const finalActions = isVideoIssue && videoActions.length > 0 ? videoActions : actions;

  return (
    <div className="error-state" role="alert" aria-live="assertive">
      <div className="error-state-icon" aria-hidden="true">
        <AlertTriangle size={28} />
      </div>
      <h2 className="error-state-title">{finalTitle}</h2>
      <p className="error-state-desc">{finalDescription}</p>
      {message && message !== finalDescription && (
        <p className="error-state-detail">{message}</p>
      )}
      {finalActions.length > 0 && (
        <div className="error-state-actions">
          {finalActions.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              type="button"
              className={`error-state-btn ${action.variant === 'ghost' ? 'is-ghost' : action.variant === 'primary' ? 'is-primary' : ''}`}
              onClick={action.onClick}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ErrorState;
