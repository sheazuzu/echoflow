/**
 * ProcessingPage - 任务处理中视图
 *
 * - 通过 :fileId 调用 /api/progress 轮询获取任务状态
 * - 展示阶段标识、进度条、阶段说明、预计下一步
 * - 完成后自动跳转 ResultPage
 * - 失败时展示错误状态与恢复入口
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation, useDocumentLanguage } from '../i18n/index.js';
import { buildLanguagePath } from '../i18n/utils.js';
import Header from '../components/layout/Header.jsx';
import Footer from '../components/layout/Footer.jsx';
import ProgressBar from '../components/common/ProgressBar.jsx';
import ErrorState from '../components/result/ErrorState.jsx';
import './ProcessingPage.css';

const STEP_ORDER = ['uploading', 'splitting', 'transcribing', 'generating_summary', 'completed'];
const POLL_INTERVAL_MS = 2500;

const STEP_PROGRESS_FALLBACK = {
  uploading: 18,
  splitting: 38,
  transcribing: 65,
  generating_summary: 90,
  completed: 100,
};

// 后端会推出多种细粒度 status（如 uploading_to_cos / downloading_from_cos / preparing_audio 等）
// 前端只展示 5 个大类，避免 raw key 露出
const STATUS_GROUP = {
  uploading: 'uploading',
  uploading_to_cos: 'uploading',
  uploaded_to_cos: 'uploading',
  downloading_video: 'uploading',
  downloading_from_cos: 'uploading',
  downloaded_from_cos: 'uploading',
  processing: 'uploading',
  splitting: 'splitting',
  transcribing: 'transcribing',
  generating_summary: 'generating_summary',
  completed: 'completed',
};

const normalizeStatus = (raw) => STATUS_GROUP[raw] || 'uploading';

const ProcessingPage = () => {
  const { t } = useTranslation();
  useDocumentLanguage();
  const navigate = useNavigate();
  const { lang, fileId } = useParams();
  const currentLang = lang || 'zh';

  const [progress, setProgress] = useState({ status: 'uploading', progress: 0 });
  const [errorInfo, setErrorInfo] = useState(null);
  const timerRef = useRef(null);

  const goHome = () => navigate(buildLanguagePath(currentLang, '/'));
  const goNewTask = (type) => navigate(buildLanguagePath(currentLang, `/task/new/${type}`));

  // 轮询进度
  useEffect(() => {
    if (!fileId) return undefined;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/progress/${encodeURIComponent(fileId)}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;

        const status = data.status || 'uploading';
        const groupedStatus = normalizeStatus(status);
        const fallback = STEP_PROGRESS_FALLBACK[groupedStatus] || data.progress || 0;
        setProgress({ status: groupedStatus, progress: data.progress || fallback });

        if (groupedStatus === 'completed') {
          setTimeout(() => {
            if (!cancelled) {
              navigate(
                buildLanguagePath(currentLang, `/task/${encodeURIComponent(fileId)}/result`),
                { replace: true }
              );
            }
          }, 600);
          return;
        }

        if (status === 'failed' || status === 'error') {
          setErrorInfo({
            code: data.errorCode || 'processing_failed',
            message: data.errorMessage || data.message || '',
          });
          return;
        }

        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setErrorInfo({ code: 'network_error', message: err.message || '' });
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fileId, navigate, currentLang]);

  const stepIndex = useMemo(() => {
    const idx = STEP_ORDER.indexOf(progress.status);
    return idx === -1 ? 0 : idx;
  }, [progress.status]);

  const handleRetry = () => {
    setErrorInfo(null);
    setProgress({ status: 'uploading', progress: 0 });
  };

  // 安全获取某个 step 的 i18n 文案：拿不到则用 analyzing 兼底，永不会展示 raw key
  const stepText = (status) => {
    const key = `processing.steps.${status}`;
    const text = t(key);
    if (text && text !== key) return text;
    return t('processing.steps.analyzing');
  };

  if (errorInfo) {
    return (
      <div className="processing-page">
        <Header />
        <main className="processing-main">
          <button type="button" className="processing-back" onClick={goHome}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t('common.actions.backHome')}
          </button>
          <ErrorState
            code={errorInfo.code}
            message={errorInfo.message}
            actions={[
              { label: t('errors.actions.retry'), icon: <RefreshCw size={14} aria-hidden="true" />, onClick: handleRetry },
              { label: t('errors.actions.newTask'), onClick: () => goNewTask('upload') },
              { label: t('errors.actions.contact'), variant: 'ghost', onClick: () => goHome() },
            ]}
            videoActions={[
              { label: t('errors.actions.resubmitLink'), onClick: () => goNewTask('videoUrl') },
              { label: t('errors.actions.useUpload'), onClick: () => goNewTask('upload') },
            ]}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="processing-page">
      <Header />
      <main className="processing-main">
        <button type="button" className="processing-back" onClick={goHome}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('common.actions.backHome')}
        </button>

        <header className="processing-header">
          <span className="processing-eyebrow" aria-live="polite">
            {t('processing.title')}
          </span>
          <h1>{stepText(progress.status)}</h1>
          <p>{t('processing.nextHint')}</p>
        </header>

        <section className="processing-progress" aria-label={t('processing.title')}>
          <ProgressBar
            progress={progress.progress}
            label={stepText(progress.status)}
            variant="primary"
            size="large"
          />
        </section>

        <ol className="processing-steps" aria-label={t('processing.stepListLabel')}>
          {STEP_ORDER.filter((s) => s !== 'completed').map((step, idx) => {
            let state = 'pending';
            if (idx < stepIndex) state = 'completed';
            else if (idx === stepIndex) state = 'active';
            return (
              <li key={step} className={`processing-step state-${state}`}>
                <span className="processing-step-index" aria-hidden="true">{idx + 1}</span>
                <span className="processing-step-label">{stepText(step)}</span>
                <span className="processing-step-state-text">
                  {state === 'completed' && t('processing.stateLabels.completed')}
                  {state === 'active' && t('processing.stateLabels.active')}
                  {state === 'pending' && t('processing.stateLabels.pending')}
                </span>
              </li>
            );
          })}
        </ol>
      </main>
      <Footer />
    </div>
  );
};

export default ProcessingPage;
