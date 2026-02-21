/**
 * 音频流混合器
 * 使用 Web Audio API 混合多个音频源
 */

/**
 * AudioMixer 类
 * 负责混合多个音频流为单一输出流
 */
export class AudioMixer {
  /**
   * 创建 AudioMixer 实例
   * @param {Object} options - 配置选项
   * @param {number} [options.sampleRate=16000] - 输出采样率
   * @param {number} [options.channelCount=1] - 输出声道数
   */
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 16000;
    this.channelCount = options.channelCount || 1;
    this.audioContext = null;
    this.sources = [];
    this.destination = null;
    this.outputStream = null;

    console.log('[AudioMixer] Initializing with options:', {
      sampleRate: this.sampleRate,
      channelCount: this.channelCount
    });

    this._initialize();
  }

  /**
   * 初始化 AudioContext
   * @private
   */
  _initialize() {
    try {
      // 创建 AudioContext
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported in this browser');
      }

      this.audioContext = new AudioContextClass({
        sampleRate: this.sampleRate,
        latencyHint: 'interactive'
      });

      // 创建目标节点（用于混合输出）
      this.destination = this.audioContext.createMediaStreamDestination();

      console.log('[AudioMixer] AudioContext initialized:', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate,
        baseLatency: this.audioContext.baseLatency
      });
    } catch (error) {
      console.error('[AudioMixer] Failed to initialize AudioContext:', error);
      throw error;
    }
  }

  /**
   * 添加音频源到混合器
   * @param {MediaStream} stream - 要添加的音频流
   * @param {Object} options - 音频源选项
   * @param {number} [options.gain=1.0] - 音量增益 (0.0 - 1.0)
   * @returns {Object} 音频源信息对象
   * @throws {Error} 当添加音频源失败时抛出错误
   */
  addSource(stream, options = {}) {
    if (!stream || !(stream instanceof MediaStream)) {
      throw new Error('Invalid MediaStream provided');
    }

    if (!this.audioContext) {
      throw new Error('AudioContext is not initialized');
    }

    try {
      // 创建音频源节点
      const sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      // 创建增益节点（用于控制音量）
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = options.gain !== undefined ? options.gain : 1.0;

      // 连接节点：源 -> 增益 -> 目标
      sourceNode.connect(gainNode);
      gainNode.connect(this.destination);

      const sourceInfo = {
        id: stream.id,
        stream,
        sourceNode,
        gainNode,
        tracks: stream.getAudioTracks().map(track => ({
          id: track.id,
          label: track.label,
          enabled: track.enabled
        }))
      };

      this.sources.push(sourceInfo);

      console.log('[AudioMixer] Audio source added:', {
        id: sourceInfo.id,
        tracks: sourceInfo.tracks.length,
        gain: gainNode.gain.value
      });

      return sourceInfo;
    } catch (error) {
      console.error('[AudioMixer] Failed to add audio source:', error);
      throw new Error(`Failed to add audio source: ${error.message}`);
    }
  }

  /**
   * 移除音频源
   * @param {string} streamId - 要移除的音频流 ID
   */
  removeSource(streamId) {
    const index = this.sources.findIndex(source => source.id === streamId);
    
    if (index === -1) {
      console.warn(`[AudioMixer] Source with id ${streamId} not found`);
      return;
    }

    try {
      const source = this.sources[index];
      
      // 断开节点连接
      source.sourceNode.disconnect();
      source.gainNode.disconnect();

      // 从数组中移除
      this.sources.splice(index, 1);

      console.log(`[AudioMixer] Audio source removed: ${streamId}`);
    } catch (error) {
      console.error('[AudioMixer] Error removing audio source:', error);
    }
  }

  /**
   * 设置音频源的音量
   * @param {string} streamId - 音频流 ID
   * @param {number} gain - 音量增益 (0.0 - 1.0)
   */
  setSourceGain(streamId, gain) {
    const source = this.sources.find(s => s.id === streamId);
    
    if (!source) {
      console.warn(`[AudioMixer] Source with id ${streamId} not found`);
      return;
    }

    try {
      source.gainNode.gain.value = Math.max(0, Math.min(1, gain));
      console.log(`[AudioMixer] Source gain updated: ${streamId} -> ${gain}`);
    } catch (error) {
      console.error('[AudioMixer] Error setting source gain:', error);
    }
  }

  /**
   * 获取混合后的音频流
   * @returns {MediaStream} 混合后的音频流
   * @throws {Error} 当获取混合流失败时抛出错误
   */
  getMixedStream() {
    if (!this.destination) {
      throw new Error('AudioMixer is not initialized');
    }

    if (this.sources.length === 0) {
      console.warn('[AudioMixer] No audio sources added, returning empty stream');
    }

    try {
      // 获取混合后的输出流
      this.outputStream = this.destination.stream;

      console.log('[AudioMixer] Mixed stream created:', {
        audioTracks: this.outputStream.getAudioTracks().length,
        sources: this.sources.length
      });

      return this.outputStream;
    } catch (error) {
      console.error('[AudioMixer] Failed to get mixed stream:', error);
      throw new Error(`Failed to get mixed stream: ${error.message}`);
    }
  }

  /**
   * 获取当前活跃的音频源数量
   * @returns {number} 活跃音频源数量
   */
  getSourceCount() {
    return this.sources.length;
  }

  /**
   * 获取所有音频源信息
   * @returns {Array} 音频源信息数组
   */
  getSources() {
    return this.sources.map(source => ({
      id: source.id,
      tracks: source.tracks,
      gain: source.gainNode.gain.value
    }));
  }

  /**
   * 停止混合器并释放所有资源
   */
  stop() {
    console.log('[AudioMixer] Stopping mixer...');

    try {
      // 断开所有音频源
      this.sources.forEach(source => {
        try {
          source.sourceNode.disconnect();
          source.gainNode.disconnect();
        } catch (error) {
          console.error('[AudioMixer] Error disconnecting source:', error);
        }
      });

      // 清空音频源数组
      this.sources = [];

      // 关闭 AudioContext
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().then(() => {
          console.log('[AudioMixer] AudioContext closed');
        }).catch(error => {
          console.error('[AudioMixer] Error closing AudioContext:', error);
        });
      }

      // 清空引用
      this.audioContext = null;
      this.destination = null;
      this.outputStream = null;

      console.log('[AudioMixer] Mixer stopped and resources released');
    } catch (error) {
      console.error('[AudioMixer] Error stopping mixer:', error);
    }
  }

  /**
   * 获取 AudioContext 状态
   * @returns {string} AudioContext 状态
   */
  getState() {
    return this.audioContext ? this.audioContext.state : 'closed';
  }

  /**
   * 恢复 AudioContext（如果被暂停）
   */
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('[AudioMixer] AudioContext resumed');
      } catch (error) {
        console.error('[AudioMixer] Error resuming AudioContext:', error);
        throw error;
      }
    }
  }
}

