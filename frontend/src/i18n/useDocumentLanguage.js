/**
 * 文档语言 Hook
 * 监听语言变化并更新 HTML 文档的 lang 属性和页面标题
 */

import { useEffect } from 'react';
import { useTranslation } from './I18nContext.jsx';
import { getLanguageMetadata } from './config.js';

/**
 * 使用文档语言的 Hook
 * 自动更新 <html lang="..."> 和 document.title
 */
export function useDocumentLanguage() {
  const { currentLanguage, t } = useTranslation();
  
  useEffect(() => {
    // 获取语言元数据
    const metadata = getLanguageMetadata(currentLanguage);
    
    // 更新 HTML lang 属性
    if (document.documentElement) {
      document.documentElement.lang = metadata.htmlLang;
      document.documentElement.dir = metadata.direction;
    }
    
    // 更新页面标题
    const appName = t('common.appName');
    const pageTitle = t('home.title');
    document.title = `${pageTitle} - ${appName}`;
    
    // 更新 meta description
    updateMetaDescription(t('home.subtitle'));
    
  }, [currentLanguage, t]);
}

/**
 * 更新 meta description 标签
 * @param {string} description - 描述文本
 */
function updateMetaDescription(description) {
  let metaDescription = document.querySelector('meta[name="description"]');
  
  if (!metaDescription) {
    metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    document.head.appendChild(metaDescription);
  }
  
  metaDescription.content = description;
}

export default useDocumentLanguage;
