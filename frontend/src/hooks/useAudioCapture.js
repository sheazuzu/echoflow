/**
 * useAudioCapture Hook
 * 管理音频捕获状态和逻辑，支持麦克风和系统音频的混合捕获
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AUDIO_SOURCE_TYPES,
  checkBrowserSupport,
  captureMicrophone,
  captureSystemAudio,
  stopAudioStream
} from '../utils/audioSourceManager';
import {
  AudioMixer,
  isWebAudioSupported,
  fallbackToSingleStream
} from '../utils/audioMixer';

/**
 * useAudioCapture Hook
 * @param {Object} options - 配置选项
 * @param {string} [options.defaultSourceType='all'] - 默认音频源类型
 * @param {boolean} [options.autoStart=false] - 是否自动开始捕获
 * @param {Function} [options.onError] - 错误回调函数
 * @param {Function} [options.onStreamReady] - 音频流就绪回调
 * @returns {Object} Hook 返回值
 */
export function useAudioCapture(options = {}) {
  const {
    defaultSourceType = AUDIO_SOURCE_TYPES.ALL,
    autoStart = false,
    onError,
    onStreamReady
  } = options;

  // 状态管理
  const [audioStream, setAudioStream] = useState(null);
  const [audioSourceType, setAudioSourceType] = useState(defaultSourceType);
  const [activeSourcesStatus, setActiveSourcesStatus] = useState({
    microphone: false,
    systemAudio: false
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState(null);
  const [browserSupport, setBrowserSupport] = useState(null);

  // 引用管理
  const mixerRef = useRef(null);
  const micStreamRef = useRef(null);
  const systemStreamRef = useRef(null);
  const isMountedRef = useRef(true);

  /**
   * 检查浏览器支持情况
   */
  useEffect(() => {
    const support = checkBrowserSupport();
    setBrowserSupport(support);

    if (!support.getUserMedia) {
      const err = new Error('Browser does not support audio recording');
      setError(err);
      onError?.(err);
    }
  }, [onError]);

  /**
   * 清理资源
   */
  const cleanup = useCallback(() => {
    console.log('[useAudioCapture] Cleaning up resources...');

    // 停止混合器
    if (mixerRef.current) {
      mixerRef.current.stop();
      mixerRef.current = null;
    }

    // 停止麦克风流
    if (micStreamRef.current) {
      stopAudioStream(micStreamRef.current);
      micStreamRef.current = null;
    }

    // 停止系统音频流
    if (systemStreamRef.current) {
      stopAudioStream(systemStreamRef.current);
      systemStreamRef.current = null;
    }

    // 重置状态
    if (isMountedRef.current) {
      setAudioStream(null);
      setActiveSourcesStatus({
        microphone: false,
        systemAudio: false
      });
      setIsCapturing(false);
    }
  }, []);

  /**
   * 捕获麦克风音频
   */
  const captureMic = useCallback(async () => {
    try {
      console.log('[useAudioCapture] Capturing microphone...');
      const stream = await captureMicrophone();
      micStreamRef.current = stream;
      
      if (isMountedRef.current) {
        setActiveSourcesStatus(prev => ({ ...prev, microphone: true }));
      }
      
      return stream;
    } catch (err) {
      console.error('[useAudioCapture] Microphone capture failed:', err);
      if (isMountedRef.current) {
        setActiveSourcesStatus(prev => ({ ...prev, microphone: false }));
      }
      throw err;
    }
  }, []);

  /**
   * 捕获系统音频
   */
  const captureSystem = useCallback(async () => {
    try {
      console.log('[useAudioCapture] Capturing system audio...');
      const stream = await captureSystemAudio();
      systemStreamRef.current = stream;
      
      if (isMountedRef.current) {
        setActiveSourcesStatus(prev => ({ ...prev, systemAudio: true }));
      }
      
      return stream;
    } catch (err) {
      console.error('[useAudioCapture] System audio capture failed:', err);
      if (isMountedRef.current) {
        setActiveSourcesStatus(prev => ({ ...prev, systemAudio: false }));
      }
      throw err;
    }
  }, []);

  /**
   * 开始音频捕获
   */
  const startCapture = useCallback(async (sourceType = audioSourceType) => {
    console.log('[useAudioCapture] Starting capture with source type:', sourceType);

    // 清理之前的资源
    cleanup();

    setIsCapturing(true);
    setError(null);

    try {
      let finalStream = null;
      const streams = [];

      // 根据音频源类型捕获音频
      if (sourceType === AUDIO_SOURCE_TYPES.ALL || sourceType === AUDIO_SOURCE_TYPES.BOTH) {
        // 捕获所有音频源
        let micError = null;
        let sysError = null;
        
        try {
          const micStream = await captureMic();
          streams.push(micStream);
        } catch (err) {
          console.warn('[useAudioCapture] Microphone not available:', err.message);
          micError = err;
        }

        try {
          const sysStream = await captureSystem();
          streams.push(sysStream);
        } catch (err) {
          console.warn('[useAudioCapture] System audio not available:', err.message);
          sysError = err;
          // 系统音频失败时，确保状态设置为 false
          if (isMountedRef.current) {
            setActiveSourcesStatus(prev => ({ ...prev, systemAudio: false }));
          }
        }

        // 如果没有任何音频源，抛出错误
        if (streams.length === 0) {
          const errorMsg = [];
          if (micError) errorMsg.push(`麦克风: ${micError.message}`);
          if (sysError) errorMsg.push(`系统音频: ${sysError.message}`);
          throw new Error('Failed to capture any audio source. ' + errorMsg.join('; '));
        }
        
        // 如果只有麦克风可用，给出提示
        if (streams.length === 1 && micStreamRef.current && !systemStreamRef.current) {
          console.warn('[useAudioCapture] Only microphone available, system audio capture failed');
          onError?.(new Error('系统音频捕获失败，仅使用麦克风录音'));
        }

        // 混合音频流
        if (streams.length > 1 && isWebAudioSupported()) {
          try {
            const mixer = new AudioMixer({ sampleRate: 16000, channelCount: 1 });
            streams.forEach(stream => mixer.addSource(stream));
            finalStream = mixer.getMixedStream();
            mixerRef.current = mixer;
            console.log('[useAudioCapture] Audio streams mixed successfully');
          } catch (err) {
            console.warn('[useAudioCapture] Mixing failed, using fallback:', err.message);
            finalStream = fallbackToSingleStream(streams);
          }
        } else {
          // 降级：使用单一音频流
          finalStream = streams[0];
          console.log('[useAudioCapture] Using single audio stream (no mixing)');
        }

      } else if (sourceType === AUDIO_SOURCE_TYPES.MICROPHONE) {
        // 仅麦克风
        const micStream = await captureMic();
        finalStream = micStream;

      } else if (sourceType === AUDIO_SOURCE_TYPES.SYSTEM) {
        // 仅系统音频
        const sysStream = await captureSystem();
        finalStream = sysStream;

      } else {
        throw new Error(`Invalid audio source type: ${sourceType}`);
      }

      // 监听音频流结束事件
      if (finalStream) {
        finalStream.getTracks().forEach(track => {
          track.onended = () => {
            console.log('[useAudioCapture] Audio track ended:', track.label);
            if (isMountedRef.current) {
              stopCapture();
            }
          };
        });
      }

      // 更新状态
      if (isMountedRef.current) {
        setAudioStream(finalStream);
        setAudioSourceType(sourceType);
        onStreamReady?.(finalStream);
      }

      console.log('[useAudioCapture] Capture started successfully');
      return finalStream;

    } catch (err) {
      console.error('[useAudioCapture] Failed to start capture:', err);
      
      if (isMountedRef.current) {
        setError(err);
        setIsCapturing(false);
        onError?.(err);
      }
      
      // 清理部分成功的资源
      cleanup();
      
      throw err;
    }
  }, [audioSourceType, cleanup, captureMic, captureSystem, onError, onStreamReady]);

  /**
   * 停止音频捕获
   */
  const stopCapture = useCallback(() => {
    console.log('[useAudioCapture] Stopping capture...');
    cleanup();
  }, [cleanup]);

  /**
   * 切换音频源类型
   */
  const changeSourceType = useCallback((newSourceType) => {
    console.log('[useAudioCapture] Changing source type to:', newSourceType);
    setAudioSourceType(newSourceType);
    
    // 如果正在捕获，需要重新开始
    if (isCapturing) {
      console.log('[useAudioCapture] Restarting capture with new source type...');
      stopCapture();
      // 延迟重启，确保资源已释放
      setTimeout(() => {
        startCapture(newSourceType);
      }, 100);
    }
  }, [isCapturing, startCapture, stopCapture]);

  /**
   * 组件卸载时清理资源
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  /**
   * 自动开始捕获
   */
  useEffect(() => {
    if (autoStart && browserSupport?.getUserMedia) {
      startCapture();
    }
  }, [autoStart, browserSupport, startCapture]);

  return {
    // 状态
    audioStream,
    audioSourceType,
    activeSourcesStatus,
    isCapturing,
    error,
    browserSupport,
    
    // 方法
    startCapture,
    stopCapture,
    changeSourceType,
    
    // 工具方法
    isReady: !!audioStream && isCapturing,
    hasError: !!error,
    canCaptureMicrophone: browserSupport?.getUserMedia || false,
    canCaptureSystemAudio: browserSupport?.getDisplayMedia || false,
    canMixAudio: isWebAudioSupported()
  };
}

export default useAudioCapture;
