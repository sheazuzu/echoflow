/**
 * 应用常量定义
 */

// ==================== 应用状态 ====================
export const APP_STATES = {
  IDLE: 'idle',                   // 空闲状态
  RECORDING: 'recording',         // 录音中
  UPLOADING: 'uploading',         // 上传中
  PROCESSING: 'processing',       // AI 处理中
  COMPLETED: 'completed',         // 处理完成
  ERROR: 'error',                 // 错误状态
};

// ==================== 处理步骤 ====================
export const PROCESSING_STEPS = {
  UPLOADING: 'uploading',         // 上传文件
  TRANSCRIBING: 'transcribing',   // 转录音频
  ANALYZING: 'analyzing',         // 分析内容
  GENERATING: 'generating',       // 生成纪要
  COMPLETED: 'completed',         // 完成
};

export const PROCESSING_STEP_LABELS = {
  [PROCESSING_STEPS.UPLOADING]: '上传文件中...',
  [PROCESSING_STEPS.TRANSCRIBING]: '转录音频中...',
  [PROCESSING_STEPS.ANALYZING]: '分析内容中...',
  [PROCESSING_STEPS.GENERATING]: '生成会议纪要中...',
  [PROCESSING_STEPS.COMPLETED]: '处理完成',
};

// ==================== 音频格式 ====================
export const AUDIO_FORMATS = {
  MP3: 'audio/mpeg',
  WAV: 'audio/wav',
  M4A: 'audio/mp4',
  OGG: 'audio/ogg',
  WEBM: 'audio/webm',
};

export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm'];

export const AUDIO_FORMAT_LABELS = {
  [AUDIO_FORMATS.MP3]: 'MP3',
  [AUDIO_FORMATS.WAV]: 'WAV',
  [AUDIO_FORMATS.M4A]: 'M4A',
  [AUDIO_FORMATS.OGG]: 'OGG',
  [AUDIO_FORMATS.WEBM]: 'WEBM',
};

// ==================== 文件大小限制 ====================
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024,  // 100MB
  MAX_RECORDING_SIZE: 50 * 1024 * 1024, // 50MB
};

// ==================== 录音配置 ====================
export const RECORDING_CONFIG = {
  SAMPLE_RATE: 44100,             // 采样率
  CHANNELS: 1,                    // 单声道
  BITS_PER_SAMPLE: 16,            // 位深度
  MAX_DURATION: 3600,             // 最大录音时长（秒）
};

// ==================== 通知类型 ====================
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// ==================== 错误消息 ====================
export const ERROR_MESSAGES = {
  // 网络错误
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
  TIMEOUT_ERROR: '请求超时，请稍后重试',
  SERVER_ERROR: '服务器错误，请稍后重试或联系支持团队',
  
  // 文件错误
  FILE_TOO_LARGE: `文件大小超过限制（最大 ${FILE_SIZE_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB）`,
  INVALID_FILE_FORMAT: `不支持的文件格式，请上传 ${SUPPORTED_AUDIO_EXTENSIONS.join(', ')} 文件`,
  FILE_UPLOAD_FAILED: '文件上传失败，请重试',
  
  // 录音错误
  MIC_PERMISSION_DENIED: '需要麦克风权限才能录音，请在浏览器设置中允许',
  MIC_NOT_FOUND: '未检测到麦克风设备',
  RECORDING_FAILED: '录音失败，请检查麦克风设置',
  RECORDING_TOO_SHORT: '录音时长过短，请至少录制 3 秒',
  
  // 处理错误
  PROCESSING_FAILED: '处理失败，请稍后重试',
  TRANSCRIPTION_FAILED: '音频转录失败，请确保音频清晰',
  ANALYSIS_FAILED: '内容分析失败，请重试',
  
  // 邮件错误
  EMAIL_SEND_FAILED: '邮件发送失败，请检查邮箱地址',
  INVALID_EMAIL: '邮箱地址格式不正确',
  NO_RECIPIENTS: '请至少添加一个收件人',
  
  // 通用错误
  UNKNOWN_ERROR: '发生未知错误，请刷新页面重试',
  OPERATION_CANCELLED: '操作已取消',
};

// ==================== 成功消息 ====================
export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: '文件上传成功',
  RECORDING_SAVED: '录音保存成功',
  PROCESSING_COMPLETED: '处理完成',
  EMAIL_SENT: '邮件发送成功',
  COPIED_TO_CLIPBOARD: '已复制到剪贴板',
  FEEDBACK_SUBMITTED: '反馈提交成功，感谢您的建议',
};

// ==================== API 端点 ====================
export const API_ENDPOINTS = {
  UPLOAD_AUDIO: '/api/upload',
  PROCESS_AUDIO: '/api/process',
  GET_MEETING_MINUTES: '/api/meeting-minutes',
  SEND_EMAIL: '/api/send-email',
  SUBMIT_FEEDBACK: '/api/feedback',
  GET_HISTORY: '/api/history',
  DELETE_HISTORY: '/api/history',
};

// ==================== 本地存储键 ====================
export const STORAGE_KEYS = {
  USER_SETTINGS: 'echoflow_user_settings',
  DEFAULT_RECIPIENTS: 'echoflow_default_recipients',
  LAST_MEETING: 'echoflow_last_meeting',
  THEME: 'echoflow_theme',
};

// ==================== 时间配置 ====================
export const TIME_CONFIG = {
  NOTIFICATION_DURATION: 3000,    // 通知显示时长（毫秒）
  DEBOUNCE_DELAY: 300,            // 防抖延迟（毫秒）
  THROTTLE_DELAY: 100,            // 节流延迟（毫秒）
  POLLING_INTERVAL: 2000,         // 轮询间隔（毫秒）
  REQUEST_TIMEOUT: 30000,         // 请求超时（毫秒）
};

// ==================== 响应式断点 ====================
export const BREAKPOINTS = {
  MOBILE: 768,                    // 手机端
  TABLET: 1024,                   // 平板端
  DESKTOP: 1440,                  // 桌面端
};

// ==================== 邮件配置 ====================
export const EMAIL_CONFIG = {
  MAX_RECIPIENTS: 50,             // 最大收件人数量
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // 邮箱验证正则
};

// ==================== 动画配置 ====================
export const ANIMATION_CONFIG = {
  FADE_DURATION: 200,             // 淡入淡出时长（毫秒）
  SLIDE_DURATION: 300,            // 滑动时长（毫秒）
  BOUNCE_DURATION: 400,           // 弹跳时长（毫秒）
};

// ==================== 键盘快捷键 ====================
export const KEYBOARD_SHORTCUTS = {
  START_RECORDING: 'r',           // 开始录音
  STOP_RECORDING: 's',            // 停止录音
  COPY_MINUTES: 'c',              // 复制纪要
  SEND_EMAIL: 'e',                // 发送邮件
  CLOSE_MODAL: 'Escape',          // 关闭模态框
};

// ==================== 默认值 ====================
export const DEFAULTS = {
  LANGUAGE: 'zh-CN',              // 默认语言
  THEME: 'light',                 // 默认主题
  NOTIFICATION_POSITION: 'top-right', // 通知位置
};
