/**
 * 音频 Context
 * 管理音频相关状态（录音数据、上传文件、音频信息）
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// 创建 Context
const AudioContext = createContext(null);

// 初始状态
const initialState = {
  // 录音相关
  isRecording: false,
  isPaused: false,
  recordingDuration: 0,
  recordingBlob: null,
  recordingUrl: null,
  waveformData: [],

  // 上传文件相关
  uploadedFile: null,
  uploadProgress: 0,
  isUploading: false,

  // 音频信息
  audioId: null,
  audioInfo: null,
  audioDuration: 0,
  audioSize: 0,
};

// Action 类型
const ACTION_TYPES = {
  // 录音操作
  START_RECORDING: 'START_RECORDING',
  PAUSE_RECORDING: 'PAUSE_RECORDING',
  RESUME_RECORDING: 'RESUME_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  UPDATE_RECORDING_DURATION: 'UPDATE_RECORDING_DURATION',
  UPDATE_WAVEFORM_DATA: 'UPDATE_WAVEFORM_DATA',
  SET_RECORDING_BLOB: 'SET_RECORDING_BLOB',

  // 上传操作
  START_UPLOAD: 'START_UPLOAD',
  UPDATE_UPLOAD_PROGRESS: 'UPDATE_UPLOAD_PROGRESS',
  UPLOAD_SUCCESS: 'UPLOAD_SUCCESS',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  SET_UPLOADED_FILE: 'SET_UPLOADED_FILE',

  // 音频信息
  SET_AUDIO_INFO: 'SET_AUDIO_INFO',
  SET_AUDIO_ID: 'SET_AUDIO_ID',

  // 重置
  RESET: 'RESET',
  RESET_RECORDING: 'RESET_RECORDING',
  RESET_UPLOAD: 'RESET_UPLOAD',
};

// Reducer
const audioReducer = (state, action) => {
  switch (action.type) {
    case ACTION_TYPES.START_RECORDING:
      return {
        ...state,
        isRecording: true,
        isPaused: false,
        recordingDuration: 0,
        waveformData: [],
      };

    case ACTION_TYPES.PAUSE_RECORDING:
      return {
        ...state,
        isPaused: true,
      };

    case ACTION_TYPES.RESUME_RECORDING:
      return {
        ...state,
        isPaused: false,
      };

    case ACTION_TYPES.STOP_RECORDING:
      return {
        ...state,
        isRecording: false,
        isPaused: false,
      };

    case ACTION_TYPES.UPDATE_RECORDING_DURATION:
      return {
        ...state,
        recordingDuration: action.payload,
      };

    case ACTION_TYPES.UPDATE_WAVEFORM_DATA:
      return {
        ...state,
        waveformData: action.payload,
      };

    case ACTION_TYPES.SET_RECORDING_BLOB:
      return {
        ...state,
        recordingBlob: action.payload.blob,
        recordingUrl: action.payload.url,
      };

    case ACTION_TYPES.START_UPLOAD:
      return {
        ...state,
        isUploading: true,
        uploadProgress: 0,
      };

    case ACTION_TYPES.UPDATE_UPLOAD_PROGRESS:
      return {
        ...state,
        uploadProgress: action.payload,
      };

    case ACTION_TYPES.UPLOAD_SUCCESS:
      return {
        ...state,
        isUploading: false,
        uploadProgress: 100,
        audioId: action.payload.audioId,
        audioInfo: action.payload.audioInfo,
      };

    case ACTION_TYPES.UPLOAD_FAILED:
      return {
        ...state,
        isUploading: false,
        uploadProgress: 0,
      };

    case ACTION_TYPES.SET_UPLOADED_FILE:
      return {
        ...state,
        uploadedFile: action.payload,
      };

    case ACTION_TYPES.SET_AUDIO_INFO:
      return {
        ...state,
        audioInfo: action.payload,
        audioDuration: action.payload.duration || 0,
        audioSize: action.payload.size || 0,
      };

    case ACTION_TYPES.SET_AUDIO_ID:
      return {
        ...state,
        audioId: action.payload,
      };

    case ACTION_TYPES.RESET_RECORDING:
      return {
        ...state,
        isRecording: false,
        isPaused: false,
        recordingDuration: 0,
        recordingBlob: null,
        recordingUrl: null,
        waveformData: [],
      };

    case ACTION_TYPES.RESET_UPLOAD:
      return {
        ...state,
        uploadedFile: null,
        uploadProgress: 0,
        isUploading: false,
      };

    case ACTION_TYPES.RESET:
      return initialState;

    default:
      return state;
  }
};

/**
 * Audio Provider 组件
 */
export const AudioProvider = ({ children }) => {
  const [state, dispatch] = useReducer(audioReducer, initialState);

  // 录音操作
  const startRecording = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_RECORDING });
  }, []);

  const pauseRecording = useCallback(() => {
    dispatch({ type: ACTION_TYPES.PAUSE_RECORDING });
  }, []);

  const resumeRecording = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESUME_RECORDING });
  }, []);

  const stopRecording = useCallback(() => {
    dispatch({ type: ACTION_TYPES.STOP_RECORDING });
  }, []);

  const updateRecordingDuration = useCallback((duration) => {
    dispatch({ type: ACTION_TYPES.UPDATE_RECORDING_DURATION, payload: duration });
  }, []);

  const updateWaveformData = useCallback((data) => {
    dispatch({ type: ACTION_TYPES.UPDATE_WAVEFORM_DATA, payload: data });
  }, []);

  const setRecordingBlob = useCallback((blob, url) => {
    dispatch({ type: ACTION_TYPES.SET_RECORDING_BLOB, payload: { blob, url } });
  }, []);

  // 上传操作
  const startUpload = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_UPLOAD });
  }, []);

  const updateUploadProgress = useCallback((progress) => {
    dispatch({ type: ACTION_TYPES.UPDATE_UPLOAD_PROGRESS, payload: progress });
  }, []);

  const uploadSuccess = useCallback((audioId, audioInfo) => {
    dispatch({ type: ACTION_TYPES.UPLOAD_SUCCESS, payload: { audioId, audioInfo } });
  }, []);

  const uploadFailed = useCallback(() => {
    dispatch({ type: ACTION_TYPES.UPLOAD_FAILED });
  }, []);

  const setUploadedFile = useCallback((file) => {
    dispatch({ type: ACTION_TYPES.SET_UPLOADED_FILE, payload: file });
  }, []);

  // 音频信息
  const setAudioInfo = useCallback((info) => {
    dispatch({ type: ACTION_TYPES.SET_AUDIO_INFO, payload: info });
  }, []);

  const setAudioId = useCallback((id) => {
    dispatch({ type: ACTION_TYPES.SET_AUDIO_ID, payload: id });
  }, []);

  // 重置
  const reset = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESET });
  }, []);

  const resetRecording = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESET_RECORDING });
  }, []);

  const resetUpload = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESET_UPLOAD });
  }, []);

  const value = {
    // 状态
    ...state,

    // 录音操作
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    updateRecordingDuration,
    updateWaveformData,
    setRecordingBlob,

    // 上传操作
    startUpload,
    updateUploadProgress,
    uploadSuccess,
    uploadFailed,
    setUploadedFile,

    // 音频信息
    setAudioInfo,
    setAudioId,

    // 重置
    reset,
    resetRecording,
    resetUpload,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

/**
 * 使用 Audio 的 Hook
 */
export const useAudio = () => {
  const context = useContext(AudioContext);

  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }

  return context;
};

export default AudioContext;
