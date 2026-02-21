import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import './Footer.css';
import logo from '../../assets/logo.png';

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const companyLinks = [
    { key: 'about', label: t('footer.aboutUs'), href: '#about' },
    { key: 'careers', label: t('footer.careers'), href: '#careers' },
    { key: 'contact', label: t('footer.contactUs'), href: '#contact' },
    { key: 'blog', label: t('footer.blog'), href: '#blog' },
  ];

  const productLinks = [
    { key: 'features', label: t('footer.features'), href: '#features' },
    { key: 'pricing', label: t('footer.pricing'), href: '#pricing' },
    { key: 'solutions', label: t('footer.solutions'), href: '#solutions' },
    { key: 'integrations', label: t('footer.integrations'), href: '#integrations' },
  ];

  const legalLinks = [
    { key: 'privacy', label: t('footer.privacyPolicy'), href: '#privacy' },
    { key: 'terms', label: t('footer.termsOfService'), href: '#terms' },
    { key: 'cookies', label: t('footer.cookiePolicy'), href: '#cookies' },
    { key: 'compliance', label: t('footer.compliance'), href: '#compliance' },
  ];

  const socialLinks = [
    { key: 'twitter', label: 'Twitter', icon: '𝕏', href: '#twitter' },
    { key: 'linkedin', label: 'LinkedIn', icon: 'in', href: '#linkedin' },
    { key: 'github', label: 'GitHub', icon: 'GH', href: '#github' },
    { key: 'youtube', label: 'YouTube', icon: 'YT', href: '#youtube' },
  ];

  return (
    <footer className="enterprise-footer">
      <div className="footer-container">
        {/* 主要内容区域 */}
        <div className="footer-main">
          {/* 公司信息栏 */}
          <div className="footer-column footer-company">
            <div className="footer-brand">
              <img 
                src={logo} 
                alt="MeetandNote" 
                className="footer-logo"
              />
              <h3 className="footer-brand-name">
                <span className="footer-brand-text-primary">Meet</span>
                <span className="footer-brand-text-accent">and</span>
                <span className="footer-brand-text-primary">Note</span>
              </h3>
            </div>
            <p className="footer-description">
              {t('footer.companyDescription')}
            </p>
            {/* 社交媒体链接 */}
            <div className="footer-social">
              {socialLinks.map((social) => (
                <a
                  key={social.key}
                  href={social.href}
                  className="social-link"
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="social-icon">{social.icon}</span>
                </a>
              ))}
            </div>
          </div>

          {/* 产品链接栏 */}
          <div className="footer-column">
            <h4 className="footer-column-title">{t('footer.product')}</h4>
            <ul className="footer-links">
              {productLinks.map((link) => (
                <li key={link.key}>
                  <a href={link.href} className="footer-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 公司链接栏 */}
          <div className="footer-column">
            <h4 className="footer-column-title">{t('footer.company')}</h4>
            <ul className="footer-links">
              {companyLinks.map((link) => (
                <li key={link.key}>
                  <a href={link.href} className="footer-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 法律信息栏 */}
          <div className="footer-column">
            <h4 className="footer-column-title">{t('footer.legal')}</h4>
            <ul className="footer-links">
              {legalLinks.map((link) => (
                <li key={link.key}>
                  <a href={link.href} className="footer-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 底部版权声明 */}
        <div className="footer-bottom">
          <div className="footer-copyright">
            <p>
              © {currentYear} {t('common.appName')}. {t('footer.allRightsReserved')}
            </p>
          </div>
          <div className="footer-bottom-links">
            <a href="#privacy" className="footer-bottom-link">
              {t('footer.privacy')}
            </a>
            <span className="footer-divider">|</span>
            <a href="#terms" className="footer-bottom-link">
              {t('footer.terms')}
            </a>
            <span className="footer-divider">|</span>
            <a href="#cookies" className="footer-bottom-link">
              {t('footer.cookies')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
