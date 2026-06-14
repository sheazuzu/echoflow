import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { buildLanguagePath } from '../../i18n/utils.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import './AuthPage.css';

export default function AccountSettingsPage() {
  const { t } = useTranslation();
  const { lang = 'zh' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth.user;

  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName || '',
    timezone: user?.profile?.timezone || '',
    bio: user?.profile?.bio || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const metaRows = useMemo(() => ([
    { label: t('account.meta.email'), value: user?.email || '-' },
    { label: t('account.meta.role'), value: user?.role || '-' },
    { label: t('account.meta.createdAt'), value: user?.createdAt || '-' },
    { label: t('account.meta.lastLoginAt'), value: user?.lastLoginAt || '-' },
  ]), [t, user]);

  const updateProfileField = (key, value) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePasswordField = (key, value) => {
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setProfileMessage('');

    const response = await auth.updateAccountProfile(profileForm);
    if (!response?.success) {
      setErrorMessage(response?.message || t('account.messages.profileError'));
      return;
    }

    setProfileMessage(response?.data?.message || t('account.messages.profileSaved'));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setPasswordMessage('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage(t('auth.validation.passwordMismatch'));
      return;
    }

    const response = await auth.updateAccountPassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });

    if (!response?.success) {
      setErrorMessage(response?.message || t('account.messages.passwordError'));
      return;
    }

    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordMessage(response?.data?.message || t('account.messages.passwordSaved'));
  };

  return (
    <div className="auth-page">
      <div className="auth-card-grid" style={{ maxWidth: 1080, margin: '0 auto' }}>
        <section className="auth-section-card">
          <div className="auth-eyebrow">{t('account.eyebrow')}</div>
          <div className="auth-top-actions auth-top-actions-inline">
            <button
              type="button"
              className="auth-back-home-button"
              onClick={() => navigate(buildLanguagePath(lang, '/'))}
            >
              <span aria-hidden="true">←</span>
              <span>{t('nav.backHome')}</span>
            </button>
          </div>
          <h1 className="auth-title" style={{ marginBottom: 10 }}>{t('account.title')}</h1>
          <p className="auth-subtitle">{t('account.description')}</p>

          <div className="auth-profile-meta">
            {metaRows.map((row) => (
              <div key={row.label}><strong>{row.label}</strong>：{row.value}</div>
            ))}
          </div>
        </section>

        <section className="auth-section-card">
          <h2 className="auth-section-title">{t('account.profile.title')}</h2>
          <p className="auth-section-desc">{t('account.profile.description')}</p>
          <form className="auth-form" onSubmit={handleProfileSubmit}>
            <label className="auth-field">
              <span className="auth-label">{t('auth.fields.displayName')}</span>
              <input className="auth-input" value={profileForm.displayName} onChange={(event) => updateProfileField('displayName', event.target.value)} />
            </label>
            <label className="auth-field">
              <span className="auth-label">{t('account.profile.timezone')}</span>
              <input className="auth-input" value={profileForm.timezone} onChange={(event) => updateProfileField('timezone', event.target.value)} placeholder={t('account.profile.timezonePlaceholder')} />
            </label>
            <label className="auth-field">
              <span className="auth-label">{t('account.profile.bio')}</span>
              <textarea className="auth-textarea" value={profileForm.bio} onChange={(event) => updateProfileField('bio', event.target.value)} placeholder={t('account.profile.bioPlaceholder')} />
            </label>
            {errorMessage && <div className="auth-error">{errorMessage}</div>}
            {profileMessage && <div className="auth-success">{profileMessage}</div>}
            <div className="auth-actions">
              <button className="auth-button" type="submit" disabled={auth.isLoading}>{t('account.profile.submit')}</button>
            </div>
          </form>
        </section>

        <section className="auth-section-card">
          <h2 className="auth-section-title">{t('account.password.title')}</h2>
          <p className="auth-section-desc">{t('account.password.description')}</p>
          <form className="auth-form" onSubmit={handlePasswordSubmit}>
            <label className="auth-field">
              <span className="auth-label">{t('account.password.current')}</span>
              <input className="auth-input" type="password" value={passwordForm.currentPassword} onChange={(event) => updatePasswordField('currentPassword', event.target.value)} />
            </label>
            <label className="auth-field">
              <span className="auth-label">{t('account.password.new')}</span>
              <input className="auth-input" type="password" value={passwordForm.newPassword} onChange={(event) => updatePasswordField('newPassword', event.target.value)} />
            </label>
            <label className="auth-field">
              <span className="auth-label">{t('auth.fields.confirmPassword')}</span>
              <input className="auth-input" type="password" value={passwordForm.confirmPassword} onChange={(event) => updatePasswordField('confirmPassword', event.target.value)} />
            </label>
            {errorMessage && <div className="auth-error">{errorMessage}</div>}
            {passwordMessage && <div className="auth-success">{passwordMessage}</div>}
            <div className="auth-actions">
              <button className="auth-button" type="submit" disabled={auth.isLoading}>{t('account.password.submit')}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}