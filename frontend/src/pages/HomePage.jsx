/**
 * HomePage - 任务驱动首页
 *
 * - 三类主入口：录音 / 上传 / 视频链接
 * - 最近任务（最多 5 条），点击跳转 ResultPage / ProcessingPage
 * - 不再渲染实时转录入口，符合 8.x 范围收敛要求
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, Upload, Link2, Clock, ChevronRight, History } from 'lucide-react';
import { useTranslation, useDocumentLanguage } from '../i18n/index.js';
import { buildLanguagePath } from '../i18n/utils.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import authService from '../services/authService.js';
import Header from '../components/layout/Header.jsx';
import Footer from '../components/layout/Footer.jsx';
import FirstUseGuide from '../components/onboarding/FirstUseGuide.jsx';
import EmptyState from '../components/onboarding/EmptyState.jsx';
import './HomePage.css';

const RECENT_TASKS_LIMIT = 5;

const HomePage = () => {
  const { t } = useTranslation();
  useDocumentLanguage();
  const navigate = useNavigate();
  const { lang } = useParams();
  const auth = useAuth();
  const currentLang = lang || 'zh';

  const [recentTasks, setRecentTasks] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const goToNewTask = (type) => {
    // 录音流程因为依赖现有 App.jsx 的录音/上传/进度状态机，目前直接跳到 legacy 主界面，
    // 避免出现"先进入 NewTaskPage 再跳一次"的多余跳板，简化用户体验。
    if (type === 'recording') {
      navigate(buildLanguagePath(currentLang, '/legacy?tab=recording'));
      return;
    }
    navigate(buildLanguagePath(currentLang, `/task/new/${type}`));
  };

  const goToHistory = () => {
    navigate(buildLanguagePath(currentLang, '/history'));
  };

  const goToTaskView = (record) => {
    if (!record || !record.fileId) return;
    if (record.status === 'completed') {
      navigate(buildLanguagePath(currentLang, `/task/${encodeURIComponent(record.fileId)}/result`));
    } else if (record.status === 'failed' || record.status === 'cancelled') {
      navigate(buildLanguagePath(currentLang, `/task/${encodeURIComponent(record.fileId)}/result`));
    } else {
      navigate(buildLanguagePath(currentLang, `/task/${encodeURIComponent(record.fileId)}/processing`));
    }
  };

  // 加载最近任务
  useEffect(() => {
    let cancelled = false;
    if (!auth.isAuthenticated) {
      setRecentTasks([]);
      return undefined;
    }
    setLoadingRecent(true);
    authService
      .getHistory({ page: 1, pageSize: RECENT_TASKS_LIMIT })
      .then((response) => {
        if (cancelled) return;
        if (response && response.success) {
          setRecentTasks(response.data?.items || []);
        } else {
          setRecentTasks([]);
        }
      })
      .catch(() => {
        if (!cancelled) setRecentTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated]);

  const entryCards = useMemo(() => ([
    {
      key: 'recording',
      icon: <Mic size={28} aria-hidden="true" />,
      title: t('home.entries.recording.title'),
      description: t('home.entries.recording.description'),
      cta: t('home.entries.recording.cta'),
      tone: 'tone-recording',
    },
    {
      key: 'upload',
      icon: <Upload size={28} aria-hidden="true" />,
      title: t('home.entries.upload.title'),
      description: t('home.entries.upload.description'),
      cta: t('home.entries.upload.cta'),
      tone: 'tone-upload',
    },
    {
      key: 'videoUrl',
      icon: <Link2 size={28} aria-hidden="true" />,
      title: t('home.entries.videoUrl.title'),
      description: t('home.entries.videoUrl.description'),
      cta: t('home.entries.videoUrl.cta'),
      tone: 'tone-video',
    },
  ]), [t]);

  return (
    <div className="home-page">
      <Header />
      <main className="home-main" id="home">
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero-text">
            <h1 id="home-hero-title">{t('home.hero.title')}</h1>
            <p>{t('home.hero.subtitle')}</p>
          </div>
          <div className="home-hero-actions">
            <span className="home-hero-legacy-hint">{t('home.hero.legacyHint')}</span>
            <button
              type="button"
              className="home-hero-legacy-btn"
              onClick={() => navigate(buildLanguagePath(currentLang, '/legacy'))}
              aria-label={t('home.hero.legacyButton')}
            >
              <History size={16} aria-hidden="true" />
              {t('home.hero.legacyButton')}
            </button>
          </div>
        </section>

        <section className="home-entries" aria-label={t('home.entries.sectionLabel')}>
          {entryCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`home-entry-card ${card.tone}`}
              onClick={() => goToNewTask(card.key)}
              aria-label={card.title}
            >
              <div className="home-entry-icon" aria-hidden="true">{card.icon}</div>
              <div className="home-entry-body">
                <h3 className="home-entry-title">{card.title}</h3>
                <p className="home-entry-desc">{card.description}</p>
              </div>
              <span className="home-entry-cta">
                {card.cta}
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            </button>
          ))}
        </section>

        <section className="home-recent" aria-labelledby="home-recent-title">
          <div className="home-recent-header">
            <h2 id="home-recent-title">
              <Clock size={18} aria-hidden="true" />
              {t('home.recent.title')}
            </h2>
            {recentTasks.length > 0 && (
              <button type="button" className="home-recent-link" onClick={goToHistory}>
                {t('home.recent.viewAll')}
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {loadingRecent ? (
            <div className="home-recent-empty" aria-live="polite">
              {t('common.labels.loading')}
            </div>
          ) : recentTasks.length === 0 ? (
            <EmptyState
              variant="home"
              title={t('emptyState.home.title')}
              description={t('emptyState.home.description')}
              actionLabel={t('emptyState.home.action')}
              onAction={() => goToNewTask('upload')}
            />
          ) : (
            <ul className="home-recent-list">
              {recentTasks.map((record) => (
                <li key={record.id || record.fileId} className="home-recent-item">
                  <button
                    type="button"
                    className="home-recent-row"
                    onClick={() => goToTaskView(record)}
                  >
                    <div className="home-recent-row-main">
                      <div className="home-recent-row-title">{record.title || record.fileId || '-'}</div>
                      <div className="home-recent-row-meta">
                        <span className={`home-recent-status status-${record.status}`}>
                          {t(`history.statuses.${record.status}`) || record.status}
                        </span>
                        <span className="home-recent-type">
                          {t(`history.activityTypes.${record.activityType}`) || record.activityType}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
      <FirstUseGuide
        onStart={(type) => goToNewTask(type)}
      />
    </div>
  );
};

export default HomePage;
