/**
 * Button 通用按钮组件
 * 支持加载状态、禁用状态、不同样式
 */

import React from 'react';
import './Button.css';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // primary, secondary, danger, success, ghost
  size = 'medium', // small, medium, large
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left', // left, right
  fullWidth = false,
  className = '',
  ariaLabel,
  ...props
}) => {
  const handleClick = (event) => {
    if (!disabled && !loading && onClick) {
      onClick(event);
    }
  };

  const buttonClasses = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth && 'button--full-width',
    loading && 'button--loading',
    disabled && 'button--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="button__spinner" aria-hidden="true">
          <svg className="button__spinner-icon" viewBox="0 0 24 24">
            <circle
              className="button__spinner-circle"
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="3"
            />
          </svg>
        </span>
      )}

      {!loading && icon && iconPosition === 'left' && (
        <span className="button__icon button__icon--left" aria-hidden="true">
          {icon}
        </span>
      )}

      <span className="button__text">{children}</span>

      {!loading && icon && iconPosition === 'right' && (
        <span className="button__icon button__icon--right" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
};

export default Button;
