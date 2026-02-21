/**
 * 国际化配置文件
 * 定义支持的语言列表、默认语言和语言元数据
 */

// 支持的语言列表
export const SUPPORTED_LANGUAGES = ['zh', 'en'];

// 默认语言
export const DEFAULT_LANGUAGE = 'zh';

// 语言元数据
export const LANGUAGE_METADATA = {
  zh: {
    code: 'zh',
    name: '中文',
    nativeName: '中文',
    htmlLang: 'zh-CN',
    direction: 'ltr'
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    htmlLang: 'en',
    direction: 'ltr'
  }
};

// 语言存储键
export const LANGUAGE_STORAGE_KEY = 'meetandnote_language';

/**
 * 验证语言代码是否有效
 * @param {string} lang - 语言代码
 * @returns {boolean} 是否有效
 */
export function isValidLanguage(lang) {
  return SUPPORTED_LANGUAGES.includes(lang);
}

/**
 * 获取语言元数据
 * @param {string} lang - 语言代码
 * @returns {object} 语言元数据
 */
export function getLanguageMetadata(lang) {
  return LANGUAGE_METADATA[lang] || LANGUAGE_METADATA[DEFAULT_LANGUAGE];
}
