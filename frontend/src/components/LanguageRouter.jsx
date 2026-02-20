/**
 * 语言路由守卫组件
 * 负责从 URL 解析语言参数，验证语言，并处理重定向
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { isValidLanguage, DEFAULT_LANGUAGE } from '../i18n/config.js';
import { getCurrentLanguage, buildLanguagePath, removeLanguageFromPath } from '../i18n/utils.js';

/**
 * 语言路由守卫组件
 * @param {object} props - 组件属性
 * @param {React.ReactNode} props.children - 子组件
 */
export function LanguageRouter({ children }) {
  const { lang } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLanguage, changeLanguage } = useTranslation();
  
  useEffect(() => {
    // 如果 URL 中有语言参数
    if (lang) {
      // 验证语言是否有效
      if (isValidLanguage(lang)) {
        // 如果 URL 语言与当前语言不同，更新当前语言
        if (lang !== currentLanguage) {
          changeLanguage(lang);
        }
      } else {
        // 无效语言，重定向到默认语言
        const newPath = buildLanguagePath(DEFAULT_LANGUAGE, removeLanguageFromPath(location.pathname));
        navigate(newPath, { replace: true });
      }
    } else {
      // URL 中没有语言参数（根路径 /）
      // 检测应该使用的语言（localStorage > 浏览器语言 > 默认语言）
      const detectedLanguage = getCurrentLanguage();
      
      // 重定向到带语言前缀的路径
      const newPath = buildLanguagePath(detectedLanguage, location.pathname);
      navigate(newPath, { replace: true });
    }
  }, [lang, currentLanguage, changeLanguage, navigate, location.pathname]);
  
  // 如果没有语言参数，显示加载状态（等待重定向）
  if (!lang) {
    return null;
  }
  
  // 如果语言无效，显示加载状态（等待重定向）
  if (!isValidLanguage(lang)) {
    return null;
  }
  
  // 渲染子组件
  return <>{children}</>;
}

export default LanguageRouter;
