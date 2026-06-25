/**
 * NewTaskPage - 新建任务入口
 *
 * 根据路由参数 :type 渲染对应输入面板
 *  - upload    → 文件上传（直接 POST /api/upload，启动后跳 ProcessingPage）
 *  - videoUrl  → 视频链接（沿用 VideoUrlTranscription，提交成功后跳 ProcessingPage）
 *
 * 注意：录音流程仍在 App.jsx 中实现，因此 HomePage 上的"录音"入口直接跳转到 /legacy?tab=recording，
 *   不会再进入本页，避免出现"先到这里再二次跳转"的多余跳板。
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Link2 } from 'lucide-react';
import { useTranslation, useDocumentLanguage, getCurrentLanguage } from '../i18n/index.js';
import { buildLanguagePath } from '../i18n/utils.js';
import Header from '../components/layout/Header.jsx';
import Footer from '../components/layout/Footer.jsx';
import VideoUrlTranscription from '../components/videoUrl/VideoUrlTranscription.jsx';
import './NewTaskPage.css';

const SUPPORTED_TYPES = ['upload', 'videoUrl'];

const TYPE_META = {
  upload: { icon: Upload, key: 'upload' },
  videoUrl: { icon: Link2, key: 'videoUrl' },
};

const NewTaskPage = () => {
  const { t } = useTranslation();
  useDocumentLanguage();
  const navigate = useNavigate();
  const { lang, type } = useParams();
  const currentLang = lang || getCurrentLanguage();
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  // 录音类型直接跳 legacy；其他不支持的类型 → 回首页
  useEffect(() => {
    if (type === 'recording') {
      navigate(buildLanguagePath(currentLang, '/legacy?tab=recording'), { replace: true });
      return;
    }
    if (!SUPPORTED_TYPES.includes(type)) {
      navigate(buildLanguagePath(currentLang, '/'), { replace: true });
    }
  }, [type, navigate, currentLang]);

  const meta = SUPPORTED_TYPES.includes(type) ? TYPE_META[type] : null;
  const Icon = meta ? meta.icon : null;

  const goHome = () => {
    navigate(buildLanguagePath(currentLang, '/'));
  };

  const goProcessing = (fileId) => {
    navigate(buildLanguagePath(currentLang, `/task/${encodeURIComponent(fileId)}/processing`));
  };

  const handleUpload = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      // 后端 /api/upload 路由使用 multer.single('file')，字段名必须是 file
      formData.append('file', file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
      if (!response.ok || !data || !data.fileId) {
        const msg = (data && data.message) || text || t('errors.processingFailed');
        throw new Error(msg);
      }
      goProcessing(data.fileId);
    } catch (err) {
      setError(err.message || t('errors.unknownError'));
    } finally {
      setUploading(false);
    }
  };

  const handleVideoTaskStarted = (fileId) => {
    if (fileId) goProcessing(fileId);
  };

  if (!meta) return null;

  return (
    <div className="new-task-page">
      <Header />
      <main className="new-task-main">
        <button type="button" className="new-task-back" onClick={goHome} aria-label={t('newTask.back')}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('newTask.back')}
        </button>

        <header className="new-task-header">
          <div className="new-task-icon" aria-hidden="true">
            {Icon ? <Icon size={26} /> : null}
          </div>
          <div>
            <h1 className="new-task-title">{t(`newTask.${meta.key}.title`)}</h1>
            <p className="new-task-desc">{t(`newTask.${meta.key}.description`)}</p>
          </div>
        </header>

        {error && (
          <div className="new-task-error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <section className="new-task-body">
          {type === 'upload' && (
            <div className="new-task-upload">
              <label className={`new-task-upload-zone ${uploading ? 'is-loading' : ''}`}>
                <Upload size={36} aria-hidden="true" />
                <span className="new-task-upload-title">
                  {uploading ? t('upload.uploading') : t('upload.dragDropHint')}
                </span>
                <span className="new-task-upload-hint">
                  {t('upload.supportedFormats')}
                </span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.webm"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="new-task-file-input"
                />
              </label>
            </div>
          )}

          {type === 'videoUrl' && (
            <VideoUrlTranscription
              onTaskStarted={(fileId) => handleVideoTaskStarted(fileId)}
              disabled={uploading}
            />
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default NewTaskPage;
