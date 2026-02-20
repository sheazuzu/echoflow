/**
 * 国际化模块主入口
 * 导出所有国际化相关的功能
 */

// 导出 Context 和 Hooks
export { I18nProvider, useTranslation, useLanguageChange, I18nContext } from './I18nContext.jsx';
export { default as useDocumentLanguage } from './useDocumentLanguage.js';

// 导出配置
export { 
  SUPPORTED_LANGUAGES, 
  DEFAULT_LANGUAGE, 
  LANGUAGE_METADATA,
  LANGUAGE_STORAGE_KEY,
  isValidLanguage,
  getLanguageMetadata,
} from './config.js';

// 导出工具函数
export {
  getSavedLanguage,
  saveLanguage,
  detectBrowserLanguage,
  getCurrentLanguage,
  getLanguageFromPath,
  buildLanguagePath,
  removeLanguageFromPath,
} from './utils.js';

// 导出翻译资源（用于调试或特殊用途）
export { default as translations } from './locales/index.js';

// 导出格式化工具
export {
  formatDate,
  formatTime,
  formatDateTime,
  formatNumber,
  formatFileSize,
  formatDuration,
  formatRelativeTime,
  formatPercentage,
} from './formatters.js';
