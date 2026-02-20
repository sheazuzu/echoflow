/**
 * useAudioUpload Hook
 * 封装上传逻辑（文件验证、拖拽上传、进度跟踪）
 */

import { useState, useCallback, useRef } from 'react';
import { useAudio } from '../contexts/AudioContext';
import { useNotification } from '../contexts/NotificationContext';
import { uploadAudioFile, validateAudioFile } from '../services/audioService';
import { SUCCESS_MESSAGES } from '../constants';

export const useAudioUpload = () => {
  const audio = useAudio();
  const notification = useNotification();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // 验证并上传文件
  const uploadFile = useCallback(async (file) => {
    if (!file) return false;

    // 验证文件
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      notification.error(validation.error);
      return false;
    }

    try {
      // 设置上传状态
      audio.setUploadedFile(file);
      audio.startUpload();

      // 上传文件
      const response = await uploadAudioFile(file, (progress) => {
        audio.updateUploadProgress(progress);
      });

      if (response.success) {
        // 上传成功
        audio.uploadSuccess(response.data.audioId, response.data);
        notification.success(SUCCESS_MESSAGES.FILE_UPLOADED);
        return true;
      } else {
        // 上传失败
        audio.uploadFailed();
        notification.error(response.message);
        return false;
      }
    } catch (error) {
      audio.uploadFailed();
      notification.error(error.message || '上传失败');
      return false;
    }
  }, [audio, notification]);

  // 处理文件选择
  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
    // 清空 input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadFile]);

  // 打开文件选择器
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 处理拖拽进入
  const handleDragEnter = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  // 处理拖拽经过
  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  // 处理拖拽离开
  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    // 只有当离开整个拖拽区域时才设置为 false
    if (event.currentTarget === event.target) {
      setIsDragging(false);
    }
  }, []);

  // 处理文件放置
  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      await uploadFile(file);
    }
  }, [uploadFile]);

  // 取消上传
  const cancelUpload = useCallback(() => {
    audio.uploadFailed();
    audio.resetUpload();
  }, [audio]);

  // 重试上传
  const retryUpload = useCallback(async () => {
    if (audio.uploadedFile) {
      return await uploadFile(audio.uploadedFile);
    }
    return false;
  }, [audio.uploadedFile, uploadFile]);

  return {
    // 状态
    isUploading: audio.isUploading,
    uploadProgress: audio.uploadProgress,
    uploadedFile: audio.uploadedFile,
    isDragging,
    audioId: audio.audioId,
    audioInfo: audio.audioInfo,

    // 文件输入 ref
    fileInputRef,

    // 操作
    uploadFile,
    handleFileSelect,
    openFilePicker,
    cancelUpload,
    retryUpload,

    // 拖拽事件处理
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
