/**
 * 语言选择器组件
 * 显示在页面右上角，允许用户切换语言
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { SUPPORTED_LANGUAGES, LANGUAGE_METADATA } from '../i18n/config.js';
import { buildLanguagePath, removeLanguageFromPath } from '../i18n/utils.js';
import { Globe } from 'lucide-react';

/**
 * 语言选择器组件
 */
export function LanguageSwitcher() {
  const { currentLanguage, changeLanguage } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);
  
  // 切换语言
  const handleLanguageChange = (newLanguage) => {
    if (newLanguage !== currentLanguage) {
      // 更新语言状态
      changeLanguage(newLanguage);
      
      // 构建新的路径（保持当前路径，只更改语言前缀）
      const currentPath = removeLanguageFromPath(location.pathname);
      const newPath = buildLanguagePath(newLanguage, currentPath);
      
      // 导航到新路径
      navigate(newPath);
    }
    
    // 关闭下拉菜单
    setIsOpen(false);
  };
  
  // 获取当前语言的元数据
  const currentLanguageMetadata = LANGUAGE_METADATA[currentLanguage];
  
  return (
    <div className="language-switcher" ref={dropdownRef}>
      <button
        className="language-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="选择语言 / Select Language"
        aria-expanded={isOpen}
      >
        <Globe size={18} />
        <span className="language-switcher-label">
          {currentLanguageMetadata.nativeName}
        </span>
        <svg
          className={`language-switcher-arrow ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      
      {isOpen && (
        <div className="language-switcher-dropdown">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const metadata = LANGUAGE_METADATA[lang];
            const isActive = lang === currentLanguage;
            
            return (
              <button
                key={lang}
                className={`language-switcher-option ${isActive ? 'active' : ''}`}
                onClick={() => handleLanguageChange(lang)}
                disabled={isActive}
              >
                <span className="language-switcher-option-name">
                  {metadata.nativeName}
                </span>
                {isActive && (
                  <svg
                    className="language-switcher-check"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.3333 4L6 11.3333L2.66667 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
