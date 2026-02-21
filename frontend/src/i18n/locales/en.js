/**
 * English Translation Resources
 * @type {import('../types').Translations}
 */
export default {
  // Common text
  common: {
    appName: 'EchoFlow Pro',
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
  },

  // Home/Main interface
  home: {
    title: 'AI Meeting Minutes Generator',
    subtitle: 'Enterprise AI Engine · Auto-chunking for Large Files · 8-Point Structured Output',
    description: 'Upload audio files or record in real-time, AI automatically generates professional meeting minutes',
  },

  // Upload functionality
  upload: {
    title: 'Upload Audio File',
    dragDropHint: 'Click or drag to upload audio file',
    dragDropHintUploading: 'Uploading file...',
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
    title: 'AI is processing your meeting recording',
    cancelProcessing: 'Cancel Processing',
    steps: {
      uploading: 'Uploading file',
      splitting: 'Smart audio segmentation',
      transcribing: 'AI speech transcription',
      generating_summary: 'AI generating structured minutes',
      analyzing: 'Analyzing content...',
      generating: 'Generating meeting minutes...',
      completed: 'Processing completed',
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
    recipients: 'Recipients',
    recipientsPlaceholder: 'Enter email address, press Enter to add',
    addRecipient: 'Add Recipient',
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
  },

  // Error messages
  errors: {
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

  // Success messages
  success: {
    fileUploaded: 'File uploaded successfully',
    recordingSaved: 'Recording saved successfully',
    processingCompleted: 'Processing completed',
    emailSent: 'Email sent successfully',
    copiedToClipboard: 'Copied to clipboard',
    feedbackSubmitted: 'Feedback submitted successfully, thank you for your suggestion',
  },

  // Footer
  footer: {
    copyright: '© 2024 EchoFlow Pro. All rights reserved.',
    links: {
      about: 'About Us',
      contact: 'Contact',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      help: 'Help Center',
      feedback: 'Feedback',
    },
    contactUs: 'Contact Us',
    contactDescription: 'Have any questions or suggestions? Let us know!',
    yourName: 'Your Name',
    yourEmail: 'Your Email',
    yourMessage: 'Your Message',
    sendMessage: 'Send Message',
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
};
