/**
 * EmptyState - 空状态教育组件
 *
 * 在历史记录或最近任务为空时使用，告知用户支持的输入方式与下一步操作。
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import './EmptyState.css';

const EmptyState = ({
  variant = 'default',
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className={`empty-state empty-state-${variant}`}>
      <div className="empty-state-icon" aria-hidden="true">
        {icon || <Sparkles size={26} />}
      </div>
      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-desc">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="empty-state-btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
