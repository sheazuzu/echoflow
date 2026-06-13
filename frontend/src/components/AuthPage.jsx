import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { buildLanguagePath } from '../i18n/utils.js';
import logo from '../assets/logo.png';
import './AuthPage.css';

const AuthPage = ({ initialMode = 'login' }) => {
  const navigate = useNavigate();
  const { lang } = useParams();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const homePath = buildLanguagePath(lang || 'zh', '/');
  const nextPath = searchParams.get('next') || homePath;

  const copy = useMemo(() => {
    if (mode === 'register') {
      return {
        title: '创建账号',
        subtitle: '保存你的会议记录、转写文本和 AI 纪要。',
        action: '注册并开始使用',
        toggleText: '已经有账号？',
        toggleAction: '登录',
        icon: <UserPlus size={18} />,
      };
    }

    return {
      title: '登录 MeetandNote',
      subtitle: '继续处理会议音频，查看你的个人工作区。',
      action: '登录',
      toggleText: '还没有账号？',
      toggleAction: '注册',
      icon: <LogIn size={18} />,
    };
  }, [mode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = mode === 'register'
        ? await register(form)
        : await login({ email: form.email, password: form.password });

      if (!response.success) {
        setError(response.message || response.error?.message || '认证失败，请稍后重试');
        return;
      }

      navigate(nextPath, { replace: true });
    } catch (error) {
      setError(error.message || '认证失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModeToggle = () => {
    setError('');
    setMode(mode === 'register' ? 'login' : 'register');
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link to={homePath} className="auth-brand" aria-label="MeetandNote home">
          <img src={logo} alt="MeetandNote" />
          <span>MeetandNote</span>
        </Link>

        <div className="auth-copy">
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              <span>姓名</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="你的名字"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            <span>邮箱</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>密码</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="至少 8 个字符"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {copy.icon}
            <span>{submitting ? '处理中...' : copy.action}</span>
          </button>
        </form>

        <div className="auth-switch">
          <span>{copy.toggleText}</span>
          <button type="button" onClick={handleModeToggle}>{copy.toggleAction}</button>
        </div>
      </section>
    </main>
  );
};

export default AuthPage;
