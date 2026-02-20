/**
 * useAudioRecorder Hook
 * 封装录音逻辑（开始、暂停、停止、下载、波形数据）
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudio } from '../contexts/AudioContext';
import { useNotification } from '../contexts/NotificationContext';
import { ERROR_MESSAGES, RECORDING_CONFIG, SUCCESS_MESSAGES } from '../constants';
import { createAudioBlobUrl, revokeAudioBlobUrl } from '../services/audioService';

export const useAudioRecorder = () => {
  const audio = useAudio();
  const notification = useNotification();

  const [isSupported, setIsSupported] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // 检查浏览器支持
  useEffect(() => {
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setIsSupported(supported);

    if (!supported) {
      notification.error('您的浏览器不支持录音功能');
    }
  }, [notification]);

  // 更新录音时长
  const updateDuration = useCallback(() => {
    if (startTimeRef.current && !audio.isPaused) {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      audio.updateRecordingDuration(duration);

      // 检查是否超过最大时长
      if (duration >= RECORDING_CONFIG.MAX_DURATION) {
        stopRecording();
        notification.warning('已达到最大录音时长');
      }
    }
  }, [audio, notification]);

  // 更新波形数据
  const updateWaveform = useCallback(() => {
    if (!analyserRef.current || audio.isPaused) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // 采样数据（每隔 N 个点取一个）
    const sampleSize = 100;
    const step = Math.floor(bufferLength / sampleSize);
    const sampledData = [];

    for (let i = 0; i < sampleSize; i++) {
      const index = i * step;
      sampledData.push(dataArray[index] / 128.0 - 1.0); // 归一化到 -1 到 1
    }

    audio.updateWaveformData(sampledData);

    // 继续更新
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, [audio]);

  // 开始录音
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      notification.error('您的浏览器不支持录音功能');
      return false;
    }

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: RECORDING_CONFIG.SAMPLE_RATE,
          channelCount: RECORDING_CONFIG.CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 监听数据
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      // 监听停止
      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = createAudioBlobUrl(audioBlob);
        audio.setRecordingBlob(audioBlob, audioUrl);
      });

      // 创建音频上下文用于波形可视化
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      // 开始录音
      mediaRecorder.start(100); // 每 100ms 触发一次 dataavailable
      startTimeRef.current = Date.now();
      audio.startRecording();

      // 启动定时器更新时长
      timerRef.current = setInterval(updateDuration, 100);

      // 启动波形更新
      updateWaveform();

      return true;
    } catch (error) {
      console.error('录音失败:', error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        notification.error(ERROR_MESSAGES.MIC_PERMISSION_DENIED);
      } else if (error.name === 'NotFoundError') {
        notification.error(ERROR_MESSAGES.MIC_NOT_FOUND);
      } else {
        notification.error(ERROR_MESSAGES.RECORDING_FAILED);
      }

      return false;
    }
  }, [isSupported, audio, notification, updateDuration, updateWaveform]);

  // 暂停录音
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      audio.pauseRecording();

      // 停止定时器和波形更新
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [audio]);

  // 恢复录音
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      audio.resumeRecording();

      // 重新启动定时器和波形更新
      timerRef.current = setInterval(updateDuration, 100);
      updateWaveform();
    }
  }, [audio, updateDuration, updateWaveform]);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      audio.stopRecording();

      // 停止定时器和波形更新
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // 停止音频流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // 关闭音频上下文
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // 检查录音时长
      if (audio.recordingDuration < 3) {
        notification.warning(ERROR_MESSAGES.RECORDING_TOO_SHORT);
      }
    }
  }, [audio, notification]);

  // 下载录音
  const downloadRecording = useCallback(() => {
    if (!audio.recordingBlob) {
      notification.error('没有可下载的录音');
      return;
    }

    try {
      const url = audio.recordingUrl;
      const link = document.createElement('a');
      link.href = url;
      link.download = `recording_${Date.now()}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      notification.success(SUCCESS_MESSAGES.RECORDING_SAVED);
    } catch (error) {
      notification.error('下载失败');
    }
  }, [audio.recordingBlob, audio.recordingUrl, notification]);

  // 清理资源
  const cleanup = useCallback(() => {
    // 停止录音
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // 停止定时器和波形更新
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 停止音频流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // 释放 Blob URL
    if (audio.recordingUrl) {
      revokeAudioBlobUrl(audio.recordingUrl);
    }

    // 重置状态
    audio.resetRecording();
  }, [audio]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // 状态
    isSupported,
    hasPermission,
    isRecording: audio.isRecording,
    isPaused: audio.isPaused,
    duration: audio.recordingDuration,
    waveformData: audio.waveformData,
    recordingBlob: audio.recordingBlob,
    recordingUrl: audio.recordingUrl,

    // 操作
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    downloadRecording,
    cleanup,
  };
};
