import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import './Footer.css';
import logo from '../../assets/logo.png';

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="enterprise-footer">
      <div className="footer-container">
        <div className="footer-simple">
          {/* Logo 和品牌名 */}
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

          {/* 公司简介 */}
          <p className="footer-description">
            {t('footer.companyDescription')}
          </p>

          {/* 版权信息 */}
          <div className="footer-copyright">
            <p>
              © {currentYear} {t('common.appName')}. {t('footer.allRightsReserved')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