/**
 * 创建简单的音频混合器（工具函数）
 * 用于快速混合两个音频流
 * @param {MediaStream} stream1 - 第一个音频流
 * @param {MediaStream} stream2 - 第二个音频流
 * @param {Object} options - 配置选项
 * @returns {Promise<{mixer: AudioMixer, stream: MediaStream}>} 混合器实例和混合后的流
 */
export async function createSimpleMixer(stream1, stream2, options = {}) {
  try {
    const mixer = new AudioMixer(options);
    
    if (stream1) {
      mixer.addSource(stream1);
    }
    
    if (stream2) {
      mixer.addSource(stream2);
    }

    const mixedStream = mixer.getMixedStream();

    return { mixer, stream: mixedStream };
  } catch (error) {
    console.error('[AudioMixer] Failed to create simple mixer:', error);
    throw error;
  }
}

/**
 * 检查 Web Audio API 支持
 * @returns {boolean} 是否支持 Web Audio API
 */
export function isWebAudioSupported() {
  return !!(window.AudioContext || window.webkitAudioContext);
}

/**
 * 降级方案：当 Web Audio API 不支持时，返回单一音频流
 * @param {MediaStream[]} streams - 音频流数组
 * @returns {MediaStream} 第一个可用的音频流
 */
export function fallbackToSingleStream(streams) {
  console.warn('[AudioMixer] Web Audio API not supported, using fallback mode');
  
  const validStreams = streams.filter(stream => 
    stream && stream.getAudioTracks().length > 0
  );

  if (validStreams.length === 0) {
    throw new Error('No valid audio streams available');
  }

  console.log(`[AudioMixer] Fallback: Using first stream (${validStreams[0].id})`);
  return validStreams[0];
}
