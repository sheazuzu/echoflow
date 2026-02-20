/**
 * 音频服务
 * 处理音频相关的 API 请求
 */

import apiClient from './api';
import { API_ENDPOINTS, ERROR_MESSAGES, SUPPORTED_AUDIO_EXTENSIONS, FILE_SIZE_LIMITS } from '../constants';

/**
 * 验证音频文件
 */
export const validateAudioFile = (file) => {
  if (!file) {
    return { valid: false, error: '请选择文件' };
  }

  // 检查文件大小
  if (file.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
    return { valid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE };
  }

  // 检查文件格式
  const fileName = file.name.toLowerCase();
  const isValidFormat = SUPPORTED_AUDIO_EXTENSIONS.some(ext => fileName.endsWith(ext));

  if (!isValidFormat) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_FILE_FORMAT };
  }

  return { valid: true };
};

/**
 * 上传音频文件
 */
export const uploadAudioFile = async (file, onProgress) => {
  // 验证文件
  const validation = validateAudioFile(file);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error,
    };
  }

  // 创建 FormData
  const formData = new FormData();
  formData.append('audio', file);

  // 上传文件
  return await apiClient.upload(API_ENDPOINTS.UPLOAD_AUDIO, formData, onProgress);
};

/**
 * 处理音频（转录和分析）
 */
export const processAudio = async (audioId, options = {}) => {
  const {
    language = 'zh-CN',
    generateMinutes = true,
    speakerRecognition = false,
  } = options;

  return await apiClient.post(API_ENDPOINTS.PROCESS_AUDIO, {
    audioId,
    language,
    generateMinutes,
    speakerRecognition,
  });
};

/**
 * 获取处理状态
 */
export const getProcessingStatus = async (taskId) => {
  return await apiClient.get(`${API_ENDPOINTS.PROCESS_AUDIO}/${taskId}/status`);
};

/**
 * 下载音频文件
 */
export const downloadAudioFile = async (audioId) => {
  try {
    const response = await fetch(`${API_ENDPOINTS.UPLOAD_AUDIO}/${audioId}/download`);
    if (!response.ok) {
      throw new Error(ERROR_MESSAGES.SERVER_ERROR);
    }
    return await response.blob();
  } catch (error) {
    return {
      success: false,
      message: error.message || ERROR_MESSAGES.SERVER_ERROR,
    };
  }
};

/**
 * 删除音频文件
 */
export const deleteAudioFile = async (audioId) => {
  return await apiClient.delete(`${API_ENDPOINTS.UPLOAD_AUDIO}/${audioId}`);
};

/**
 * 获取音频信息
 */
export const getAudioInfo = async (audioId) => {
  return await apiClient.get(`${API_ENDPOINTS.UPLOAD_AUDIO}/${audioId}`);
};

/**
 * 创建音频 Blob URL
 */
export const createAudioBlobUrl = (blob) => {
  return URL.createObjectURL(blob);
};

/**
 * 释放音频 Blob URL
 */
export const revokeAudioBlobUrl = (url) => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

/**
 * 获取音频时长
 */
export const getAudioDuration = (file) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      reject(new Error('无法读取音频时长'));
    });
    audio.src = URL.createObjectURL(file);
  });
};

/**
 * 格式化音频时长
 */
export const formatAudioDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};
