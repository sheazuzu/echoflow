/**
 * useRealtimeTranscription Hook
 * 封装实时转录功能的逻辑
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioSegmentRecorder } from '../utils/AudioSegmentRecorder';
import { useNotification } from '../contexts/NotificationContext';

export const useRealtimeTranscription = (options = {}) => {
  const notification = useNotification();
  const { language = 'auto' } = options;

  // 状态管理
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [transcriptionStatus, setTranscriptionStatus] = useState('idle'); // idle, listening, paused, processing
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [currentLanguage, setCurrentLanguage] = useState(language);

  // Refs
  const segmentRecorderRef = useRef(null);
  const wsRef = useRef(null);
  const maxRetries = 3; // 最大重试次数

  /**
   * 更新转录状态
   */
  const updateTranscriptionStatus = useCallback((recorderState) => {
    switch (recorderState) {
      case 'recording':
        setTranscriptionStatus('listening');
        break;
      case 'paused':
        setTranscriptionStatus('paused');
        break;
      case 'inactive':
        setTranscriptionStatus('idle');
        break;
      default:
        break;
    }
  }, []);

  /**
   * 追加转录文字
   */
  const appendTranscriptionText = useCallback((text) => {
    setTranscriptionText(prev => {
      if (prev) {
        return prev + ' ' + text;
      }
      return text;
    });
  }, []);

  /**
   * 发送音频分段到转录服务（带重试机制）
   */
  const sendAudioSegmentToTranscription = useCallback(async (segmentData, retryAttempt = 0) => {
    const requestId = `REQ-${Date.now()}`;
    console.log(`[${requestId}] 准备发送音频分段到转录服务:`, {
      size: segmentData.blob.size,
      duration: segmentData.duration,
      retryAttempt,
      language: currentLanguage
    });

    try {
      setTranscriptionStatus('processing');
      
      // 创建 FormData
      const formData = new FormData();
      formData.append('audio', segmentData.blob, 'audio.webm');
      formData.append('language', currentLanguage); // 使用当前语言设置

      // 发送到后端API（设置超时）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      console.log(`[${requestId}] 🚀 发送请求到转录服务...`);
      const response = await fetch('http://localhost:3000/api/transcribe/stream', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // 添加 credentials 以支持跨域请求
        credentials: 'include'
      });

      clearTimeout(timeoutId);

      console.log(`[${requestId}] 📥 收到响应: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorData = {};
        try {
          const responseText = await response.text();
          if (responseText) {
            errorData = JSON.parse(responseText);
          }
        } catch (parseError) {
          console.error(`[${requestId}] ⚠️ 无法解析错误响应:`, parseError);
        }
        const errorMsg = errorData.message || `转录请求失败: ${response.status}`;
        console.error(`[${requestId}] ❌ 请求失败:`, errorData);
        throw new Error(errorMsg);
      }

      // 先获取响应文本，再尝试解析JSON
      const responseText = await response.text();
      console.log(`[${requestId}] 📄 响应文本长度: ${responseText.length} 字节`);
      
      if (!responseText || responseText.trim() === '') {
        console.error(`[${requestId}] ❌ 响应体为空`);
        throw new Error('服务器返回空响应，请检查后端服务状态');
      }

      let result;
      try {
        result = JSON.parse(responseText);
        console.log(`[${requestId}] 📄 解析响应:`, result);
      } catch (parseError) {
        console.error(`[${requestId}] ❌ JSON解析失败:`, parseError);
        console.error(`[${requestId}] 响应内容:`, responseText.substring(0, 200));
        throw new Error(`无法解析服务器响应: ${parseError.message}`);
      }
      
      if (result.success && result.text) {
        // 过滤不相关的文本
        let filteredText = result.text;
        
        // 移除常见的转录服务水印和无关文本
        const unwantedPatterns = [
          /Transcribed by https?:\/\/otter\.ai/gi,
          /Thank you so much for watching\s*!?/gi,
          /ご視聴ありがとうございました/gi,
          /Thank you\.?$/gi,
          /字幕由.*制作/gi,
          /Subtitles by/gi,
          /\[Music\]/gi,
          /\[Applause\]/gi,
          /\[Laughter\]/gi
        ];
        
        unwantedPatterns.forEach(pattern => {
          filteredText = filteredText.replace(pattern, '');
        });
        
        // 清理多余的空格和换行
        filteredText = filteredText.trim().replace(/\s+/g, ' ');
        
        // 如果过滤后文本为空，跳过此段
        if (!filteredText) {
          console.log(`[${requestId}] ⚠️ 过滤后文本为空，跳过此段`);
          setTranscriptionStatus('listening');
          return;
        }
        
        console.log(`[${requestId}] ✅ 转录成功（已过滤）: "${filteredText.substring(0, 50)}..."`);
        appendTranscriptionText(filteredText);
        setIsConnected(true);
        setConnectionError(null);
        setRetryCount(0);
        setTranscriptionStatus('listening');
      } else {
        throw new Error(result.message || '转录失败');
      }
    } catch (error) {
      console.error(`[${requestId}] ❌ 发送音频分段失败:`, error);
      
      // 处理不同类型的错误
      let errorMessage = '';
      let shouldRetry = true;
      
      if (error.name === 'AbortError') {
        console.error(`[${requestId}] ⏱️ 请求超时`);
        errorMessage = '转录服务响应超时，请检查网络连接';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        console.error(`[${requestId}] 🌐 网络连接失败`);
        errorMessage = '无法连接到转录服务，请确保：\n1. 后端服务正在运行\n2. 网络连接正常\n3. 防火墙未阻止连接';
        setIsConnected(false);
      } else if (error.message.includes('CORS')) {
        console.error(`[${requestId}] 🚫 CORS 错误`);
        errorMessage = 'CORS 跨域错误，请联系管理员检查服务器配置';
        shouldRetry = false; // CORS 错误不需要重试
      } else {
        errorMessage = `转录失败: ${error.message}`;
      }
      
      setConnectionError(errorMessage);

      // 重试逻辑
      if (shouldRetry && retryAttempt < maxRetries) {
        const nextRetry = retryAttempt + 1;
        setRetryCount(nextRetry);
        console.log(`[${requestId}] 🔄 准备第 ${nextRetry} 次重试...`);
        
        // 指数退避：1秒、2秒、4秒
        const retryDelay = Math.pow(2, retryAttempt) * 1000;
        setTimeout(() => {
          sendAudioSegmentToTranscription(segmentData, nextRetry);
        }, retryDelay);
      } else {
        // 达到最大重试次数
        notification.error(`转录失败: ${error.message}（已重试${maxRetries}次）`);
        setTranscriptionStatus('listening'); // 恢复监听状态，继续处理后续音频段
      }
    }
  }, [appendTranscriptionText, notification, maxRetries, currentLanguage]);

  /**
   * 初始化音频分段录制器
   */
  const initializeRecorder = useCallback((stream) => {
    try {
      segmentRecorderRef.current = new AudioSegmentRecorder({
        segmentDuration: 4000, // 4秒一段
        onSegmentReady: (segmentData) => {
          console.log('音频分段就绪:', segmentData);
          sendAudioSegmentToTranscription(segmentData);
        },
        onError: (error) => {
          console.error('录制器错误:', error);
          notification.error('录音出错: ' + error.message);
        },
        onStateChange: (state) => {
          console.log('录制器状态变化:', state);
          updateTranscriptionStatus(state);
        }
      });

      return segmentRecorderRef.current;
    } catch (error) {
      console.error('初始化录制器失败:', error);
      notification.error('初始化录制器失败');
      throw error;
    }
  }, [notification, sendAudioSegmentToTranscription, updateTranscriptionStatus]);

  /**
   * 开始转录
   */
  const startTranscription = useCallback(async (stream) => {
    try {
      // 初始化录制器
      const recorder = initializeRecorder(stream);
      
      // 开始录制
      await recorder.start(stream);
      
      setIsTranscribing(true);
      setTranscriptionText('');
      setTranscriptionStatus('listening');

      console.log('实时转录已启动');
      return true;
    } catch (error) {
      console.error('启动转录失败:', error);
      notification.error('启动转录失败');
      return false;
    }
  }, [initializeRecorder, notification]);

  /**
   * 暂停转录
   */
  const pauseTranscription = useCallback(() => {
    if (segmentRecorderRef.current) {
      segmentRecorderRef.current.pause();
      setTranscriptionStatus('paused');
    }
  }, []);

  /**
   * 恢复转录
   */
  const resumeTranscription = useCallback(() => {
    if (segmentRecorderRef.current) {
      segmentRecorderRef.current.resume();
      setTranscriptionStatus('listening');
    }
  }, []);

  /**
   * 停止转录
   */
  const stopTranscription = useCallback(async () => {
    if (segmentRecorderRef.current) {
      await segmentRecorderRef.current.stop();
      segmentRecorderRef.current = null;
    }

    setIsTranscribing(false);
    setTranscriptionStatus('idle');

    console.log('实时转录已停止');
  }, []);

  /**
   * 清空转录文字
   */
  const clearTranscription = useCallback(() => {
    setTranscriptionText('');
  }, []);

  /**
   * 复制转录文字
   */
  const copyTranscription = useCallback(async () => {
    if (!transcriptionText) {
      notification.warning('没有可复制的内容');
      return false;
    }

    try {
      await navigator.clipboard.writeText(transcriptionText);
      notification.success('已复制到剪贴板');
      return true;
    } catch (error) {
      console.error('复制失败:', error);
      notification.error('复制失败');
      return false;
    }
  }, [transcriptionText, notification]);

  /**
   * 下载转录文字
   */
  const downloadTranscription = useCallback(() => {
    if (!transcriptionText) {
      notification.warning('没有可下载的内容');
      return;
    }

    try {
      const blob = new Blob([transcriptionText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transcription_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notification.success('转录文字已下载');
    } catch (error) {
      console.error('下载失败:', error);
      notification.error('下载失败');
    }
  }, [transcriptionText, notification]);

  /**
   * 生成会议记录
   */
  const generateMeetingSummary = useCallback(async () => {
    if (!transcriptionText) {
      notification.warning('没有转录文字，无法生成会议记录');
      return null;
    }

    if (transcriptionText.length < 100) {
      notification.warning('转录文字太短，无法生成有效的会议记录');
      return null;
    }

    try {
      notification.info('正在生成会议记录，请稍候...');

      // 调用后端API生成会议记录
      const response = await fetch('http://localhost:3000/api/generate-meeting-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: transcriptionText
        })
      });

      if (!response.ok) {
        throw new Error(`生成会议记录失败: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.summary) {
        notification.success('会议记录生成成功！');
        return result.summary;
      } else {
        throw new Error(result.message || '生成失败');
      }
    } catch (error) {
      console.error('生成会议记录失败:', error);
      notification.error('生成会议记录失败: ' + error.message);
      return null;
    }
  }, [transcriptionText, notification]);

  /**
   * 清理资源
   */
  useEffect(() => {
    return () => {
      if (segmentRecorderRef.current) {
        segmentRecorderRef.current.cleanup();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    // 状态
    isTranscribing,
    transcriptionText,
    transcriptionStatus,
    isConnected,
    connectionError,
    retryCount,
    currentLanguage,

    // 方法
    startTranscription,
    pauseTranscription,
    resumeTranscription,
    stopTranscription,
    clearTranscription,
    copyTranscription,
    downloadTranscription,
    appendTranscriptionText,
    generateMeetingSummary,
    setCurrentLanguage
  };
};

export default useRealtimeTranscription;
