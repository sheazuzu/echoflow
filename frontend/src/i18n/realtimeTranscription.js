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
    
    // 音频源设置
    audioSource: {
      advancedSettings: '高级设置',
      audioSourceSettings: '音频源设置',
      allSources: '所有音频源（推荐）',
      allSourcesDesc: '自动捕获麦克风和系统音频',
      microphoneOnly: '仅麦克风',
      microphoneOnlyDesc: '只录制麦克风音频',
      systemAudioOnly: '仅系统音频',
      systemAudioOnlyDesc: '只录制系统播放的音频',
      microphoneAndSystem: '麦克风 + 系统音频',
      microphoneAndSystemDesc: '同时录制麦克风和系统音频',
      microphone: '麦克风',
      systemAudio: '系统音频',
      active: '活跃',
      inactive: '不可用',
      notUsed: '未使用',
      statusTitle: '音频源状态',
      requestingMicPermission: '正在请求麦克风权限...',
      requestingSystemAudioPermission: '正在请求系统音频权限...'
    },
    
    // 引导提示
    guide: {
      firstTimeTitle: '💡 使用提示',
      firstTimeMessage: '系统将自动捕获麦克风和系统音频，点击"开始录音"即可开始实时转录。如需自定义音频源，请展开"高级设置"。',
      permissionExplanation: '需要访问麦克风和系统音频以进行实时转录',
      advancedSettingsTooltip: '自定义音频源设置',
      gotIt: '知道了'
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
      transcriptionStartFailed: '启动转录失败',
      micPermissionDenied: '麦克风权限被拒绝，请在浏览器设置中允许访问',
      systemAudioCancelled: '系统音频捕获已取消，将仅使用麦克风录音',
      browserNotSupportSystemAudio: '当前浏览器不支持系统音频捕获，将仅使用麦克风录音',
      allAudioSourcesFailed: '无法访问任何音频设备，请检查权限设置',
      audioStreamInterrupted: '音频流已中断，录音已停止',
      recordingStarted: '录音已开始',
      recordingStopped: '录音已停止'
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
    
    // Audio Source Settings
    audioSource: {
      advancedSettings: 'Advanced Settings',
      audioSourceSettings: 'Audio Source Settings',
      allSources: 'All Audio Sources (Recommended)',
      allSourcesDesc: 'Auto capture microphone and system audio',
      microphoneOnly: 'Microphone Only',
      microphoneOnlyDesc: 'Record microphone audio only',
      systemAudioOnly: 'System Audio Only',
      systemAudioOnlyDesc: 'Record system audio only',
      microphoneAndSystem: 'Microphone + System Audio',
      microphoneAndSystemDesc: 'Record both microphone and system audio',
      microphone: 'Microphone',
      systemAudio: 'System Audio',
      active: 'Active',
      inactive: 'Unavailable',
      notUsed: 'Not Used',
      statusTitle: 'Audio Source Status',
      requestingMicPermission: 'Requesting microphone permission...',
      requestingSystemAudioPermission: 'Requesting system audio permission...'
    },
    
    // Guide Tips
    guide: {
      firstTimeTitle: '💡 Usage Tips',
      firstTimeMessage: 'The system will automatically capture microphone and system audio. Click "Start Recording" to begin real-time transcription. To customize audio sources, expand "Advanced Settings".',
      permissionExplanation: 'Need to access microphone and system audio for real-time transcription',
      advancedSettingsTooltip: 'Customize audio source settings',
      gotIt: 'Got it'
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
      transcriptionStartFailed: 'Failed to start transcription',
      micPermissionDenied: 'Microphone permission denied, please allow access in browser settings',
      systemAudioCancelled: 'System audio capture cancelled, will use microphone only',
      browserNotSupportSystemAudio: 'Current browser does not support system audio capture, will use microphone only',
      allAudioSourcesFailed: 'Cannot access any audio device, please check permissions',
      audioStreamInterrupted: 'Audio stream interrupted, recording stopped',
      recordingStarted: 'Recording started',
      recordingStopped: 'Recording stopped'
    }
  }
};

/**
 * 获取指定语言的文本
 */
export const getI18nText = (lang = 'zh') => {
  return realtimeTranscriptionI18n[lang] || realtimeTranscriptionI18n.zh;
};
