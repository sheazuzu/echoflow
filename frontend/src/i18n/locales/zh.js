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
    actions: {
      back: '返回',
      backHome: '返回首页',
      close: '关闭',
      retry: '重试',
      next: '下一步',
    },
  },

  // 首页/主界面
  home: {
    title: '会议纪要工具',
    subtitle: '自动分片处理大文件，输出结构化会议纪要',
    description: '上传音频文件或实时录音，自动生成结构化会议纪要',
    hero: {
      eyebrow: '音频与视频纪要工具',
      title: '把音频与视频转成结构化纪要',
      subtitle: '录音、上传或粘贴视频链接，自动转录并生成中英双语纪要。',
      legacyButton: '返回旧版界面',
      legacyHint: '想用熟悉的旧界面？',
      switchToNew: '切换到新版首页',
      switchToNewHint: '体验重新设计的主页：',
    },
    entries: {
      sectionLabel: '新建任务入口',
      recording: {
        title: '录音转录',
        description: '从浏览器直接录音，结束后自动生成纪要。',
        cta: '开始录音',
      },
      upload: {
        title: '上传音频',
        description: '已有 MP3 / M4A / WAV 文件？上传即可处理。',
        cta: '上传文件',
      },
      videoUrl: {
        title: '视频链接',
        description: '粘贴 YouTube / Bilibili 链接，自动下载并生成纪要。',
        cta: '粘贴链接',
      },
    },
    recent: {
      title: '最近任务',
      viewAll: '查看全部',
    },
  },

  // 新建任务页
  newTask: {
    back: '返回首页',
    recording: {
      title: '录音转录',
      description: '使用麦克风或系统声音录制后自动生成会议纪要。',
      heading: '使用旧版主界面进行录音',
      notice: '录音流程目前仍在旧版主界面中使用，正在迁移到本页。点击下方按钮在旧界面继续。',
      openLegacy: '打开录音入口',
    },
    upload: {
      title: '上传音频',
      description: '支持 MP3 / M4A / WAV / WebM 等常见音频格式，单文件 ≤ 50MB。',
    },
    videoUrl: {
      title: '视频链接转录',
      description: '粘贴 YouTube / Bilibili 视频链接，自动转录并生成纪要。',
    },
  },

  // 结果页
  result: {
    title: '会议纪要',
    toolbarLabel: '操作工具栏',
    tabsLabel: '语言切换',
    noContent: '暂无纪要内容',
    tabs: {
      chinese: '中文',
      english: 'English',
    },
    sections: {
      summary: '摘要',
      keyPoints: '关键讨论点',
      decisions: '决策',
      actions: '行动项',
      risks: '风险与问题',
      nextSteps: '下一步',
      transcript: '原始转录',
    },
    fields: {
      attendees: '参与人',
      due: '截止',
      unassigned: '未指定',
    },
    actions: {
      back: '返回首页',
      history: '查看历史',
      copy: '复制内容',
      copied: '已复制',
      download: '下载',
      email: '发送邮件',
      regenerate: '重新生成',
    },
  },

  // 上传功能
  upload: {
    title: '上传音频文件',
    dragDropHint: '点击或拖拽上传音频文件',
    dragDropHintUploading: '文件上传中...',
    dragDropHintActive: '松开即可上传',
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
    title: '正在处理您的任务',
    nextHint: '当前阶段完成后将自动进入下一步，请稍候。',
    stepListLabel: '处理阶段',
    cancelProcessing: '取消处理',
    stateLabels: {
      pending: '待处理',
      active: '进行中',
      completed: '已完成',
    },
    steps: {
      uploading: '上传文件中',
      uploading_to_cos: '上传文件中',
      uploaded_to_cos: '上传完成，准备处理',
      downloading_video: '下载视频中',
      downloading_from_cos: '准备音频文件',
      downloaded_from_cos: '准备音频文件',
      processing: '准备处理',
      splitting: '音频分片',
      transcribing: '语音转录',
      generating_summary: '生成结构化纪要',
      analyzing: '分析内容中…',
      generating: '生成会议纪要中…',
      completed: '处理完成',
      error: '处理出错',
      failed: '处理失败',
      cancelled: '已取消',
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
    actions: {
      retry: '重试',
      newTask: '新建任务',
      contact: '联系反馈',
      history: '查看历史',
      resubmitLink: '重新提交链接',
      useUpload: '改用文件上传',
    },
    codes: {
      unknown: {
        title: '处理失败',
        description: '出现了一个未知问题，请稍后重试或联系反馈。',
      },
      network_error: {
        title: '网络连接失败',
        description: '无法连接到服务器，请检查网络后重试。',
      },
      processing_failed: {
        title: '任务处理失败',
        description: '本次处理未能完成，您可以重试或更换输入方式。',
      },
      quota_exceeded: {
        title: '使用额度已超限',
        description: '本月可用配额已用完，请稍后再试或联系管理员。',
      },
      video_unavailable: {
        title: '视频无法访问',
        description: '该视频可能已被删除、设为私密或受地区限制。',
      },
      video_url_invalid: {
        title: '视频链接无效',
        description: '请确认链接是否完整正确，目前仅支持 YouTube 与 Bilibili。',
      },
      video_download_failed: {
        title: '视频下载失败',
        description: '尝试下载视频音频时出错，您可以重试或改用文件上传。',
      },
      video_meta_failed: {
        title: '获取视频信息失败',
        description: '无法读取视频元数据，链接可能临时不可用。',
      },
      platform_not_supported: {
        title: '平台暂不支持',
        description: '当前仅支持 YouTube 与 Bilibili 视频链接。',
      },
      live_video_unsupported: {
        title: '直播暂不支持',
        description: '请改用录播或已结束的视频链接。',
      },
      private_video: {
        title: '私密视频',
        description: '该视频为私密视频，无法访问。',
      },
      age_restricted: {
        title: '受年龄限制',
        description: '该视频受年龄限制，无法获取音频。',
      },
    },
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

  // 首次使用引导
  onboarding: {
    title: '欢迎使用 Meet and Note',
    subtitle: '选择最贴近你场景的输入方式，从一次完整体验开始。',
    skip: '稍后再说',
    recording: {
      title: '录音转录',
      description: '现场会议或访谈，浏览器内即可录制。',
    },
    upload: {
      title: '上传音频',
      description: '已有现成音频文件，直接拖拽上传。',
    },
    videoUrl: {
      title: '视频链接',
      description: '粘贴线上视频链接，无需自行下载。',
    },
  },

  // 空状态文案
  emptyState: {
    home: {
      title: '还没有任务，从这里开始',
      description: '上传一段音频或粘贴一个视频链接，自动生成结构化纪要。',
      action: '上传第一个音频',
    },
    history: {
      title: '暂无历史任务',
      description: '完成一次任务后，纪要会保存在历史中，方便查阅与复用。',
      action: '回到首页新建任务',
    },
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
    pricing: '价格方案',
    contact: '联系我们',
    login: '登录',
    register: '注册',
    account: '账号设置',
    history: '历史记录',
    admin: '管理汇总',
    logout: '退出登录',
    backHome: '返回主页',
    mainNavigation: '主导航',
    mobileNavigation: '移动端导航',
    toggleMenu: '切换菜单',
  },

  // 认证文案
  auth: {
    fields: {
      email: '邮箱',
      displayName: '显示名称',
      password: '密码',
      confirmPassword: '确认密码',
      resetToken: '重置令牌',
    },
    placeholders: {
      email: '请输入登录邮箱',
      displayName: '请输入您的名称',
      password: '请输入密码（至少 8 位，含字母和数字）',
      confirmPassword: '请再次输入密码',
      resetToken: '请输入重置令牌',
    },
    validation: {
      passwordMismatch: '两次输入的密码不一致',
    },
    messages: {
      genericError: '账号操作失败，请稍后重试',
      submitting: '提交中...',
      resetRequested: '如果邮箱存在，我们已生成重置流程。',
      resetCompleted: '密码重置成功，请重新登录。',
      serviceUnavailable: '服务暂时不可用，请稍后再试',
    },
    login: {
      title: '欢迎回来',
      description: '登录后继续处理您的会议录音和纪要。',
      submit: '登录',
      switch: '已有账号？去登录',
    },
    register: {
      title: '创建账号',
      description: '注册后即可安全保存您的处理任务和会议成果。',
      submit: '注册并进入产品',
      switch: '没有账号？去注册',
    },
    forgot: {
      title: '忘记密码',
      description: '输入注册邮箱，我们会生成一个可用于重置密码的令牌。',
      submit: '生成重置令牌',
      link: '忘记密码',
      tokenHint: '开发环境重置令牌：',
    },
    reset: {
      title: '重置密码',
      description: '输入重置令牌并设置新密码。',
      submit: '确认重置密码',
      link: '已有重置令牌',
    },
  },

  // 账号设置文案
  account: {
    eyebrow: '账号中心',
    title: '账号设置',
    description: '管理您的基础资料、登录信息与安全设置。',
    meta: {
      email: '登录邮箱',
      role: '账号角色',
      createdAt: '注册时间',
      lastLoginAt: '最近登录',
    },
    messages: {
      profileSaved: '账号资料已保存',
      profileError: '保存资料失败',
      passwordSaved: '密码已更新',
      passwordError: '更新密码失败',
    },
    profile: {
      title: '基础资料',
      description: '您可以在这里维护显示名称、时区和个人说明。',
      timezone: '时区',
      timezonePlaceholder: '例如：Asia/Shanghai',
      bio: '个人说明',
      bioPlaceholder: '一句话介绍您自己或当前使用场景',
      submit: '保存资料',
    },
    password: {
      title: '修改密码',
      description: '建议定期更新密码以确保账号安全。',
      current: '当前密码',
      new: '新密码',
      submit: '更新密码',
    },
  },

  history: {
    title: '业务历史',
    subtitle: '查看您之前的转录处理、会议纪要生成及相关处理结果。',
    summaryTitle: '历史概览',
    emptyTitle: '还没有业务记录',
    emptyDescription: '当您上传音频并完成转录或会议纪要生成后，这里会显示对应记录。',
    noMatchTitle: '没有匹配的记录',
    noMatchDescription: '请尝试清空筛选条件或调整关键词。',
    filters: {
      keyword: '搜索关键词',
      keywordPlaceholder: '搜索标题、摘要、文件名或类型',
      activityType: '活动类型',
      status: '处理状态',
      dateFrom: '开始时间',
      dateTo: '结束时间',
      clear: '清空筛选',
      allTypes: '全部类型',
      allStatuses: '全部状态',
    },
    pagination: {
      previous: '上一页',
      next: '下一页',
      pageInfo: '第 {page} / {totalPages} 页',
    },
    analytics: {
      totalRecords: '总记录数',
      activityTypes: '活动类型数',
      successRecords: '成功记录数',
      recentDays: '近 14 天趋势',
    },
    activityTypes: {
      upload_task: '转录与纪要任务',
      video_url_task: '视频链接转录',
    },
    statuses: {
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    },
    detail: {
      title: '记录详情',
      close: '关闭',
      summary: '结果摘要',
      metadata: '扩展信息',
    },
    messages: {
      loadFailed: '加载历史记录失败，请稍后重试。',
    },
  },

  adminDashboard: {
    title: '管理员业务汇总',
    subtitle: '查看所有用户的核心业务记录、筛选结果与整体趋势分析。',
    viewer: '当前管理员',
    filters: {
      keywordPlaceholder: '搜索用户、标题、摘要、文件名',
      user: '全部用户',
      activityType: '全部类型',
      status: '全部状态',
      clear: '清空筛选',
    },
    overview: {
      totalRecords: '总记录数',
      activeUsers: '活跃用户数',
      statusDistribution: '状态分布',
      typeDistribution: '类型分布',
    },
    empty: '当前筛选条件下没有记录。',
    messages: {
      loadFailed: '加载管理员汇总失败，请稍后重试。',
      noPermission: '您没有访问管理员汇总的权限。',
    },
  },

  // 价格方案弹窗
  pricingModal: {
    title: '价格方案',
    subtitle: '选择适合您的方案，所有方案均为示例价格',
    popularBadge: '最受欢迎',
    footerNote: '* 以上价格均为示例，实际价格以正式发布为准。所有方案均含 14 天免费试用。',
    plans: {
      personal: {
        name: '个人版',
        price: '¥29',
        period: '/ 月',
        description: '适合个人用户日常会议记录',
        features: [
          '每月最多 10 小时录音',
          '基础 AI 会议纪要',
          '支持 MP3 / M4A / WAV',
          '邮件导出',
          '7 天历史记录',
        ],
        cta: '免费试用',
      },
      developer: {
        name: '开发者版',
        price: '¥99',
        period: '/ 月',
        description: '适合开发者和小型团队',
        features: [
          '每月最多 50 小时录音',
          '高级 AI 结构化纪要',
          '支持所有音频格式',
          'API 访问权限',
          '多格式导出（PDF / Word）',
          '30 天历史记录',
          '优先邮件支持',
        ],
        cta: '立即开始',
      },
      enterprise: {
        name: '企业版',
        price: '联系我们',
        period: '',
        description: '适合大型企业和团队定制化需求',
        features: [
          '无限录音时长',
          '企业级 AI 定制模型',
          '私有化部署选项',
          '团队协作功能',
          '无限历史记录',
          '专属客户成功经理',
          'SLA 服务保障',
        ],
        cta: '联系销售',
      },
    },
  },

  // 联系/反馈弹窗
  contactModal: {
    title: '联系我们',
    subtitle: '有任何问题或建议？欢迎告诉我们！',
    namePlaceholder: '您的姓名',
    emailPlaceholder: '您的邮箱',
    messagePlaceholder: '请描述您的问题或建议（至少10个字符）',
    submit: '提交反馈',
    submitting: '提交中...',
    successTitle: '提交成功！',
    successMessage: '感谢您的反馈，我们会尽快回复您。',
    nameRequired: '请输入您的姓名',
    emailRequired: '请输入您的邮箱',
    emailInvalid: '邮箱格式不正确',
    messageRequired: '请输入反馈内容',
    messageTooShort: '反馈内容至少需要10个字符',
    messageTooLong: '反馈内容不能超过5000个字符',
    submitFailed: '提交失败，请稍后重试',
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

  // 产品功能页面
  featurePage: {
    hero: {
      title: '产品功能全览',
      description: 'Meet and Note 提供从录音到结构化会议纪要的完整 AI 工作流，让每一次会议都有价值。',
    },
    cta: {
      title: '立即开始使用',
      description: '无需注册，打开即用。上传音频或开始录音，AI 为您生成专业会议纪要。',
      button: '返回首页，开始使用',
    },
  },

  // 视频链接转录模块（YouTube / Bilibili）
  videoUrl: {
    title: '视频链接转录',
    subtitle: '粘贴 YouTube 或 Bilibili 视频链接，自动转录并生成中英双语纪要。',
    urlPlaceholder: '请粘贴 YouTube 或 Bilibili 视频链接...',
    submit: '开始转录',
    submitting: '提交中...',
    errorLabel: '处理失败',
    taskStarted: '任务已启动，任务编号：{fileId}',
    platform: {
      youtube: 'YouTube',
      bilibili: 'Bilibili',
      unsupported: '不支持的平台',
    },
    hints: {
      playlistOnlyCurrent: '检测到播放列表或分 P 参数，仅会转录当前单个视频。',
    },
    meta: {
      platform: '平台',
      duration: '时长',
      uploader: 'UP 主',
    },
    progress: {
      fetchingMeta: '正在获取视频信息...',
      downloading_video: '正在下载视频音频…',
    },
    errors: {
      unsupported_platform: '仅支持 YouTube 和 Bilibili 视频链接。',
      not_a_video_url: '链接看起来不是有效的视频地址。',
      video_unavailable: '视频不可用或已被删除。',
      geo_restricted: '该视频在当前地区不可访问。',
      private_video: '该视频为私密视频，需要登录后才能访问。',
      age_restricted: '该视频受年龄限制，需要登录后才能访问。',
      network_error: '访问视频时网络异常，请稍后重试。',
      timeout: '视频下载超时，请尝试较短的视频或稍后重试。',
      yt_dlp_missing: '服务器未安装 yt-dlp，请联系管理员。',
      duration_exceeded: '视频时长超过限制，请提交较短的视频。',
      size_exceeded: '视频音频体积超过限制，请选择较短的视频。',
      rate_limited: '提交过于频繁，请稍后再试。',
      unknown: '处理失败，请稍后重试。',
    },
  },
};