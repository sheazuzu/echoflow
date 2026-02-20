/**
 * ProgressBar 进度条组件
 * 显示百分比、预计时间
 */

import React from 'react';
import './ProgressBar.css';

const ProgressBar = ({
  progress = 0,
  showPercentage = true,
  estimatedTime = null,
  label = null,
  variant = 'primary', // primary, success, warning, danger
  size = 'medium', // small, medium, large
  className = '',
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const progressBarClasses = [
    'progress-bar',
    `progress-bar--${variant}`,
    `progress-bar--${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={progressBarClasses}>
      {(label || estimatedTime) && (
        <div className="progress-bar__header">
          {label && <span className="progress-bar__label">{label}</span>}
          {estimatedTime && (
            <span className="progress-bar__time" aria-label={`预计剩余时间 ${estimatedTime}`}>
              {estimatedTime}
            </span>
          )}
        </div>
      )}

      <div className="progress-bar__track" role="progressbar" aria-valuenow={clampedProgress} aria-valuemin="0" aria-valuemax="100">
        <div
          className="progress-bar__fill"
          style={{ width: `${clampedProgress}%` }}
        >
          {showPercentage && (
            <span className="progress-bar__percentage" aria-hidden="true">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
