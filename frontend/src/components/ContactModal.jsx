import React, { useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import './ContactModal.css';

const ContactModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = t('contactModal.nameRequired');
    if (!form.email.trim()) {
      newErrors.email = t('contactModal.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = t('contactModal.emailInvalid');
    }
    if (!form.message.trim()) {
      newErrors.message = t('contactModal.messageRequired');
    } else if (form.message.trim().length < 10) {
      newErrors.message = t('contactModal.messageTooShort');
    } else if (form.message.trim().length > 5000) {
      newErrors.message = t('contactModal.messageTooLong');
    }
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/send-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
          // 收件人为产品邮箱（SMTP_USER），由后端环境变量决定
          recipients: ['sheazuzu@hotmail.com'],
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setSubmitError(data.message || t('contactModal.submitFailed'));
      }
    } catch {
      setSubmitError(t('contactModal.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ name: '', email: '', message: '' });
    setErrors({});
    setSubmitted(false);
    setSubmitError('');
    onClose();
  };

  return (
    <div className="contact-modal-overlay" onClick={handleClose}>
      <div className="contact-modal" onClick={e => e.stopPropagation()}>
        {/* 关闭按钮 */}
        <button className="contact-modal-close" onClick={handleClose} aria-label="关闭">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {submitted ? (
          /* 提交成功状态 */
          <div className="contact-modal-success">
            <div className="success-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="#6366f1" fillOpacity="0.1"/>
                <path d="M14 24l7 7 13-13" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>{t('contactModal.successTitle')}</h3>
            <p>{t('contactModal.successMessage')}</p>
            <button className="contact-modal-btn-primary" onClick={handleClose}>
              {t('common.buttons.close')}
            </button>
          </div>
        ) : (
          /* 表单 */
          <>
            <div className="contact-modal-header">
              <h2>{t('contactModal.title')}</h2>
              <p>{t('contactModal.subtitle')}</p>
            </div>

            <form className="contact-modal-form" onSubmit={handleSubmit} noValidate>
              {/* 姓名 */}
              <div className={`form-field ${errors.name ? 'has-error' : ''}`}>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder={t('contactModal.namePlaceholder')}
                  maxLength={100}
                  autoComplete="name"
                />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              {/* 邮箱 */}
              <div className={`form-field ${errors.email ? 'has-error' : ''}`}>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={t('contactModal.emailPlaceholder')}
                  maxLength={200}
                  autoComplete="email"
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              {/* 反馈内容 */}
              <div className={`form-field ${errors.message ? 'has-error' : ''}`}>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder={t('contactModal.messagePlaceholder')}
                  rows={5}
                  maxLength={5000}
                />
                <div className="char-count">{form.message.length} / 5000</div>
                {errors.message && <span className="field-error">{errors.message}</span>}
              </div>

              {/* 提交错误 */}
              {submitError && (
                <div className="submit-error">{submitError}</div>
              )}

              {/* 提交按钮 */}
              <button
                type="submit"
                className="contact-modal-btn-primary"
                disabled={submitting}
              >
                {submitting ? t('contactModal.submitting') : t('contactModal.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ContactModal;
