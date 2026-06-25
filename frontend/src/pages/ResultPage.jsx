/**
 * ResultPage - 结果聚焦页
 *
 * 通过 :fileId 调用 /api/minutes 获取纪要数据，并展示给用户
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation, useDocumentLanguage } from '../i18n/index.js';
import { buildLanguagePath } from '../i18n/utils.js';
import Header from '../components/layout/Header.jsx';
import Footer from '../components/layout/Footer.jsx';
import MeetingResultView from '../components/result/MeetingResultView.jsx';
import ErrorState from '../components/result/ErrorState.jsx';
import './ResultPage.css';

const ResultPage = () => {
  const { t } = useTranslation();
  useDocumentLanguage();
  const navigate = useNavigate();
  const { lang, fileId } = useParams();
  const currentLang = lang || 'zh';

  const [loading, setLoading] = useState(true);
  const [minutesData, setMinutesData] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [errorInfo, setErrorInfo] = useState(null);

  const goHome = () => navigate(buildLanguagePath(currentLang, '/'));
  const goHistory = () => navigate(buildLanguagePath(currentLang, '/history'));
  const goNewTask = (type) => navigate(buildLanguagePath(currentLang, `/task/new/${type}`));

  const loadResult = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setErrorInfo(null);
    try {
      const response = await fetch(`/api/minutes/${encodeURIComponent(fileId)}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      // 后端 /api/minutes/:fileId 返回 { fileId, status, minutesData, transcript }
      // 兼容历史字段名（minutes / data）
      setMinutesData(data?.minutesData || data?.minutes || data?.data || null);
      setTranscript(data?.transcript || '');
    } catch (err) {
      setErrorInfo({ code: 'processing_failed', message: err.message || '' });
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  const handleDownload = async () => {
    try {
      const blob = new Blob(
        [JSON.stringify(minutesData, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileId || 'minutes'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="result-page">
      <Header />
      <main className="result-main">
        <button type="button" className="result-back" onClick={goHome}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('common.actions.backHome')}
        </button>

        <header className="result-header">
          <h1>{t('result.title')}</h1>
          <p className="result-subtitle">{fileId}</p>
        </header>

        {loading ? (
          <div className="result-loading" aria-live="polite">{t('common.labels.loading')}</div>
        ) : errorInfo ? (
          <ErrorState
            code={errorInfo.code}
            message={errorInfo.message}
            actions={[
              { label: t('errors.actions.retry'), icon: <RefreshCw size={14} aria-hidden="true" />, onClick: loadResult },
              { label: t('errors.actions.newTask'), onClick: () => goNewTask('upload') },
              { label: t('errors.actions.history'), variant: 'ghost', onClick: goHistory },
            ]}
            videoActions={[
              { label: t('errors.actions.resubmitLink'), onClick: () => goNewTask('videoUrl') },
              { label: t('errors.actions.useUpload'), onClick: () => goNewTask('upload') },
            ]}
          />
        ) : (
          <MeetingResultView
            minutesData={minutesData}
            transcript={transcript}
            onBack={goHome}
            onGoHistory={goHistory}
            onDownload={handleDownload}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ResultPage;
