/**
 * FirstUseGuide - 首次使用引导
 *
 * 基于 localStorage 标记 'echoflow_first_use_guide_dismissed'，
 * 仅在首次进入首页时展示，介绍三种输入方式适用场景。
 */

import React, { useEffect, useState } from 'react';
import { Mic, Upload, Link2, X } from 'lucide-react';
import { useTranslation } from '../../i18n/index.js';
import './FirstUseGuide.css';

const STORAGE_KEY = 'echoflow_first_use_guide_dismissed';

const FirstUseGuide = ({ onStart }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      /* localStorage 不可用，跳过 */
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const start = (type) => {
    dismiss();
    if (typeof onStart === 'function') onStart(type);
  };

  if (!visible) return null;

  const cards = [
    {
      key: 'recording',
      icon: <Mic size={20} aria-hidden="true" />,
      title: t('onboarding.recording.title'),
      description: t('onboarding.recording.description'),
    },
    {
      key: 'upload',
      icon: <Upload size={20} aria-hidden="true" />,
      title: t('onboarding.upload.title'),
      description: t('onboarding.upload.description'),
    },
    {
      key: 'videoUrl',
      icon: <Link2 size={20} aria-hidden="true" />,
      title: t('onboarding.videoUrl.title'),
      description: t('onboarding.videoUrl.description'),
    },
  ];

  return (
    <div className="first-use-mask" role="dialog" aria-labelledby="first-use-title" aria-modal="true">
      <div className="first-use-card">
        <button
          type="button"
          className="first-use-close"
          aria-label={t('common.actions.close')}
          onClick={dismiss}
        >
          <X size={16} aria-hidden="true" />
        </button>
        <h2 id="first-use-title" className="first-use-title">{t('onboarding.title')}</h2>
        <p className="first-use-subtitle">{t('onboarding.subtitle')}</p>
        <div className="first-use-grid">
          {cards.map((card) => (
            <button
              key={card.key}
              type="button"
              className="first-use-item"
              onClick={() => start(card.key)}
            >
              <span className="first-use-item-icon" aria-hidden="true">{card.icon}</span>
              <span className="first-use-item-title">{card.title}</span>
              <span className="first-use-item-desc">{card.description}</span>
            </button>
          ))}
        </div>
        <div className="first-use-actions">
          <button type="button" className="first-use-skip" onClick={dismiss}>
            {t('onboarding.skip')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstUseGuide;
