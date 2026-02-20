/**
 * 国际化 Context 和 Provider
 * 提供语言状态管理和翻译功能
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import translations from './locales/index.js';
import { DEFAULT_LANGUAGE, isValidLanguage, getLanguageMetadata } from './config.js';
import { saveLanguage } from './utils.js';

// 创建 Context
const I18nContext = createContext(null);

/**
 * 翻译函数
 * @param {object} translations - 翻译对象
 * @param {string} key - 翻译键（支持嵌套，如 'common.buttons.submit'）
 * @param {object} params - 参数对象，用于插值
 * @returns {string} 翻译后的文本
 */
function translate(translations, key, params = {}) {
  // 分割键路径
  const keys = key.split('.');
  let value = translations;
  
  // 遍历键路径获取翻译值
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 如果键不存在，返回键名作为回退
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  
  // 如果最终值不是字符串，返回键名
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }
  
  // 参数插值
  let result = value;
  Object.keys(params).forEach(paramKey => {
    const placeholder = `{${paramKey}}`;
    result = result.replace(new RegExp(placeholder, 'g'), params[paramKey]);
  });
  
  return result;
}

/**
 * I18n Provider 组件
 * @param {object} props - 组件属性
 * @param {React.ReactNode} props.children - 子组件
 * @param {string} props.initialLanguage - 初始语言（可选）
 */
export function I18nProvider({ children, initialLanguage }) {
  // 验证初始语言
  const validInitialLanguage = initialLanguage && isValidLanguage(initialLanguage) 
    ? initialLanguage 
    : DEFAULT_LANGUAGE;
  
  // 当前语言状态
  const [currentLanguage, setCurrentLanguage] = useState(validInitialLanguage);
  
  // 切换语言
  const changeLanguage = useCallback((newLanguage) => {
    if (isValidLanguage(newLanguage)) {
      setCurrentLanguage(newLanguage);
      saveLanguage(newLanguage);
      
      // 触发自定义事件，通知其他组件语言已更改
      window.dispatchEvent(new CustomEvent('languagechange', { 
        detail: { language: newLanguage } 
      }));
      
      return true;
    } else {
      console.warn(`Invalid language: ${newLanguage}`);
      return false;
    }
  }, []);
  
  // 获取当前语言的翻译对象
  const currentTranslations = useMemo(() => {
    return translations[currentLanguage] || translations[DEFAULT_LANGUAGE];
  }, [currentLanguage]);
  
  // 翻译函数（带回退机制）
  const t = useCallback((key, params = {}) => {
    // 首先尝试当前语言
    let result = translate(currentTranslations, key, params);
    
    // 如果当前语言没有找到且不是默认语言，尝试回退到默认语言
    if (result === key && currentLanguage !== DEFAULT_LANGUAGE) {
      const defaultTranslations = translations[DEFAULT_LANGUAGE];
      result = translate(defaultTranslations, key, params);
    }
    
    return result;
  }, [currentTranslations, currentLanguage]);
  
  // 获取语言元数据
  const languageMetadata = useMemo(() => {
    return getLanguageMetadata(currentLanguage);
  }, [currentLanguage]);
  
  // Context 值
  const contextValue = useMemo(() => ({
    currentLanguage,
    changeLanguage,
    t,
    languageMetadata,
  }), [currentLanguage, changeLanguage, t, languageMetadata]);
  
  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * 使用国际化的 Hook
 * @returns {object} 国际化上下文对象
 * @returns {string} return.currentLanguage - 当前语言代码
 * @returns {function} return.changeLanguage - 切换语言函数
 * @returns {function} return.t - 翻译函数
 * @returns {object} return.languageMetadata - 当前语言元数据
 */
export function useTranslation() {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  
  return context;
}

/**
 * 使用语言变化监听的 Hook
 * @param {function} callback - 语言变化时的回调函数
 */
export function useLanguageChange(callback) {
  useEffect(() => {
    const handleLanguageChange = (event) => {
      callback(event.detail.language);
    };
    
    window.addEventListener('languagechange', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
    };
  }, [callback]);
}

// 导出 Context（用于高级用法）
export { I18nContext };
