/**
 * 实时转录模块国际化配置
 */

export const realtimeTranscriptionI18n = {
  zh: {
    // 标题和标识
    title: '实时转录',
    betaBadge: 'BETA',
    
    // 状态文本
    status: {
      listening: '正在监听...',
      paused: '已暂停',
      processing: '正在转录...',
      idle: '未开始',
      error: '连接错误',
      connected: '已连接',
      notRecording: '未录音',
      recording: '正在录音',
      recordingPaused: '录音已暂停',
      transcribing: '实时转录中',
      transcriptionNotStarted: '转录未启动'
    },
    
    // 占位符文本
    placeholder: {
      idle: '点击开始录音按钮，实时转录文字将显示在这里...',
      listening: '等待语音输入...',
      paused: '录音已暂停'
    },
    
    // 按钮文本
    buttons: {
      copy: '复制',
      download: '下载',
      generateSummary: '生成纪要',
      sendEmail: '发送邮件',
      clear: '清空',
      start: '开始录音',
      pause: '暂停',
      resume: '继续',
      stop: '停止',
      add: '添加',
      cancel: '取消',
      send: '发送邮件',
      sending: '发送中...'
    },
    
    // 提示文本
    hints: {
      scrollToBottom: '点击回到底部',
      charCount: '字符数',
      recipients: '收件人'
    },
    
    // 标题文本
    titles: {
      copyTranscription: '复制转录文字',
      downloadAsText: '下载为文本文件',
      generateMeetingSummary: '生成会议纪要',
      sendEmail: '发送邮件',
      clearTranscription: '清空转录文字'
    },
    
    // 控制面板
    controlPanel: {
      title: '智能录音助手',
      enableTranscription: '启用实时转录',
      language: '语言',
      browserNotSupported: '您的浏览器不支持录音功能',
      uiLanguage: 'UI',
      autoDetect: '自动检测'
    },
    
    // 语言选项
    languageOptions: {
      chinese: '中文',
      english: 'English',
      japanese: '日本語',
      korean: '한국어',
      spanish: 'Español',
      french: 'Français',
      german: 'Deutsch'
    },
    
    // 邮件对话框
    emailDialog: {
      title: '发送会议纪要',
      inputPlaceholder: '输入收件人邮箱',
      recipientsLabel: '收件人'
    },
    
    // 通知消息
    notifications: {
      transcriptionTooShort: '转录文字太短，无法生成有效的会议纪要',
      generatingSummary: '正在生成会议纪要，请稍候...',
      summarySuccess: '会议纪要生成成功！',
      summaryCopied: '会议纪要已复制到剪贴板',
      emailTooShort: '转录文字太短，无法发送邮件',
      enterEmail: '请输入邮箱地址',
      invalidEmail: '邮箱格式不正确',
      emailExists: '该邮箱已添加',
      addRecipient: '请至少添加一个收件人',
      sendingEmail: '正在发送邮件...',
      emailSuccess: '邮件发送成功！',
      generateSummaryFirst: '请先生成会议纪要',
      noContentToCopy: '没有可复制的内容',
      copiedToClipboard: '已复制到剪贴板',
      copyFailed: '复制失败',
      noContentToDownload: '没有可下载的内容',
      downloadSuccess: '转录文字已下载',
      downloadFailed: '下载失败',
      micAccessFailed: '无法访问麦克风，请检查权限设置',
      transcriptionStartFailed: '启动转录失败'
    }
  },
  
  // English version
  en: {
    // Title and Badge
    title: 'Real-time Transcription',
    betaBadge: 'BETA',
    
    // Status Text
    status: {
      listening: 'Listening...',
      paused: 'Paused',
      processing: 'Transcribing...',
      idle: 'Not Started',
      error: 'Connection Error',
      connected: 'Connected',
      notRecording: 'Not Recording',
      recording: 'Recording',
      recordingPaused: 'Recording Paused',
      transcribing: 'Transcribing',
      transcriptionNotStarted: 'Transcription Not Started'
    },
    
    // Placeholder Text
    placeholder: {
      idle: 'Click the start recording button, real-time transcription will appear here...',
      listening: 'Waiting for voice input...',
      paused: 'Recording paused'
    },
    
    // Button Text
    buttons: {
      copy: 'Copy',
      download: 'Download',
      generateSummary: 'Generate Summary',
      sendEmail: 'Send Email',
      clear: 'Clear',
      start: 'Start Recording',
      pause: 'Pause',
      resume: 'Resume',
      stop: 'Stop',
      add: 'Add',
      cancel: 'Cancel',
      send: 'Send Email',
      sending: 'Sending...'
    },
    
    // Hint Text
    hints: {
      scrollToBottom: 'Click to scroll to bottom',
      charCount: 'Characters',
      recipients: 'Recipients'
    },
    
    // Title Text
    titles: {
      copyTranscription: 'Copy transcription text',
      downloadAsText: 'Download as text file',
      generateMeetingSummary: 'Generate meeting summary',
      sendEmail: 'Send email',
      clearTranscription: 'Clear transcription text'
    },
    
    // Control Panel
    controlPanel: {
      title: 'Smart Recording Assistant',
      enableTranscription: 'Enable Real-time Transcription',
      language: 'Language',
      browserNotSupported: 'Your browser does not support recording',
      uiLanguage: 'UI',
      autoDetect: 'Auto Detect'
    },
    
    // Language Options
    languageOptions: {
      chinese: 'Chinese',
      english: 'English',
      japanese: 'Japanese',
      korean: 'Korean',
      spanish: 'Spanish',
      french: 'French',
      german: 'German'
    },
    
    // Email Dialog
    emailDialog: {
      title: 'Send Meeting Summary',
      inputPlaceholder: 'Enter recipient email',
      recipientsLabel: 'Recipients'
    },
    
    // Notification Messages
    notifications: {
      transcriptionTooShort: 'Transcription text is too short to generate a valid meeting summary',
      generatingSummary: 'Generating meeting summary, please wait...',
      summarySuccess: 'Meeting summary generated successfully!',
      summaryCopied: 'Meeting summary copied to clipboard',
      emailTooShort: 'Transcription text is too short to send email',
      enterEmail: 'Please enter an email address',
      invalidEmail: 'Invalid email format',
      emailExists: 'This email has already been added',
      addRecipient: 'Please add at least one recipient',
      sendingEmail: 'Sending email...',
      emailSuccess: 'Email sent successfully!',
      generateSummaryFirst: 'Please generate meeting summary first',
      noContentToCopy: 'No content to copy',
      copiedToClipboard: 'Copied to clipboard',
      copyFailed: 'Copy failed',
      noContentToDownload: 'No content to download',
      downloadSuccess: 'Transcription text downloaded',
      downloadFailed: 'Download failed',
      micAccessFailed: 'Cannot access microphone, please check permissions',
      transcriptionStartFailed: 'Failed to start transcription'
    }
  }
};

/**
 * 获取指定语言的文本
 */
export const getI18nText = (lang = 'zh') => {
  return realtimeTranscriptionI18n[lang] || realtimeTranscriptionI18n.zh;
};
