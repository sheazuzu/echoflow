/**
 * 中文翻译资源
 * @type {import('../types').Translations}
 */
export default {
  // 通用文本
  common: {
    appName: 'Meet and Note',
    buttons: {
      confirm: '确认',
      cancel: '取消',
      close: '关闭',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      submit: '提交',
      reset: '重置',
      back: '返回',
      next: '下一步',
      previous: '上一步',
      retry: '重试',
      refresh: '刷新',
      download: '下载',
      upload: '上传',
      copy: '复制',
      copied: '已复制',
      send: '发送',
      minimize: '最小化',
      maximize: '最大化',
    },
    labels: {
      loading: '加载中...',
      processing: '处理中...',
      success: '成功',
      error: '错误',
      warning: '警告',
      info: '提示',
      optional: '可选',
      required: '必填',
    },
    messages: {
      noData: '暂无数据',
      operationSuccess: '操作成功',
      operationFailed: '操作失败',
      confirmDelete: '确认删除吗？',
      unsavedChanges: '有未保存的更改',
    },
    units: {
      seconds: '秒',
      minutes: '分钟',
      hours: '小时',
      bytes: '字节',
      kb: 'KB',
      mb: 'MB',
      gb: 'GB',
    },
  },

  // 首页/主界面
  home: {
    title: '智能会议纪要生成',
    subtitle: '企业级 AI 引擎 · 自动分片处理大文件 · 8点结构化输出',
    description: '上传音频文件或实时录音，AI 自动生成专业会议纪要',
  },

  // 上传功能
  upload: {
    title: '上传音频文件',
    dragDropHint: '点击或拖拽上传音频文件',
    dragDropHintUploading: '文件上传中...',
    selectFile: '选择文件',
    supportedFormats: '支持 MP3 / M4A / WAV / WebM 等音频格式',
    supportedFormatsUploading: '请稍候，正在上传您的音频文件...',
    maxFileSize: '最大文件大小：{size}MB',
    uploading: '上传中...',
    uploadProgress: '上传进度：{progress}%',
    uploadSuccess: '文件上传成功',
    uploadFailed: '文件上传失败',
    processing: '处理中，请稍候...',
    fileInfo: '文件信息',
    fileName: '文件名',
    fileSize: '文件大小',
    duration: '时长',
  },

  // 录音功能
  recording: {
    title: '实时录音转写',
    subtitle: '点击开始录音，实时转写会议内容',
    startRecording: '开始录音',
    stopRecording: '停止录音',
    pauseRecording: '暂停录音',
    resumeRecording: '继续录音',
    recording: '正在录音...',
    paused: '已暂停',
    duration: '录音时长',
    recordingTime: '{time}',
    saveRecording: '保存录音',
    discardRecording: '放弃录音',
    cancelRecording: '取消录音',
    downloadRecording: '下载录音文件',
    downloadOptions: '下载选项',
    downloadFileName: '文件名',
    downloadFormat: '格式',
    recordingCompleted: '录音完成！',
    downloadBackupHint: '您可以下载录音文件作为备份',
    downloadReady: '录音已准备好下载',
    downloadHint: '您可以下载录音文件或继续处理',
    continueProcessing: '继续处理',
    autoSaveHint: '录音将自动保存并处理为会议纪要',
    micPermissionRequired: '需要麦克风权限',
    micPermissionDenied: '麦克风权限被拒绝',
    noMicFound: '未检测到麦克风设备',
    downloadMinimized: '下载录音',
    // 音频源选择
    selectAudioSource: '选择音频源',
    microphoneDevices: '麦克风设备',
    systemAudio: '系统声音',
    systemAudioDescription: '系统声音（屏幕共享音频）',
    safariNotSupported: '注意：Safari浏览器不支持系统声音录制',
    confirmAndStart: '确认并开始录制',
  },

  // 处理步骤
  processing: {
    title: 'AI 正在处理您的会议录音',
    cancelProcessing: '取消处理',
    steps: {
      uploading: '上传文件中',
      splitting: '智能音频分片',
      transcribing: 'AI 语音转录',
      generating_summary: 'AI 生成结构化纪要',
      analyzing: '分析内容中...',
      generating: '生成会议纪要中...',
      completed: '处理完成',
    },
    progress: '进度：{progress}%',
    estimatedTime: '预计剩余时间：{time}',
    pleaseWait: '请稍候，正在处理您的音频...',
  },

  // 会议纪要
  minutes: {
    title: '会议纪要',
    completed: '会议纪要生成完成',
    newMeeting: '新会议',
    copyContent: '复制内容',
    originalTranscript: '原始转录文本',
    sections: {
      meetingInfo: '会议信息',
      meetingTitle: '会议主题',
      meetingDate: '会议日期',
      meetingTime: '会议时间',
      participants: '参会人员',
      location: '会议地点',
      summary: '会议摘要',
      keyPoints: '关键要点',
      decisions: '决策事项',
      actionItems: '待办事项',
      nextSteps: '后续步骤',
      notes: '备注',
      transcript: '完整转录',
      fullTranscript: '完整转录文本',
    },
    actions: {
      copyMinutes: '复制纪要',
      copyTranscript: '复制文本',
      downloadMinutes: '下载纪要',
      downloadTranscript: '下载转录',
      sendEmail: '发送邮件',
      print: '打印',
      share: '分享',
      edit: '编辑',
      regenerate: '重新生成',
    },
    formats: {
      markdown: 'Markdown',
      pdf: 'PDF',
      word: 'Word',
      text: '纯文本',
    },
    copySuccess: '已复制到剪贴板',
    downloadSuccess: '下载成功',
    noContent: '暂无内容',
  },

  // 邮件发送
  email: {
    title: '发送邮件',
    sendMinutes: '发送会议纪要',
    sendMinutesToEmail: '发送会议纪要到邮箱',
    recipients: '收件人',
    recipientsLabel: '收件人邮箱',
    recipientsPlaceholder: '输入邮箱地址，按回车添加',
    recipientsInputPlaceholder: '输入收件人邮箱，按回车添加',
    addRecipient: '添加收件人',
    addButton: '添加',
    addedCount: '已添加 {count} 个收件人',
    multipleHint: '(可添加多个)',
    cc: '抄送',
    bcc: '密送',
    subject: '主题',
    subjectPlaceholder: '请输入邮件主题',
    message: '附加消息',
    messagePlaceholder: '可选：添加附加消息',
    attachments: '附件',
    includeTranscript: '包含完整转录',
    includeAudio: '包含音频文件',
    sending: '发送中...',
    sendSuccess: '邮件发送成功',
    sendFailed: '邮件发送失败',
    invalidEmail: '邮箱地址格式不正确',
    noRecipients: '请至少添加一个收件人',
    defaultSubject: '会议纪要 - {date}',
    downloadAudio: '下载音频',
  },

  // 错误消息
  errors: {
    // 网络错误
    networkError: '网络连接失败，请检查网络后重试',
    timeoutError: '请求超时，请稍后重试',
    serverError: '服务器错误，请稍后重试或联系支持团队',
    
    // 文件错误
    fileTooLarge: '文件大小超过限制（最大 {maxSize}MB）',
    invalidFileFormat: '不支持的文件格式，请上传 {formats} 文件',
    fileUploadFailed: '文件上传失败，请重试',
    fileReadFailed: '文件读取失败',
    
    // 录音错误
    micPermissionDenied: '需要麦克风权限才能录音，请在浏览器设置中允许',
    micNotFound: '未检测到麦克风设备',
    recordingFailed: '录音失败，请检查麦克风设置',
    recordingTooShort: '录音时长过短，请至少录制 3 秒',
    recordingTooLong: '录音时长已达上限（2小时），自动停止录音',
    
    // 处理错误
    processingFailed: '处理失败，请稍后重试',
    transcriptionFailed: '音频转录失败，请确保音频清晰',
    analysisFailed: '内容分析失败，请重试',
    
    // 邮件错误
    emailSendFailed: '邮件发送失败，请检查邮箱地址',
    invalidEmail: '邮箱地址格式不正确',
    noRecipients: '请至少添加一个收件人',
    
    // 通用错误
    unknownError: '发生未知错误，请刷新页面重试',
    operationCancelled: '操作已取消',
    notSupported: '您的浏览器不支持此功能',
    downloadFailed: '下载失败',
    copyFailed: '复制失败',
  },

  // 成功消息
  success: {
    fileUploaded: '文件上传成功',
    recordingSaved: '录音保存成功',
    processingCompleted: '处理完成',
    emailSent: '邮件发送成功',
    copiedToClipboard: '已复制到剪贴板',
    feedbackSubmitted: '反馈提交成功，感谢您的建议',
  },

  // 导航栏
  nav: {
    home: '首页',
    features: '产品功能',
    solutions: '解决方案',
    about: '关于我们',
    login: '登录',
    register: '注册',
    mainNavigation: '主导航',
    mobileNavigation: '移动端导航',
    toggleMenu: '切换菜单',
  },

  // 页脚
  footer: {
    // 版权信息
    copyright: '© 2024 Meet and Note. 保留所有权利。',
    allRightsReserved: '保留所有权利',
    
    // 公司描述
    companyDescription: '企业级智能会议纪要解决方案，让每一次会议都有价值。',
    
    // 栏目标题
    product: '产品',
    company: '公司',
    legal: '法律',
    
    // 产品链接
    features: '功能特性',
    pricing: '价格方案',
    solutions: '解决方案',
    integrations: '集成服务',
    
    // 公司链接
    aboutUs: '关于我们',
    careers: '加入我们',
    contactUs: '联系我们',
    blog: '博客',
    
    // 法律链接
    privacyPolicy: '隐私政策',
    termsOfService: '服务条款',
    cookiePolicy: 'Cookie 政策',
    compliance: '合规性',
    
    // 底部快捷链接
    privacy: '隐私',
    terms: '条款',
    cookies: 'Cookies',
    
    // 联系表单
    contactDescription: '有任何问题或建议？请告诉我们！',
    yourName: '您的姓名',
    yourEmail: '您的邮箱',
    yourMessage: '您的消息',
    sendMessage: '发送消息',
    
    // 旧的链接（保持兼容性）
    links: {
      about: '关于我们',
      contact: '联系我们',
      privacy: '隐私政策',
      terms: '服务条款',
      help: '帮助中心',
      feedback: '反馈建议',
    },
  },

  // 功能特性
  features: {
    title: '核心功能',
    uploadTitle: '文件上传',
    uploadDescription: '支持多种音频格式，最大 100MB',
    recordingTitle: '实时录音',
    recordingDescription: '高质量录音，支持暂停和继续',
    aiTitle: 'AI 处理',
    aiDescription: '智能转录和分析，生成结构化纪要',
    exportTitle: '多格式导出',
    exportDescription: '支持 Markdown、PDF、Word 等格式',
  },

  // 快捷键
  shortcuts: {
    title: '快捷键',
    startRecording: '开始录音',
    stopRecording: '停止录音',
    copyMinutes: '复制纪要',
    sendEmail: '发送邮件',
  },

  // 状态
  states: {
    idle: '空闲',
    recording: '录音中',
    uploading: '上传中',
    processing: '处理中',
    completed: '已完成',
    error: '错误',
  },

  // 对话框
  dialogs: {
    confirmTitle: '确认操作',
    confirmMessage: '确定要执行此操作吗？',
    discardRecording: '确定要放弃当前录音吗？',
    deleteFile: '确定要删除此文件吗？',
    unsavedChanges: '有未保存的更改，确定要离开吗？',
  },

  // 提示
  tips: {
    dragDropFile: '拖拽文件到此处上传',
    clickToSelect: '点击选择文件',
    recordingInProgress: '录音进行中，请勿关闭页面',
    processingInProgress: '处理进行中，请勿关闭页面',
    micPermissionRequired: '请允许浏览器访问麦克风',
  },

  // 实时转录
  realtimeTranscription: {
    title: '实时转录',
    subtitle: '录音同时实时转录为文字',
    startButton: '开始实时转录',
  },
};
