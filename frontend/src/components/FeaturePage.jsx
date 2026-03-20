import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import Header from './layout/Header.jsx';
import Footer from './layout/Footer.jsx';
import { buildLanguagePath } from '../i18n/utils.js';
import './FeaturePage.css';

// 每个功能模块对应的主题色（与首页保持一致）
const FEATURE_COLORS = [
  { accent: '#0066CC', bg: 'rgba(0, 102, 204, 0.08)' },   // 蓝色 - 录音上传
  { accent: '#7B2FBE', bg: 'rgba(123, 47, 190, 0.08)' },  // 紫色 - AI转录
  { accent: '#28A745', bg: 'rgba(40, 167, 69, 0.08)' },   // 绿色 - 会议纪要
  { accent: '#E67E22', bg: 'rgba(230, 126, 34, 0.08)' },  // 橙色 - 邮件发送
  { accent: '#DC3545', bg: 'rgba(220, 53, 69, 0.08)' },   // 红色 - 实时转录
];

// 双语功能卡片数据（从 i18n 文件中抽离，避免 translate() 的字符串类型限制）
const FEATURES_DATA = {
  zh: [
    {
      icon: '🎙️',
      title: '音频录制与上传',
      description: '支持多种音频格式，灵活满足不同场景的录音需求。',
      points: [
        '支持 MP3、M4A、WAV、WebM 等主流音频格式',
        '拖拽上传，操作简单直观',
        '浏览器内实时录音，无需安装额外软件',
        '支持麦克风与系统声音双音源录制',
        '最大支持 100MB 文件，自动智能分片处理',
      ],
    },
    {
      icon: '🤖',
      title: 'AI 语音转录',
      description: '基于 OpenAI Whisper 模型，提供高精度、多语言的语音识别能力。',
      points: [
        '基于 Whisper 大模型，识别准确率业界领先',
        '支持中文、英文及多种语言自动识别',
        '智能音频分片，突破大文件处理限制',
        '保留原始转录文本，方便核对与编辑',
      ],
    },
    {
      icon: '📝',
      title: '结构化会议纪要',
      description: 'AI 自动生成 8 点结构化会议纪要，覆盖会议全貌。',
      points: [
        '自动提取会议主题、时间、参会人员',
        '生成会议摘要、关键要点、决策事项',
        '整理待办事项与后续步骤，责任到人',
        '输出标准 Markdown 格式，便于复制与分享',
        '支持一键复制全文内容',
      ],
    },
    {
      icon: '📧',
      title: '邮件发送',
      description: '一键将会议纪要发送给所有参会人员，高效协作。',
      points: [
        '支持添加多个收件人，批量发送',
        '自动生成邮件主题，包含会议日期',
        '可附加自定义消息，灵活补充说明',
        '发送状态实时反馈，确保送达',
      ],
    },
    {
      icon: '⚡',
      title: '实时转录',
      description: '录音的同时实时将语音转为文字，即说即看。',
      points: [
        '录音过程中同步显示转录文字',
        '低延迟实时反馈，提升会议效率',
        '转录结果可直接用于生成会议纪要',
        '当前为 BETA 功能，持续优化中',
      ],
    },
  ],
  en: [
    {
      icon: '🎙️',
      title: 'Audio Recording & Upload',
      description: 'Supports multiple audio formats to flexibly meet recording needs in different scenarios.',
      points: [
        'Supports MP3, M4A, WAV, WebM and other mainstream audio formats',
        'Drag-and-drop upload for simple and intuitive operation',
        'In-browser real-time recording, no additional software required',
        'Supports both microphone and system audio recording',
        'Up to 100MB files with automatic intelligent chunking',
      ],
    },
    {
      icon: '🤖',
      title: 'AI Speech Transcription',
      description: 'Powered by OpenAI Whisper model for high-accuracy, multi-language speech recognition.',
      points: [
        'Based on Whisper large model with industry-leading accuracy',
        'Supports Chinese, English and multiple languages with auto-detection',
        'Smart audio chunking to handle large files without limits',
        'Preserves original transcript for review and editing',
      ],
    },
    {
      icon: '📝',
      title: 'Structured Meeting Minutes',
      description: 'AI automatically generates 8-point structured meeting minutes covering the full meeting.',
      points: [
        'Automatically extracts meeting topic, time, and participants',
        'Generates meeting summary, key points, and decisions',
        'Organizes action items and next steps with accountability',
        'Outputs standard Markdown format for easy copying and sharing',
        'One-click copy of full content',
      ],
    },
    {
      icon: '📧',
      title: 'Email Sending',
      description: 'Send meeting minutes to all participants with one click for efficient collaboration.',
      points: [
        'Supports multiple recipients for batch sending',
        'Auto-generates email subject with meeting date',
        'Add custom messages for flexible supplementary notes',
        'Real-time delivery status feedback to ensure receipt',
      ],
    },
    {
      icon: '⚡',
      title: 'Real-time Transcription',
      description: 'Transcribe speech to text in real-time while recording — see it as you say it.',
      points: [
        'Displays transcription text synchronously during recording',
        'Low-latency real-time feedback to improve meeting efficiency',
        'Transcription results can be directly used to generate minutes',
        'Currently in BETA, continuously being optimized',
      ],
    },
  ],
};

const FeaturePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang } = useParams();

  // 从组件内常量读取功能卡片数据，避免 i18n translate() 的字符串类型限制
  const features = FEATURES_DATA[lang] ?? FEATURES_DATA['zh'];

  const handleGoHome = () => {
    const homePath = buildLanguagePath(lang || 'zh', '/');
    navigate(homePath);
  };

  return (
    <div className="feature-page">
      <Header />

      <main className="feature-page-main">
        {/* Hero 区域 */}
        <section className="feature-hero">
          <div className="container">
            <h1 className="feature-hero-title">{t('featurePage.hero.title')}</h1>
            <p className="feature-hero-desc">{t('featurePage.hero.description')}</p>
          </div>
        </section>

        {/* 功能模块网格 */}
        <section className="feature-grid-section">
          <div className="container">
            <div className="feature-grid">
              {Array.isArray(features) && features.map((feature, index) => {
                const color = FEATURE_COLORS[index] || FEATURE_COLORS[0];
                return (
                  <article
                    key={index}
                    className="feature-card"
                    style={{ '--card-accent': color.accent, '--card-bg': color.bg }}
                  >
                    {/* 顶部色条 */}
                    <div className="feature-card-bar" />

                    {/* 图标 */}
                    <div className="feature-card-icon">{feature.icon}</div>

                    {/* 标题 */}
                    <h2 className="feature-card-title">{feature.title}</h2>

                    {/* 描述 */}
                    <p className="feature-card-desc">{feature.description}</p>

                    {/* 要点列表 */}
                    <ul className="feature-card-points">
                      {Array.isArray(feature.points) && feature.points.map((point, pIdx) => (
                        <li key={pIdx} className="feature-card-point">
                          <span className="feature-card-point-dot" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA 区域 */}
        <section className="feature-cta-section">
          <div className="container">
            <div className="feature-cta">
              <h2 className="feature-cta-title">{t('featurePage.cta.title')}</h2>
              <p className="feature-cta-desc">{t('featurePage.cta.description')}</p>
              <button className="btn-primary feature-cta-btn" onClick={handleGoHome}>
                {t('featurePage.cta.button')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FeaturePage;
