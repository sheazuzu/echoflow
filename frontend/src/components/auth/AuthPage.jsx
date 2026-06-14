import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { buildLanguagePath } from '../../i18n/utils.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Header from '../layout/Header.jsx';
import logo from '../../assets/logo.png';
import './AuthPage.css';

const MODE_CONFIG = {
  login: {
    titleKey: 'auth.login.title',
    descKey: 'auth.login.description',
    submitKey: 'auth.login.submit',
    path: '/login',
  },
  register: {
    titleKey: 'auth.register.title',
    descKey: 'auth.register.description',
    submitKey: 'auth.register.submit',
    path: '/register',
  },
  forgot: {
    titleKey: 'auth.forgot.title',
    descKey: 'auth.forgot.description',
    submitKey: 'auth.forgot.submit',
    path: '/forgot-password',
  },
  reset: {
    titleKey: 'auth.reset.title',
    descKey: 'auth.reset.description',
    submitKey: 'auth.reset.submit',
    path: '/reset-password',
  },
};

function getRedirectPath(locationState, lang) {
  return locationState?.from?.pathname || buildLanguagePath(lang, '/');
}

export default function AuthPage({ mode = 'login' }) {
  const { t } = useTranslation();
  const { lang = 'zh' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const [form, setForm] = useState({
    email: '',
    displayName: '',
    password: '',
    confirmPassword: '',
    token: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetTokenHint, setResetTokenHint] = useState('');

  const copywriting = MODE_CONFIG[mode] || MODE_CONFIG.login;
  const redirectPath = useMemo(() => getRedirectPath(location.state, lang), [location.state, lang]);
  const isSwitchMode = mode === 'login' || mode === 'register';

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const switchMode = (nextMode) => {
    const target = MODE_CONFIG[nextMode]?.path || '/login';
    navigate(buildLanguagePath(lang, target), { replace: true, state: location.state });
  };

  useEffect(() => {
    if (!auth.isReady) {
      return;
    }

    if (auth.isAuthenticated && (mode === 'login' || mode === 'register')) {
      navigate(redirectPath, { replace: true });
    }
  }, [auth.isAuthenticated, auth.isReady, mode, navigate, redirectPath]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setResetTokenHint('');

    if ((mode === 'register' || mode === 'reset') && form.password !== form.confirmPassword) {
      setErrorMessage(t('auth.validation.passwordMismatch'));
      return;
    }

    let response = null;

    if (mode === 'login') {
      response = await auth.login({
        email: form.email,
        password: form.password,
      });
    } else if (mode === 'register') {
      response = await auth.register({
        email: form.email,
        displayName: form.displayName,
        password: form.password,
      });
    } else if (mode === 'forgot') {
      response = await auth.requestPasswordReset({ email: form.email });
    } else if (mode === 'reset') {
      response = await auth.resetPasswordWithToken({
        token: form.token,
        newPassword: form.password,
      });
    }

    if (!response?.success) {
      setErrorMessage(response?.message || t('auth.messages.genericError'));
      return;
    }

    if (mode === 'login' || mode === 'register') {
      return;
    }

    if (mode === 'forgot') {
      setSuccessMessage(response?.data?.message || t('auth.messages.resetRequested'));
      if (response?.data?.resetToken?.token) {
        setResetTokenHint(`${t('auth.forgot.tokenHint')}${response.data.resetToken.token}`);
      }
      return;
    }

    setSuccessMessage(response?.data?.message || t('auth.messages.resetCompleted'));
    setTimeout(() => {
      navigate(buildLanguagePath(lang, '/login'), { replace: true });
    }, 1200);
  };

  return (
    <div className="auth-page">
      <Header />
      <div className="auth-page-shell">
        <section className="auth-form-card auth-form-card-elevated">
          <div className="auth-brand-lockup">
            <img src={logo} alt="MeetandNote" className="auth-brand-logo" />
            <div className="auth-brand-text">
              <span className="auth-brand-name">MeetandNote</span>
            </div>
          </div>

          <div className="auth-form-header auth-form-header-stacked">
            <div>
              <h1 className="auth-form-title">{t(copywriting.titleKey)}</h1>
              <p className="auth-form-description auth-form-description-large">{t(copywriting.descKey)}</p>
            </div>
          </div>

          {(mode === 'forgot' || mode === 'reset') && (
            <div className="auth-top-actions">
              <button
                type="button"
                className="auth-back-home-button"
                onClick={() => navigate(buildLanguagePath(lang, '/'))}
              >
                <span aria-hidden="true">←</span>
                <span>{t('nav.backHome')}</span>
              </button>
            </div>
          )}

          <form className="auth-form auth-form-spacious" onSubmit={handleSubmit}>
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <label className="auth-field auth-field-spacious">
                <span className="auth-label auth-label-strong">{t('auth.fields.email')}</span>
                <input
                  className="auth-input auth-input-large"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder={t('auth.placeholders.email')}
                  autoComplete="email"
                  required
                />
              </label>
            )}

            {mode === 'register' && (
              <label className="auth-field auth-field-spacious">
                <span className="auth-label auth-label-strong">{t('auth.fields.displayName')}</span>
                <input
                  className="auth-input auth-input-large"
                  type="text"
                  value={form.displayName}
                  onChange={(event) => updateField('displayName', event.target.value)}
                  placeholder={t('auth.placeholders.displayName')}
                  autoComplete="name"
                />
              </label>
            )}

            {mode === 'reset' && (
              <label className="auth-field auth-field-spacious">
                <span className="auth-label auth-label-strong">{t('auth.fields.resetToken')}</span>
                <input
                  className="auth-input auth-input-large"
                  type="text"
                  value={form.token}
                  onChange={(event) => updateField('token', event.target.value)}
                  placeholder={t('auth.placeholders.resetToken')}
                  autoComplete="one-time-code"
                  required
                />
              </label>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <label className="auth-field auth-field-spacious">
                <span className="auth-label auth-label-strong">{t('auth.fields.password')}</span>
                <input
                  className="auth-input auth-input-large"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder={t('auth.placeholders.password')}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </label>
            )}

            {(mode === 'register' || mode === 'reset') && (
              <label className="auth-field auth-field-spacious">
                <span className="auth-label auth-label-strong">{t('auth.fields.confirmPassword')}</span>
                <input
                  className="auth-input auth-input-large"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  placeholder={t('auth.placeholders.confirmPassword')}
                  autoComplete="new-password"
                  required
                />
              </label>
            )}

            {errorMessage && <div className="auth-error auth-feedback-box">{errorMessage}</div>}
            {successMessage && <div className="auth-success auth-feedback-box">{successMessage}</div>}
            {resetTokenHint && <div className="auth-info auth-feedback-box">{resetTokenHint}</div>}

            <div className="auth-actions auth-actions-stacked">
              <button className="auth-button auth-button-primary" type="submit" disabled={auth.isLoading}>
                <span className="auth-button-icon" aria-hidden="true">→</span>
                <span>{auth.isLoading ? t('auth.messages.submitting') : t(copywriting.submitKey)}</span>
              </button>

              {mode === 'login' && (
                <button type="button" className="auth-secondary-button auth-secondary-button-subtle" onClick={() => switchMode('forgot')}>
                  {t('auth.forgot.link')}
                </button>
              )}

              {mode === 'forgot' && (
                <button type="button" className="auth-secondary-button auth-secondary-button-subtle" onClick={() => switchMode('reset')}>
                  {t('auth.reset.link')}
                </button>
              )}
            </div>
          </form>

          {isSwitchMode && (
            <div className="auth-switch-footer">
              {mode === 'login' && (
                <button className="auth-switch-link auth-switch-link-prominent" onClick={() => switchMode('register')}>
                  {t('auth.register.switch')}
                </button>
              )}
              {mode === 'register' && (
                <button className="auth-switch-link auth-switch-link-prominent" onClick={() => switchMode('login')}>
                  {t('auth.login.switch')}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}