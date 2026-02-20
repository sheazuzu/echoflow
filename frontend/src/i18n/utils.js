/**
 * 国际化工具函数
 * 提供语言检测、存储和浏览器语言解析功能
 */

import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE, isValidLanguage } from './config.js';

/**
 * 从 localStorage 获取保存的语言偏好
 * @returns {string|null} 保存的语言代码，如果不存在则返回 null
 */
export function getSavedLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved && isValidLanguage(saved) ? saved : null;
  } catch (error) {
    console.warn('Failed to read language from localStorage:', error);
    return null;
  }
}

/**
 * 保存语言偏好到 localStorage
 * @param {string} lang - 语言代码
 * @returns {boolean} 是否保存成功
 */
export function saveLanguage(lang) {
  try {
    if (isValidLanguage(lang)) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to save language to localStorage:', error);
    return false;
  }
}

/**
 * 从浏览器语言设置中检测语言
 * @returns {string} 检测到的语言代码
 */
export function detectBrowserLanguage() {
  try {
    // 获取浏览器语言列表
    const browserLangs = navigator.languages || [navigator.language || navigator.userLanguage];
    
    // 遍历浏览器语言列表，查找支持的语言
    for (const browserLang of browserLangs) {
      // 提取主语言代码（如 'zh-CN' -> 'zh'）
      const langCode = browserLang.toLowerCase().split('-')[0];
      
      if (isValidLanguage(langCode)) {
        return langCode;
      }
    }
  } catch (error) {
    console.warn('Failed to detect browser language:', error);
  }
  
  return DEFAULT_LANGUAGE;
}

/**
 * 获取当前应该使用的语言
 * 优先级：localStorage > 浏览器语言 > 默认语言
 * @returns {string} 语言代码
 */
export function getCurrentLanguage() {
  // 1. 优先使用保存的语言偏好
  const saved = getSavedLanguage();
  if (saved) {
    return saved;
  }
  
  // 2. 其次使用浏览器语言
  const detected = detectBrowserLanguage();
  if (detected) {
    return detected;
  }
  
  // 3. 最后使用默认语言
  return DEFAULT_LANGUAGE;
}

/**
 * 从 URL 路径中提取语言代码
 * @param {string} pathname - URL 路径名
 * @returns {string|null} 语言代码，如果路径中没有语言代码则返回 null
 */
export function getLanguageFromPath(pathname) {
  const match = pathname.match(/^\/([a-z]{2})(\/|$)/);
  if (match && isValidLanguage(match[1])) {
    return match[1];
  }
  return null;
}

/**
 * 构建带语言前缀的路径
 * @param {string} lang - 语言代码
 * @param {string} path - 路径（可选，默认为 '/'）
 * @returns {string} 带语言前缀的完整路径
 */
export function buildLanguagePath(lang, path = '/') {
  // 移除路径开头的语言前缀（如果存在）
  const cleanPath = path.replace(/^\/[a-z]{2}(\/|$)/, '/');
  
  // 构建新路径
  if (cleanPath === '/' || cleanPath === '') {
    return `/${lang}`;
  }
  
  return `/${lang}${cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath}`;
}

/**
 * 从路径中移除语言前缀
 * @param {string} pathname - URL 路径名
 * @returns {string} 移除语言前缀后的路径
 */
export function removeLanguageFromPath(pathname) {
  return pathname.replace(/^\/[a-z]{2}(\/|$)/, '/') || '/';
}
