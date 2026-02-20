/**
 * 格式化工具函数
 * 提供日期、时间、文件大小等的本地化格式化
 */

import { LANGUAGE_METADATA } from './config.js';

/**
 * 格式化日期
 * @param {Date|string|number} date - 日期对象、ISO字符串或时间戳
 * @param {string} lang - 语言代码
 * @param {object} options - Intl.DateTimeFormat 选项
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date, lang, options = {}) {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    const locale = LANGUAGE_METADATA[lang]?.htmlLang || 'zh-CN';
    
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    };
    
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  } catch (error) {
    console.warn('Failed to format date:', error);
    return String(date);
  }
}

/**
 * 格式化时间
 * @param {Date|string|number} date - 日期对象、ISO字符串或时间戳
 * @param {string} lang - 语言代码
 * @param {object} options - Intl.DateTimeFormat 选项
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(date, lang, options = {}) {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    const locale = LANGUAGE_METADATA[lang]?.htmlLang || 'zh-CN';
    
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...options
    };
    
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  } catch (error) {
    console.warn('Failed to format time:', error);
    return String(date);
  }
}

/**
 * 格式化日期时间
 * @param {Date|string|number} date - 日期对象、ISO字符串或时间戳
 * @param {string} lang - 语言代码
 * @param {object} options - Intl.DateTimeFormat 选项
 * @returns {string} 格式化后的日期时间字符串
 */
export function formatDateTime(date, lang, options = {}) {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    const locale = LANGUAGE_METADATA[lang]?.htmlLang || 'zh-CN';
    
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    };
    
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  } catch (error) {
    console.warn('Failed to format datetime:', error);
    return String(date);
  }
}

/**
 * 格式化数字
 * @param {number} number - 数字
 * @param {string} lang - 语言代码
 * @param {object} options - Intl.NumberFormat 选项
 * @returns {string} 格式化后的数字字符串
 */
export function formatNumber(number, lang, options = {}) {
  try {
    const locale = LANGUAGE_METADATA[lang]?.htmlLang || 'zh-CN';
    return new Intl.NumberFormat(locale, options).format(number);
  } catch (error) {
    console.warn('Failed to format number:', error);
    return String(number);
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @param {string} lang - 语言代码
 * @param {number} decimals - 小数位数（默认2）
 * @returns {string} 格式化后的文件大小字符串
 */
export function formatFileSize(bytes, lang, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = lang === 'zh' 
    ? ['字节', 'KB', 'MB', 'GB', 'TB'] 
    : ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  
  return `${formatNumber(size, lang)} ${sizes[i]}`;
}

/**
 * 格式化时长（秒）
 * @param {number} seconds - 秒数
 * @param {string} lang - 语言代码
 * @returns {string} 格式化后的时长字符串
 */
export function formatDuration(seconds, lang) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  
  if (hours > 0) {
    parts.push(lang === 'zh' ? `${hours}小时` : `${hours}h`);
  }
  if (minutes > 0) {
    parts.push(lang === 'zh' ? `${minutes}分钟` : `${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(lang === 'zh' ? `${secs}秒` : `${secs}s`);
  }
  
  return parts.join(' ');
}

/**
 * 格式化相对时间（如"3分钟前"）
 * @param {Date|string|number} date - 日期对象、ISO字符串或时间戳
 * @param {string} lang - 语言代码
 * @returns {string} 格式化后的相对时间字符串
 */
export function formatRelativeTime(date, lang) {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (lang === 'zh') {
      if (diffSecs < 60) return '刚刚';
      if (diffMins < 60) return `${diffMins}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;
      return formatDate(dateObj, lang);
    } else {
      if (diffSecs < 60) return 'just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return formatDate(dateObj, lang);
    }
  } catch (error) {
    console.warn('Failed to format relative time:', error);
    return String(date);
  }
}

/**
 * 格式化百分比
 * @param {number} value - 数值（0-1 或 0-100）
 * @param {string} lang - 语言代码
 * @param {boolean} isDecimal - 是否为小数形式（0-1），默认false
 * @returns {string} 格式化后的百分比字符串
 */
export function formatPercentage(value, lang, isDecimal = false) {
  const percentage = isDecimal ? value * 100 : value;
  return `${formatNumber(percentage, lang, { maximumFractionDigits: 1 })}%`;
}
