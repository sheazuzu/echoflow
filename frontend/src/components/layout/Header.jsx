import React, { useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import LanguageSwitcher from '../LanguageSwitcher.jsx';
import './Header.css';
import logo from '../../assets/logo.png';

const Header = () => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const navItems = [
    { key: 'home', label: t('nav.home'), href: '#home' },
    { key: 'features', label: t('nav.features'), href: '#features' },
    { key: 'solutions', label: t('nav.solutions'), href: '#solutions' },
    { key: 'about', label: t('nav.about'), href: '#about' },
  ];

  return (
    <header className="enterprise-header">
      <div className="header-container">
        {/* Logo 和品牌名称 */}
        <div className="header-brand">
          <img 
            src={logo} 
            alt="MeetandNote" 
            className="brand-logo"
          />
          <span className="brand-name">
            <span className="brand-text-primary">Meet</span>
            <span className="brand-text-accent">and</span>
            <span className="brand-text-primary">Note</span>
          </span>
        </div>

        {/* 桌面端导航菜单 */}
        <nav className="header-nav desktop-nav" aria-label={t('nav.mainNavigation')}>
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.key} className="nav-item">
                <a 
                  href={item.href} 
                  className="nav-link"
                  aria-label={item.label}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 右侧操作区 */}
        <div className="header-actions">
          {/* 语言切换器 */}
          <LanguageSwitcher />

          {/* 登录/注册按钮（占位） */}
          <button 
            className="btn-secondary header-btn"
            aria-label={t('nav.login')}
          >
            {t('nav.login')}
          </button>
          <button 
            className="btn-primary header-btn"
            aria-label={t('nav.register')}
          >
            {t('nav.register')}
          </button>

          {/* 移动端汉堡菜单按钮 */}
          <button 
            className="mobile-menu-toggle"
            onClick={toggleMobileMenu}
            aria-label={t('nav.toggleMenu')}
            aria-expanded={mobileMenuOpen}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
        </div>
      </div>

      {/* 移动端导航菜单 */}
      {mobileMenuOpen && (
        <nav className="header-nav mobile-nav" aria-label={t('nav.mobileNavigation')}>
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.key} className="nav-item">
                <a 
                  href={item.href} 
                  className="nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={item.label}
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="nav-item mobile-actions">
              <button 
                className="btn-secondary mobile-btn"
                aria-label={t('nav.login')}
              >
                {t('nav.login')}
              </button>
              <button 
                className="btn-primary mobile-btn"
                aria-label={t('nav.register')}
              >
                {t('nav.register')}
              </button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
};

export default Header;
