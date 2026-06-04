import React from 'react';
import { useTranslation } from '../i18n/index.js';
import './PricingModal.css';

const PricingModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const plans = [
    {
      key: 'personal',
      name: t('pricingModal.plans.personal.name'),
      price: t('pricingModal.plans.personal.price'),
      period: t('pricingModal.plans.personal.period'),
      description: t('pricingModal.plans.personal.description'),
      features: t('pricingModal.plans.personal.features'),
      cta: t('pricingModal.plans.personal.cta'),
      highlight: false,
    },
    {
      key: 'developer',
      name: t('pricingModal.plans.developer.name'),
      price: t('pricingModal.plans.developer.price'),
      period: t('pricingModal.plans.developer.period'),
      description: t('pricingModal.plans.developer.description'),
      features: t('pricingModal.plans.developer.features'),
      cta: t('pricingModal.plans.developer.cta'),
      highlight: true,
      badge: t('pricingModal.popularBadge'),
    },
    {
      key: 'enterprise',
      name: t('pricingModal.plans.enterprise.name'),
      price: t('pricingModal.plans.enterprise.price'),
      period: t('pricingModal.plans.enterprise.period'),
      description: t('pricingModal.plans.enterprise.description'),
      features: t('pricingModal.plans.enterprise.features'),
      cta: t('pricingModal.plans.enterprise.cta'),
      highlight: false,
    },
  ];

  return (
    <div className="pricing-modal-overlay" onClick={onClose}>
      <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
        {/* 关闭按钮 */}
        <button className="pricing-modal-close" onClick={onClose} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* 头部 */}
        <div className="pricing-modal-header">
          <h2>{t('pricingModal.title')}</h2>
          <p>{t('pricingModal.subtitle')}</p>
        </div>

        {/* 价格卡片 */}
        <div className="pricing-cards">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`pricing-card ${plan.highlight ? 'pricing-card--highlight' : ''}`}
            >
              {plan.badge && (
                <div className="pricing-badge">{plan.badge}</div>
              )}
              <div className="pricing-card-header">
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-description">{plan.description}</p>
              </div>
              <div className="plan-price-block">
                <span className="plan-price">{plan.price}</span>
                <span className="plan-period">{plan.period}</span>
              </div>
              <ul className="plan-features">
                {Array.isArray(plan.features) && plan.features.map((feature, idx) => (
                  <li key={idx} className="plan-feature-item">
                    <svg className="feature-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`plan-cta-btn ${plan.highlight ? 'plan-cta-btn--primary' : 'plan-cta-btn--secondary'}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <p className="pricing-modal-footer">{t('pricingModal.footerNote')}</p>
      </div>
    </div>
  );
};

export default PricingModal;
