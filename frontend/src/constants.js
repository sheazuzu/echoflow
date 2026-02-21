/**
 * 应用常量定义
 */

// 错误消息
export const ERROR_MESSAGES = {
  BROWSER_NOT_SUPPORTED: '您的浏览器不支持录音功能',
  PERMISSION_DENIED: '无法访问麦克风，请检查权限设置',
  RECORDING_FAILED: '录音失败，请重试',
  UPLOAD_FAILED: '上传失败，请重试',
  TRANSCRIPTION_FAILED: '转录失败，请重试',
  NETWORK_ERROR: '网络错误，请检查网络连接',
};

// 成功消息
export const SUCCESS_MESSAGES = {
  RECORDING_STARTED: '录音已开始',
  RECORDING_STOPPED: '录音已停止',
  RECORDING_DOWNLOADED: '录音已下载',
  UPLOAD_SUCCESS: '上传成功',
  TRANSCRIPTION_SUCCESS: '转录成功',
  COPIED_TO_CLIPBOARD: '已复制到剪贴板',
};

// 录音配置
export const RECORDING_CONFIG = {
  MAX_DURATION: 3600, // 最大录音时长（秒）- 1小时
  SAMPLE_RATE: 48000, // 采样率
  CHANNEL_COUNT: 1, // 声道数
  SEGMENT_DURATION: 4000, // 分段时长（毫秒）- 4秒
  MIME_TYPE: 'audio/webm;codecs=opus', // 音频格式
};

// 通知类型
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// 时间配置
export const TIME_CONFIG = {
  NOTIFICATION_DURATION: 3000, // 通知显示时长（毫秒）
  RETRY_DELAY: 1000, // 重试延迟（毫秒）
  MAX_RETRIES: 3, // 最大重试次数
};

// API 端点
export const API_ENDPOINTS = {
  TRANSCRIBE_STREAM: '/api/transcribe/stream',
  TRANSCRIBE_FILE: '/api/transcribe',
  MEETING_SUMMARY: '/api/meeting-summary',
};

// 支持的语言
export const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: '自动检测' },
  { code: 'zh', name: '中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
];

// 转录状态
export const TRANSCRIPTION_STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PAUSED: 'paused',
  PROCESSING: 'processing',
  ERROR: 'error',
};
