/**
 * useAudioProcessing Hook
 * 封装 AI 处理逻辑（转录、分析、进度轮询）
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMeeting } from '../contexts/MeetingContext';
import { useNotification } from '../contexts/NotificationContext';
import { processAudio, getProcessingStatus } from '../services/audioService';
import { getMeetingMinutes } from '../services/meetingService';
import { PROCESSING_STEPS, TIME_CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';

export const useAudioProcessing = () => {
  const meeting = useMeeting();
  const notification = useNotification();

  const [error, setError] = useState(null);
  const pollingIntervalRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // 开始处理音频
  const startProcessing = useCallback(async (audioId, options = {}) => {
    if (!audioId) {
      notification.error('缺少音频 ID');
      return false;
    }

    try {
      // 重置状态
      setError(null);
      retryCountRef.current = 0;
      meeting.startProcessing();
      meeting.updateProcessingStep(PROCESSING_STEPS.UPLOADING);

      // 调用处理 API
      const response = await processAudio(audioId, options);

      if (response.success) {
        const taskId = response.data.taskId;
        meeting.setTaskId(taskId);

        // 开始轮询处理状态
        startPolling(taskId);
        return true;
      } else {
        meeting.processingFailed();
        setError(response.message);
        notification.error(response.message || ERROR_MESSAGES.PROCESSING_FAILED);
        return false;
      }
    } catch (error) {
      meeting.processingFailed();
      setError(error.message);
      notification.error(error.message || ERROR_MESSAGES.PROCESSING_FAILED);
      return false;
    }
  }, [meeting, notification]);

  // 轮询处理状态
  const startPolling = useCallback((taskId) => {
    // 清除之前的轮询
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // 开始新的轮询
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await getProcessingStatus(taskId);

        if (response.success) {
          const { status, progress, step, result } = response.data;

          // 更新进度
          meeting.updateProcessingProgress(progress || 0);

          // 更新步骤
          if (step) {
            meeting.updateProcessingStep(step);
          }

          // 检查是否完成
          if (status === 'completed') {
            // 停止轮询
            stopPolling();

            // 获取会议纪要
            await fetchMeetingMinutes(taskId);

            // 标记完成
            meeting.processingCompleted();
            notification.success(SUCCESS_MESSAGES.PROCESSING_COMPLETED);
          } else if (status === 'failed') {
            // 停止轮询
            stopPolling();

            // 标记失败
            meeting.processingFailed();
            setError(result?.error || ERROR_MESSAGES.PROCESSING_FAILED);
            notification.error(result?.error || ERROR_MESSAGES.PROCESSING_FAILED);
          }
        } else {
          // API 调用失败，重试
          retryCountRef.current += 1;

          if (retryCountRef.current >= maxRetries) {
            stopPolling();
            meeting.processingFailed();
            setError(ERROR_MESSAGES.PROCESSING_FAILED);
            notification.error(ERROR_MESSAGES.PROCESSING_FAILED);
          }
        }
      } catch (error) {
        // 轮询出错，重试
        retryCountRef.current += 1;

        if (retryCountRef.current >= maxRetries) {
          stopPolling();
          meeting.processingFailed();
          setError(error.message || ERROR_MESSAGES.PROCESSING_FAILED);
          notification.error(error.message || ERROR_MESSAGES.PROCESSING_FAILED);
        }
      }
    }, TIME_CONFIG.POLLING_INTERVAL);
  }, [meeting, notification]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // 获取会议纪要
  const fetchMeetingMinutes = useCallback(async (taskId) => {
    try {
      const response = await getMeetingMinutes(taskId);

      if (response.success) {
        const minutes = response.data;

        // 设置转录文本
        if (minutes.transcription) {
          meeting.setTranscription(minutes.transcription);
        }

        // 设置会议纪要
        meeting.setMeetingMinutes(minutes);

        return true;
      } else {
        notification.error(response.message || '获取会议纪要失败');
        return false;
      }
    } catch (error) {
      notification.error(error.message || '获取会议纪要失败');
      return false;
    }
  }, [meeting, notification]);

  // 重试处理
  const retryProcessing = useCallback(async (audioId, options) => {
    stopPolling();
    return await startProcessing(audioId, options);
  }, [startProcessing, stopPolling]);

  // 取消处理
  const cancelProcessing = useCallback(() => {
    stopPolling();
    meeting.processingFailed();
    setError(ERROR_MESSAGES.OPERATION_CANCELLED);
  }, [meeting, stopPolling]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // 状态
    isProcessing: meeting.isProcessing,
    processingStep: meeting.processingStep,
    processingProgress: meeting.processingProgress,
    taskId: meeting.taskId,
    error,

    // 转录和纪要
    transcription: meeting.transcription,
    meetingMinutes: meeting.meetingMinutes,

    // 操作
    startProcessing,
    retryProcessing,
    cancelProcessing,
    fetchMeetingMinutes,
  };
};
