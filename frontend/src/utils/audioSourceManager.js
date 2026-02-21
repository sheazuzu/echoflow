/**
 * 音频源管理工具
 * 提供音频源捕获、浏览器兼容性检测等功能
 */

/**
 * 音频源类型常量
 * @constant {Object} AUDIO_SOURCE_TYPES
 */
export const AUDIO_SOURCE_TYPES = {
  ALL: 'all',              // 所有音频源（麦克风 + 系统音频）
  MICROPHONE: 'microphone', // 仅麦克风
  SYSTEM: 'system',         // 仅系统音频
  BOTH: 'both'              // 麦克风 + 系统音频（与 ALL 等效）
};

/**
 * 浏览器兼容性检测结果
 * @typedef {Object} BrowserSupport
 * @property {boolean} getUserMedia - 是否支持 getUserMedia API
 * @property {boolean} getDisplayMedia - 是否支持 getDisplayMedia API
 * @property {boolean} webAudioAPI - 是否支持 Web Audio API
 * @property {string} userAgent - 浏览器用户代理字符串
 */

/**
 * 检测浏览器对音频捕获 API 的支持情况
 * @returns {BrowserSupport} 浏览器支持情况对象
 */
export function checkBrowserSupport() {
  const support = {
    getUserMedia: false,
    getDisplayMedia: false,
    webAudioAPI: false,
    userAgent: navigator.userAgent
  };

  try {
    // 检测 getUserMedia 支持
    support.getUserMedia = !!(
      navigator.mediaDevices && 
      navigator.mediaDevices.getUserMedia
    );

    // 检测 getDisplayMedia 支持
    support.getDisplayMedia = !!(
      navigator.mediaDevices && 
      navigator.mediaDevices.getDisplayMedia
    );

    // 检测 Web Audio API 支持
    support.webAudioAPI = !!(
      window.AudioContext || 
      window.webkitAudioContext
    );

    console.log('[AudioSourceManager] Browser support:', support);
  } catch (error) {
    console.error('[AudioSourceManager] Error checking browser support:', error);
  }

  return support;
}

/**
 * 捕获麦克风音频流
 * @param {Object} constraints - 音频约束配置
 * @param {number} [constraints.sampleRate=16000] - 采样率
 * @param {number} [constraints.channelCount=1] - 声道数
 * @param {boolean} [constraints.echoCancellation=true] - 回声消除
 * @param {boolean} [constraints.noiseSuppression=true] - 噪声抑制
 * @returns {Promise<MediaStream>} 麦克风音频流
 * @throws {Error} 当麦克风访问失败时抛出错误
 */
export async function captureMicrophone(constraints = {}) {
  console.log('[AudioSourceManager] Requesting microphone access...');

  try {
    // 检查浏览器支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser does not support getUserMedia API');
    }

    // 默认音频约束
    const audioConstraints = {
      audio: {
        sampleRate: constraints.sampleRate || 16000,
        channelCount: constraints.channelCount || 1,
        echoCancellation: constraints.echoCancellation !== false,
        noiseSuppression: constraints.noiseSuppression !== false,
        autoGainControl: constraints.autoGainControl !== false
      }
    };

    // 请求麦克风权限并获取音频流
    const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
    
    console.log('[AudioSourceManager] Microphone access granted:', {
      tracks: stream.getAudioTracks().length,
      settings: stream.getAudioTracks()[0]?.getSettings()
    });

    return stream;
  } catch (error) {
    console.error('[AudioSourceManager] Failed to capture microphone:', error);
    
    // 增强错误信息
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('Microphone permission denied by user');
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      throw new Error('No microphone device found');
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      throw new Error('Microphone is already in use by another application');
    } else {
      throw new Error(`Failed to access microphone: ${error.message}`);
    }
  }
}

/**
 * 捕获系统音频流
 * 使用 getDisplayMedia API 捕获系统播放的音频
 * @param {Object} options - 捕获选项
 * @param {boolean} [options.video=false] - 是否同时捕获视频
 * @param {boolean} [options.audio=true] - 是否捕获音频
 * @returns {Promise<MediaStream>} 系统音频流
 * @throws {Error} 当系统音频捕获失败时抛出错误
 */
export async function captureSystemAudio(options = {}) {
  console.log('[AudioSourceManager] Requesting system audio access...');

  try {
    // 检查浏览器支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Browser does not support getDisplayMedia API');
    }

    // 配置捕获选项
    const displayMediaOptions = {
      video: options.video || false,
      audio: options.audio !== false ? {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 16000
      } : false
    };

    // 请求系统音频权限并获取音频流
    const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    
    // 检查是否成功获取音频轨道
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      // 如果没有音频轨道，停止所有轨道并抛出错误
      stream.getTracks().forEach(track => track.stop());
      throw new Error('No audio track in system audio stream');
    }

    console.log('[AudioSourceManager] System audio access granted:', {
      audioTracks: audioTracks.length,
      videoTracks: stream.getVideoTracks().length,
      settings: audioTracks[0]?.getSettings()
    });

    // 如果不需要视频，移除视频轨道
    if (!options.video) {
      stream.getVideoTracks().forEach(track => {
        track.stop();
        stream.removeTrack(track);
      });
    }

    return stream;
  } catch (error) {
    console.error('[AudioSourceManager] Failed to capture system audio:', error);
    
    // 增强错误信息
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('System audio permission denied or cancelled by user');
    } else if (error.name === 'NotSupportedError') {
      throw new Error('System audio capture is not supported in this browser');
    } else if (error.name === 'AbortError') {
      throw new Error('System audio capture was cancelled by user');
    } else {
      throw new Error(`Failed to capture system audio: ${error.message}`);
    }
  }
}

/**
 * 停止音频流并释放资源
 * @param {MediaStream} stream - 要停止的音频流
 */
export function stopAudioStream(stream) {
  if (!stream) {
    return;
  }

  try {
    stream.getTracks().forEach(track => {
      track.stop();
      console.log(`[AudioSourceManager] Stopped track: ${track.kind} (${track.label})`);
    });
  } catch (error) {
    console.error('[AudioSourceManager] Error stopping audio stream:', error);
  }
}

/**
 * 获取音频流的详细信息
 * @param {MediaStream} stream - 音频流
 * @returns {Object} 音频流信息
 */
export function getStreamInfo(stream) {
  if (!stream) {
    return null;
  }

  const audioTracks = stream.getAudioTracks();
  const videoTracks = stream.getVideoTracks();

  return {
    id: stream.id,
    active: stream.active,
    audioTracks: audioTracks.map(track => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      settings: track.getSettings()
    })),
    videoTracks: videoTracks.map(track => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState
    }))
  };
}
