/**
 * English Translation Resources
 * @type {import('../types').Translations}
 */
export default {
  // Common text
  common: {
    appName: 'Meet and Note',
    buttons: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      submit: 'Submit',
      reset: 'Reset',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      retry: 'Retry',
      refresh: 'Refresh',
      download: 'Download',
      upload: 'Upload',
      copy: 'Copy',
      copied: 'Copied',
      send: 'Send',
      minimize: 'Minimize',
      maximize: 'Maximize',
    },
    labels: {
      loading: 'Loading...',
      processing: 'Processing...',
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
      optional: 'Optional',
      required: 'Required',
    },
    messages: {
      noData: 'No data available',
      operationSuccess: 'Operation successful',
      operationFailed: 'Operation failed',
      confirmDelete: 'Are you sure you want to delete?',
      unsavedChanges: 'You have unsaved changes',
    },
    units: {
      seconds: 'seconds',
      minutes: 'minutes',
      hours: 'hours',
      bytes: 'bytes',
      kb: 'KB',
      mb: 'MB',
      gb: 'GB',
    },
    actions: {
      back: 'Back',
      backHome: 'Back to home',
      close: 'Close',
      retry: 'Retry',
      next: 'Next',
    },
  },

  // Home/Main interface
  home: {
    title: 'Meeting Minutes Generator',
    subtitle: 'Auto-chunking for large files · Structured output',
    description: 'Upload audio files or record in real-time, automatically generate structured meeting minutes',
    hero: {
      eyebrow: 'Audio & video to notes',
      title: 'Turn audio and video into structured minutes',
      subtitle: 'Record, upload or paste a video link—we transcribe it and generate bilingual minutes for you.',
      legacyButton: 'Open legacy view',
      legacyHint: 'Prefer the classic interface?',
      switchToNew: 'Switch to new home',
      switchToNewHint: 'Try the redesigned home:',
    },
    entries: {
      sectionLabel: 'Start a new task',
      recording: {
        title: 'Recording',
        description: 'Record from your browser, get minutes when you stop.',
        cta: 'Start recording',
      },
      upload: {
        title: 'Upload audio',
        description: 'Already have an MP3 / M4A / WAV? Upload to process.',
        cta: 'Upload file',
      },
      videoUrl: {
        title: 'Video link',
        description: 'Paste a YouTube / Bilibili URL and we handle the rest.',
        cta: 'Paste link',
      },
    },
    recent: {
      title: 'Recent tasks',
      viewAll: 'View all',
    },
  },

  // New task page
  newTask: {
    back: 'Back to home',
    recording: {
      title: 'Recording',
      description: 'Record using microphone or system audio, then auto-generate minutes.',
      heading: 'Use legacy interface to record',
      notice: 'Recording flow is still in the legacy main view and is being migrated. Click below to continue in the legacy interface.',
      openLegacy: 'Open recorder',
    },
    upload: {
      title: 'Upload audio',
      description: 'Supports MP3 / M4A / WAV / WebM, single file up to 50MB.',
    },
    videoUrl: {
      title: 'Video link transcription',
      description: 'Paste a YouTube / Bilibili link, we download and summarize it for you.',
    },
  },

  // Result page
  result: {
    title: 'Meeting minutes',
    toolbarLabel: 'Result toolbar',
    tabsLabel: 'Language tabs',
    noContent: 'No minutes content yet',
    tabs: {
      chinese: '中文',
      english: 'English',
    },
    sections: {
      summary: 'Summary',
      keyPoints: 'Key discussion points',
      decisions: 'Decisions',
      actions: 'Action items',
      risks: 'Risks & issues',
      nextSteps: 'Next steps',
      transcript: 'Original transcript',
    },
    fields: {
      attendees: 'Attendees',
      due: 'Due',
      unassigned: 'Unassigned',
    },
    actions: {
      back: 'Back to home',
      history: 'View history',
      copy: 'Copy content',
      copied: 'Copied',
      download: 'Download',
      email: 'Send email',
      regenerate: 'Regenerate',
    },
  },

  // Upload functionality
  upload: {
    title: 'Upload Audio File',
    dragDropHint: 'Click or drag to upload audio file',
    dragDropHintUploading: 'Uploading file...',
    dragDropHintActive: 'Release to upload',
    selectFile: 'Select File',
    supportedFormats: 'Supports MP3 / M4A / WAV / WebM and other audio formats',
    supportedFormatsUploading: 'Please wait, uploading your audio file...',
    maxFileSize: 'Max file size: {size}MB',
    uploading: 'Uploading...',
    uploadProgress: 'Upload progress: {progress}%',
    uploadSuccess: 'File uploaded successfully',
    uploadFailed: 'File upload failed',
    processing: 'Processing, please wait...',
    fileInfo: 'File Information',
    fileName: 'File Name',
    fileSize: 'File Size',
    duration: 'Duration',
  },

  // Recording functionality
  recording: {
    title: 'Real-time Recording & Transcription',
    subtitle: 'Click to start recording, real-time transcription of meeting content',
    startRecording: 'Start Recording',
    stopRecording: 'Stop Recording',
    pauseRecording: 'Pause Recording',
    resumeRecording: 'Resume Recording',
    recording: 'Recording...',
    paused: 'Paused',
    duration: 'Recording Duration',
    recordingTime: '{time}',
    saveRecording: 'Save Recording',
    discardRecording: 'Discard Recording',
    cancelRecording: 'Cancel Recording',
    downloadRecording: 'Download Recording File',
    downloadOptions: 'Download Options',
    downloadFileName: 'File Name',
    downloadFormat: 'Format',
    recordingCompleted: 'Recording Completed!',
    downloadBackupHint: 'You can download the recording file as a backup',
    downloadReady: 'Recording ready for download',
    downloadHint: 'You can download the recording or continue processing',
    continueProcessing: 'Continue Processing',
    autoSaveHint: 'Recording will be automatically saved and processed into meeting minutes',
    micPermissionRequired: 'Microphone permission required',
    micPermissionDenied: 'Microphone permission denied',
    noMicFound: 'No microphone device detected',
    downloadMinimized: 'Download Recording',
    // Audio source selection
    selectAudioSource: 'Select Audio Source',
    microphoneDevices: 'Microphone Devices',
    systemAudio: 'System Audio',
    systemAudioDescription: 'System Audio (Screen Share Audio)',
    safariNotSupported: 'Note: Safari browser does not support system audio recording',
    confirmAndStart: 'Confirm and Start Recording',
  },

  // Processing steps
  processing: {
    title: 'Processing your task',
    nextHint: 'You will be moved to the next step automatically. Please wait.',
    stepListLabel: 'Processing stages',
    cancelProcessing: 'Cancel Processing',
    stateLabels: {
      pending: 'Pending',
      active: 'In progress',
      completed: 'Completed',
    },
    steps: {
      uploading: 'Uploading file',
      uploading_to_cos: 'Uploading file',
      uploaded_to_cos: 'Upload complete, preparing',
      downloading_video: 'Downloading video',
      downloading_from_cos: 'Preparing audio file',
      downloaded_from_cos: 'Preparing audio file',
      processing: 'Getting ready',
      splitting: 'Audio segmentation',
      transcribing: 'Speech transcription',
      generating_summary: 'Generating structured minutes',
      analyzing: 'Analyzing content…',
      generating: 'Generating meeting minutes…',
      completed: 'Processing completed',
      error: 'Processing error',
      failed: 'Processing failed',
      cancelled: 'Cancelled',
    },
    progress: 'Progress: {progress}%',
    estimatedTime: 'Estimated time remaining: {time}',
    pleaseWait: 'Please wait, processing your audio...',
  },

  // Meeting minutes
  minutes: {
    title: 'Meeting Minutes',
    completed: 'Meeting Minutes Generated',
    newMeeting: 'New Meeting',
    copyContent: 'Copy Content',
    originalTranscript: 'Original Transcript',
    sections: {
      meetingInfo: 'Meeting Information',
      meetingTitle: 'Meeting Title',
      meetingDate: 'Meeting Date',
      meetingTime: 'Meeting Time',
      participants: 'Participants',
      location: 'Location',
      summary: 'Summary',
      keyPoints: 'Key Points',
      decisions: 'Decisions',
      actionItems: 'Action Items',
      nextSteps: 'Next Steps',
      notes: 'Notes',
      transcript: 'Transcript',
      fullTranscript: 'Full Transcript',
    },
    actions: {
      copyMinutes: 'Copy Minutes',
      copyTranscript: 'Copy Text',
      downloadMinutes: 'Download Minutes',
      downloadTranscript: 'Download Transcript',
      sendEmail: 'Send Email',
      print: 'Print',
      share: 'Share',
      edit: 'Edit',
      regenerate: 'Regenerate',
    },
    formats: {
      markdown: 'Markdown',
      pdf: 'PDF',
      word: 'Word',
      text: 'Plain Text',
    },
    copySuccess: 'Copied to clipboard',
    downloadSuccess: 'Download successful',
    noContent: 'No content available',
  },

  // Email sending
  email: {
    title: 'Send Email',
    sendMinutes: 'Send Meeting Minutes',
    sendMinutesToEmail: 'Send Meeting Minutes to Email',
    recipients: 'Recipients',
    recipientsLabel: 'Recipient Email',
    recipientsPlaceholder: 'Enter email address, press Enter to add',
    recipientsInputPlaceholder: 'Enter recipient email, press Enter to add',
    addRecipient: 'Add Recipient',
    addButton: 'Add',
    addedCount: '{count} recipient(s) added',
    multipleHint: '(Multiple allowed)',
    cc: 'CC',
    bcc: 'BCC',
    subject: 'Subject',
    subjectPlaceholder: 'Enter email subject',
    message: 'Additional Message',
    messagePlaceholder: 'Optional: Add additional message',
    attachments: 'Attachments',
    includeTranscript: 'Include full transcript',
    includeAudio: 'Include audio file',
    sending: 'Sending...',
    sendSuccess: 'Email sent successfully',
    sendFailed: 'Email sending failed',
    invalidEmail: 'Invalid email address format',
    noRecipients: 'Please add at least one recipient',
    defaultSubject: 'Meeting Minutes - {date}',
    downloadAudio: 'Download Audio',
  },

  // Error messages
  errors: {
    actions: {
      retry: 'Retry',
      newTask: 'New task',
      contact: 'Contact support',
      history: 'View history',
      resubmitLink: 'Resubmit link',
      useUpload: 'Switch to upload',
    },
    codes: {
      unknown: {
        title: 'Something went wrong',
        description: 'An unknown issue occurred. Please retry or contact support.',
      },
      network_error: {
        title: 'Network connection failed',
        description: 'We could not reach the server. Check your network and retry.',
      },
      processing_failed: {
        title: 'Task processing failed',
        description: 'The task could not finish. You can retry or try a different input.',
      },
      quota_exceeded: {
        title: 'Quota exhausted',
        description: 'Your monthly quota is used up. Please retry later or contact admin.',
      },
      video_unavailable: {
        title: 'Video unavailable',
        description: 'This video may be removed, private, or region-restricted.',
      },
      video_url_invalid: {
        title: 'Invalid video link',
        description: 'Please confirm the URL is correct. Only YouTube and Bilibili are supported.',
      },
      video_download_failed: {
        title: 'Video download failed',
        description: 'Could not fetch the audio. You can retry or upload a file instead.',
      },
      video_meta_failed: {
        title: 'Failed to load video info',
        description: 'We could not read the video metadata. The link may be temporarily unavailable.',
      },
      platform_not_supported: {
        title: 'Platform not supported',
        description: 'Only YouTube and Bilibili links are supported right now.',
      },
      live_video_unsupported: {
        title: 'Live streams unsupported',
        description: 'Please use a recorded or finished video instead.',
      },
      private_video: {
        title: 'Private video',
        description: 'This video is private and cannot be accessed.',
      },
      age_restricted: {
        title: 'Age-restricted video',
        description: 'This video is age-restricted and the audio cannot be fetched.',
      },
    },
    // Network errors
    networkError: 'Network connection failed, please check your network and try again',
    timeoutError: 'Request timeout, please try again later',
    serverError: 'Server error, please try again later or contact support',
    
    // File errors
    fileTooLarge: 'File size exceeds limit (max {maxSize}MB)',
    invalidFileFormat: 'Unsupported file format, please upload {formats} files',
    fileUploadFailed: 'File upload failed, please try again',
    fileReadFailed: 'File read failed',
    
    // Recording errors
    micPermissionDenied: 'Microphone permission required for recording, please allow in browser settings',
    micNotFound: 'No microphone device detected',
    recordingFailed: 'Recording failed, please check microphone settings',
    recordingTooShort: 'Recording too short, please record at least 3 seconds',
    recordingTooLong: 'Recording duration limit reached (2 hours), automatically stopped',
    
    // Processing errors
    processingFailed: 'Processing failed, please try again later',
    transcriptionFailed: 'Audio transcription failed, please ensure audio is clear',
    analysisFailed: 'Content analysis failed, please try again',
    
    // Email errors
    emailSendFailed: 'Email sending failed, please check email address',
    invalidEmail: 'Invalid email address format',
    noRecipients: 'Please add at least one recipient',
    
    // General errors
    unknownError: 'Unknown error occurred, please refresh the page and try again',
    operationCancelled: 'Operation cancelled',
    notSupported: 'Your browser does not support this feature',
    downloadFailed: 'Download failed',
    copyFailed: 'Copy failed',
  },

  // First-use guide
  onboarding: {
    title: 'Welcome to Meet and Note',
    subtitle: 'Pick the input that matches your scenario and finish your first task end-to-end.',
    skip: 'Skip for now',
    recording: {
      title: 'Recording',
      description: 'Capture meetings or interviews directly in the browser.',
    },
    upload: {
      title: 'Upload audio',
      description: 'Drop in an existing MP3 / M4A / WAV file.',
    },
    videoUrl: {
      title: 'Video link',
      description: 'Paste a public video URL—no manual download needed.',
    },
  },

  // Empty states
  emptyState: {
    home: {
      title: 'No tasks yet — start here',
      description: 'Upload an audio clip or paste a video URL. We will turn it into structured minutes for you.',
      action: 'Upload your first audio',
    },
    history: {
      title: 'No history yet',
      description: 'Once you finish a task, the minutes will be saved here for reuse.',
      action: 'Back to home to start a task',
    },
  },

  // Success messages
  success: {
    fileUploaded: 'File uploaded successfully',
    recordingSaved: 'Recording saved successfully',
    processingCompleted: 'Processing completed',
    emailSent: 'Email sent successfully',
    copiedToClipboard: 'Copied to clipboard',
    feedbackSubmitted: 'Feedback submitted successfully, thank you for your suggestion',
  },

  // Navigation
  nav: {
    home: 'Home',
    features: 'Features',
    pricing: 'Pricing',
    contact: 'Contact',
    login: 'Login',
    register: 'Register',
    account: 'Account',
    history: 'History',
    admin: 'Admin',
    logout: 'Logout',
    backHome: 'Back to Home',
    mainNavigation: 'Main Navigation',
    mobileNavigation: 'Mobile Navigation',
    toggleMenu: 'Toggle Menu',
  },

  // Pricing Modal
  pricingModal: {
    title: 'Pricing Plans',
    subtitle: 'Choose the plan that fits you best. All prices are for illustration purposes.',
    popularBadge: 'Most Popular',
    footerNote: '* All prices shown are examples. Actual pricing will be announced at launch. All plans include a 14-day free trial.',
    plans: {
      personal: {
        name: 'Personal',
        price: '$4',
        period: '/ month',
        description: 'Perfect for individuals tracking daily meetings',
        features: [
          'Up to 10 hours recording / month',
          'Basic AI meeting minutes',
          'MP3 / M4A / WAV support',
          'Email export',
          '7-day history',
        ],
        cta: 'Start Free Trial',
      },
      developer: {
        name: 'Developer',
        price: '$14',
        period: '/ month',
        description: 'Great for developers and small teams',
        features: [
          'Up to 50 hours recording / month',
          'Advanced AI structured minutes',
          'All audio formats supported',
          'API access',
          'Multi-format export (PDF / Word)',
          '30-day history',
          'Priority email support',
        ],
        cta: 'Get Started',
      },
      enterprise: {
        name: 'Enterprise',
        price: 'Contact Us',
        period: '',
        description: 'Custom solutions for large teams and enterprises',
        features: [
          'Unlimited recording hours',
          'Enterprise-grade custom AI model',
          'Private deployment option',
          'Team collaboration features',
          'Unlimited history',
          'Dedicated customer success manager',
          'SLA guarantee',
        ],
        cta: 'Contact Sales',
      },
    },
  },

  // Contact/Feedback Modal
  contactModal: {
    title: 'Contact Us',
    subtitle: 'Have any questions or suggestions? We\'d love to hear from you!',
    namePlaceholder: 'Your Name',
    emailPlaceholder: 'Your Email',
    messagePlaceholder: 'Describe your question or suggestion (at least 10 characters)',
    submit: 'Submit Feedback',
    submitting: 'Submitting...',
    successTitle: 'Submitted Successfully!',
    successMessage: 'Thank you for your feedback. We will get back to you as soon as possible.',
    nameRequired: 'Please enter your name',
    emailRequired: 'Please enter your email',
    emailInvalid: 'Invalid email format',
    messageRequired: 'Please enter your feedback',
    messageTooShort: 'Feedback must be at least 10 characters',
    messageTooLong: 'Feedback cannot exceed 5000 characters',
    submitFailed: 'Submission failed, please try again later',
  },

  // Footer
  footer: {
    // Copyright
    copyright: '© 2024 Meet and Note. All rights reserved.',
    allRightsReserved: 'All Rights Reserved',
    
    // Company description
    companyDescription: 'Enterprise-grade intelligent meeting minutes solution, making every meeting valuable.',
    
    // Column titles
    product: 'Product',
    company: 'Company',
    legal: 'Legal',
    
    // Product links
    features: 'Features',
    pricing: 'Pricing',
    solutions: 'Solutions',
    integrations: 'Integrations',
    
    // Company links
    aboutUs: 'About Us',
    careers: 'Careers',
    contactUs: 'Contact Us',
    blog: 'Blog',
    
    // Legal links
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    cookiePolicy: 'Cookie Policy',
    compliance: 'Compliance',
    
    // Bottom quick links
    privacy: 'Privacy',
    terms: 'Terms',
    cookies: 'Cookies',
    
    // Contact form
    contactDescription: 'Have any questions or suggestions? Let us know!',
    yourName: 'Your Name',
    yourEmail: 'Your Email',
    yourMessage: 'Your Message',
    sendMessage: 'Send Message',
    
    // Legacy links (for compatibility)
    links: {
      about: 'About Us',
      contact: 'Contact',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      help: 'Help Center',
      feedback: 'Feedback',
    },
  },

  // Features
  features: {
    title: 'Core Features',
    uploadTitle: 'File Upload',
    uploadDescription: 'Support multiple audio formats, up to 100MB',
    recordingTitle: 'Real-time Recording',
    recordingDescription: 'High-quality recording with pause and resume',
    aiTitle: 'AI Processing',
    aiDescription: 'Intelligent transcription and analysis, structured minutes generation',
    exportTitle: 'Multi-format Export',
    exportDescription: 'Support Markdown, PDF, Word and more',
  },

  // Shortcuts
  shortcuts: {
    title: 'Shortcuts',
    startRecording: 'Start Recording',
    stopRecording: 'Stop Recording',
    copyMinutes: 'Copy Minutes',
    sendEmail: 'Send Email',
  },

  // States
  states: {
    idle: 'Idle',
    recording: 'Recording',
    uploading: 'Uploading',
    processing: 'Processing',
    completed: 'Completed',
    error: 'Error',
  },

  // Dialogs
  dialogs: {
    confirmTitle: 'Confirm Action',
    confirmMessage: 'Are you sure you want to perform this action?',
    discardRecording: 'Are you sure you want to discard the current recording?',
    deleteFile: 'Are you sure you want to delete this file?',
    unsavedChanges: 'You have unsaved changes, are you sure you want to leave?',
  },

  // Tips
  tips: {
    dragDropFile: 'Drag and drop file here to upload',
    clickToSelect: 'Click to select file',
    recordingInProgress: 'Recording in progress, please do not close the page',
    processingInProgress: 'Processing in progress, please do not close the page',
    micPermissionRequired: 'Please allow browser to access microphone',
  },

  // Real-time Transcription
  realtimeTranscription: {
    title: 'Real-time Transcription',
    subtitle: 'Record and transcribe to text simultaneously',
    startButton: 'Start Real-time Transcription',
  },

  // Feature Page
  featurePage: {
    hero: {
      title: 'Product Features',
      description: 'Meet and Note provides a complete AI workflow from recording to structured meeting minutes, making every meeting valuable.',
    },
    cta: {
      title: 'Get Started Now',
      description: 'No registration required, open and use immediately. Upload audio or start recording, AI generates professional meeting minutes for you.',
      button: 'Back to Home, Start Using',
    },
  },

  auth: {
    fields: {
      email: 'Email',
      displayName: 'Display Name',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      resetToken: 'Reset Token',
    },
    placeholders: {
      email: 'Enter your email',
      displayName: 'Enter your display name',
      password: 'Enter password (at least 8 chars with letters and numbers)',
      confirmPassword: 'Enter password again',
      resetToken: 'Enter your reset token',
    },
    validation: {
      passwordMismatch: 'The two passwords do not match',
    },
    messages: {
      genericError: 'Authentication failed, please try again later',
      submitting: 'Submitting...',
      resetRequested: 'If the email exists, a reset flow has been generated.',
      resetCompleted: 'Password reset completed. Please sign in again.',
      serviceUnavailable: 'Service temporarily unavailable, please try again later',
    },
    login: {
      title: 'Welcome back',
      description: 'Sign in to continue with your meeting uploads and summaries.',
      submit: 'Login',
      switch: 'Need an account? Register',
    },
    register: {
      title: 'Create account',
      description: 'Register to securely keep your processing jobs and meeting results.',
      submit: 'Register and enter the app',
      switch: 'Already have an account? Login',
    },
    forgot: {
      title: 'Forgot password',
      description: 'Enter your email and we will generate a reset token for you.',
      submit: 'Generate reset token',
      link: 'Forgot password',
      tokenHint: 'Development reset token: ',
    },
    reset: {
      title: 'Reset password',
      description: 'Enter your reset token and set a new password.',
      submit: 'Reset password',
      link: 'Already have a reset token',
    },
  },

  account: {
    eyebrow: 'Account Center',
    title: 'Account Settings',
    description: 'Manage your profile, sign-in information, and security settings.',
    meta: {
      email: 'Login Email',
      role: 'Role',
      createdAt: 'Created At',
      lastLoginAt: 'Last Login',
    },
    messages: {
      profileSaved: 'Profile saved successfully',
      profileError: 'Failed to save profile',
      passwordSaved: 'Password updated successfully',
      passwordError: 'Failed to update password',
    },
    profile: {
      title: 'Profile',
      description: 'Maintain your display name, timezone, and profile note here.',
      timezone: 'Timezone',
      timezonePlaceholder: 'e.g. Asia/Shanghai',
      bio: 'Bio',
      bioPlaceholder: 'Briefly describe yourself or your usage scenario',
      submit: 'Save profile',
    },
    password: {
      title: 'Change Password',
      description: 'We recommend updating your password regularly for account safety.',
      current: 'Current Password',
      new: 'New Password',
      submit: 'Update password',
    },
  },

  history: {
    title: 'Business History',
    subtitle: 'Review your previous transcription jobs, meeting minutes generation, and related processing results.',
    summaryTitle: 'History Overview',
    emptyTitle: 'No business records yet',
    emptyDescription: 'Your transcription and meeting minutes processing records will appear here once you upload audio.',
    noMatchTitle: 'No matching records',
    noMatchDescription: 'Try clearing the filters or changing the keyword.',
    filters: {
      keyword: 'Keyword',
      keywordPlaceholder: 'Search title, summary, filename, or type',
      activityType: 'Activity Type',
      status: 'Status',
      dateFrom: 'From',
      dateTo: 'To',
      clear: 'Clear Filters',
      allTypes: 'All Types',
      allStatuses: 'All Statuses',
    },
    pagination: {
      previous: 'Previous',
      next: 'Next',
      pageInfo: 'Page {page} / {totalPages}',
    },
    analytics: {
      totalRecords: 'Total Records',
      activityTypes: 'Activity Types',
      successRecords: 'Successful Records',
      recentDays: 'Last 14 Days Trend',
    },
    activityTypes: {
      upload_task: 'Transcription & Minutes Job',
      video_url_task: 'Video URL Transcription',
    },
    statuses: {
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    },
    detail: {
      title: 'Record Detail',
      close: 'Close',
      summary: 'Summary',
      metadata: 'Metadata',
    },
    messages: {
      loadFailed: 'Failed to load history. Please try again later.',
    },
  },

  adminDashboard: {
    title: 'Admin Business Dashboard',
    subtitle: 'Review all users\' core business records, filtered results, and overall trends.',
    viewer: 'Current Admin',
    filters: {
      keywordPlaceholder: 'Search user, title, summary, or filename',
      user: 'All Users',
      activityType: 'All Types',
      status: 'All Statuses',
      clear: 'Clear Filters',
    },
    overview: {
      totalRecords: 'Total Records',
      activeUsers: 'Active Users',
      statusDistribution: 'Status Distribution',
      typeDistribution: 'Type Distribution',
    },
    empty: 'No records found for the current filters.',
    messages: {
      loadFailed: 'Failed to load the admin dashboard. Please try again later.',
      noPermission: 'You do not have permission to access the admin dashboard.',
    },
  },

  // Video URL transcription (YouTube / Bilibili)
  videoUrl: {
    title: 'Video URL Transcription',
    subtitle: 'Paste a YouTube or Bilibili video URL to transcribe and generate bilingual minutes automatically.',
    urlPlaceholder: 'Paste a YouTube or Bilibili video URL...',
    submit: 'Start Transcription',
    submitting: 'Submitting...',
    errorLabel: 'Failed',
    taskStarted: 'Task started, task ID: {fileId}',
    platform: {
      youtube: 'YouTube',
      bilibili: 'Bilibili',
      unsupported: 'Unsupported platform',
    },
    hints: {
      playlistOnlyCurrent: 'Playlist or multi-part parameters detected. Only the current video will be transcribed.',
    },
    meta: {
      platform: 'Platform',
      duration: 'Duration',
      uploader: 'Uploader',
    },
    progress: {
      fetchingMeta: 'Fetching video information...',
      downloading_video: 'Downloading video audio...',
    },
    errors: {
      unsupported_platform: 'Only YouTube and Bilibili video URLs are supported.',
      not_a_video_url: 'The URL does not appear to be a valid video link.',
      video_unavailable: 'Video is unavailable or has been removed.',
      geo_restricted: 'This video is not available in your region.',
      private_video: 'This video is private and requires login.',
      age_restricted: 'This video is age-restricted and requires authentication.',
      network_error: 'Network error while accessing the video, please retry later.',
      timeout: 'Video download timed out, please try a shorter video or retry later.',
      yt_dlp_missing: 'yt-dlp is not installed on the server. Please contact the administrator.',
      duration_exceeded: 'Video duration exceeds the limit, please submit a shorter video.',
      size_exceeded: 'Audio size exceeds the limit, please choose a shorter video.',
      rate_limited: 'Too many submissions, please retry later.',
      unknown: 'Failed to process the video, please retry later.',
    },
  },
};