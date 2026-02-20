/**
 * 功能开关配置
 * 用于控制应用中各个功能模块的启用/禁用状态
 */

export const FEATURES = {
  // 当前已实现的功能
  AUDIO_RECORDING: true,           // 音频录制功能
  AUDIO_UPLOAD: true,              // 音频文件上传功能
  MEETING_MINUTES: true,           // 会议纪要生成功能
  EMAIL_SENDING: true,             // 邮件发送功能
  CONTACT_FEEDBACK: true,          // 联系反馈功能
  
  // 未来计划功能（第二阶段）
  USER_AUTHENTICATION: false,      // 用户注册/登录
  HISTORY_MANAGEMENT: false,       // 历史记录管理
  USER_SETTINGS: false,            // 用户设置面板
  
  // 未来计划功能（第三阶段）
  REAL_TIME_COLLABORATION: false,  // 实时协作
  CUSTOM_TEMPLATES: false,         // 自定义模板
  SPEAKER_RECOGNITION: false,      // 说话人识别
  SENTIMENT_ANALYSIS: false,       // 情感分析
  
  // 未来计划功能（第四阶段）
  CALENDAR_INTEGRATION: false,     // 日历集成
  PROJECT_TOOL_INTEGRATION: false, // 项目管理工具集成
  CLOUD_STORAGE_INTEGRATION: false,// 云存储集成
  MULTI_LANGUAGE: false,           // 多语言支持
  MOBILE_APP: false,               // 移动端应用
  
  // 未来计划功能（第五阶段）
  TEAM_MANAGEMENT: false,          // 团队管理
  DATA_ANALYTICS: false,           // 数据分析
  SECURITY_COMPLIANCE: false,      // 安全与合规
  
  // 未来计划功能（第六阶段）
  AI_ASSISTANT: false,             // 智能助手
  PREDICTIVE_ANALYSIS: false,      // 预测分析
  AUTOMATED_WORKFLOW: false,       // 自动化工作流
};

/**
 * 检查功能是否启用
 * @param {string} featureName - 功能名称
 * @returns {boolean} 功能是否启用
 */
export const isFeatureEnabled = (featureName) => {
  return FEATURES[featureName] === true;
};

/**
 * 获取所有已启用的功能列表
 * @returns {string[]} 已启用的功能名称数组
 */
export const getEnabledFeatures = () => {
  return Object.keys(FEATURES).filter(key => FEATURES[key] === true);
};

/**
 * 开发模式配置
 */
export const DEV_CONFIG = {
  ENABLE_LOGGING: import.meta.env.DEV,        // 开发模式下启用日志
  ENABLE_DEBUG_TOOLS: import.meta.env.DEV,    // 开发模式下启用调试工具
  MOCK_API_DELAY: 0,                          // API 模拟延迟（毫秒）
};
