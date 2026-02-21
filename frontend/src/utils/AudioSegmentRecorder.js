/**
 * AudioSegmentRecorder - 音频分段录制器
 * 用于实时转录功能的音频分段录制和管理
 */

export class AudioSegmentRecorder {
  constructor(options = {}) {
    // 配置参数
    this.segmentDuration = options.segmentDuration || 4000; // 默认4秒一段
    this.mimeType = options.mimeType || 'audio/webm;codecs=opus';
    this.onSegmentReady = options.onSegmentReady || null; // 音频段完成回调
    this.onError = options.onError || null; // 错误回调
    this.onStateChange = options.onStateChange || null; // 状态变化回调

    // 状态管理
    this.state = 'inactive'; // inactive, recording, paused
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioContext = null;
    
    // 缓冲区管理
    this.currentChunks = [];
    this.segmentStartTime = null;
    this.segmentTimer = null;
    this.totalRecordedTime = 0;
    this.pausedTime = 0;
    this.lastPauseTime = null;

    // 检查浏览器支持
    this.checkBrowserSupport();
  }

  /**
   * 检查浏览器支持
   */
  checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('浏览器不支持音频录制功能');
    }

    // 检查支持的MIME类型
    const supportedTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        this.mimeType = type;
        console.log('使用音频格式:', type);
        break;
      }
    }
  }

  /**
   * 开始录音
   * @param {MediaStream} stream - 音频流
   */
  async start(stream) {
    if (this.state === 'recording') {
      console.warn('录音已在进行中');
      return;
    }

    try {
      this.audioStream = stream;
      
      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.mimeType
      });

      // 监听数据可用事件
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.currentChunks.push(event.data);
        }
      };

      // 监听停止事件（用于分段）
      this.mediaRecorder.onstop = () => {
        this.handleSegmentComplete();
      };

      // 监听错误事件
      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder错误:', event.error);
        if (this.onError) {
          this.onError(event.error);
        }
      };

      // 开始录音
      this.mediaRecorder.start();
      this.state = 'recording';
      this.segmentStartTime = Date.now();
      this.totalRecordedTime = 0;
      this.pausedTime = 0;

      // 启动分段定时器
      this.startSegmentTimer();

      // 通知状态变化
      this.notifyStateChange('recording');

      console.log('音频分段录制已开始');
    } catch (error) {
      console.error('启动录音失败:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * 暂停录音
   */
  pause() {
    if (this.state !== 'recording') {
      console.warn('当前未在录音');
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.state = 'paused';
      this.lastPauseTime = Date.now();

      // 停止分段定时器
      this.stopSegmentTimer();

      // 通知状态变化
      this.notifyStateChange('paused');

      console.log('录音已暂停');
    }
  }

  /**
   * 恢复录音
   */
  resume() {
    if (this.state !== 'paused') {
      console.warn('当前未暂停');
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.state = 'recording';

      // 累计暂停时间
      if (this.lastPauseTime) {
        this.pausedTime += Date.now() - this.lastPauseTime;
        this.lastPauseTime = null;
      }

      // 重新启动分段定时器
      this.startSegmentTimer();

      // 通知状态变化
      this.notifyStateChange('recording');

      console.log('录音已恢复');
    }
  }

  /**
   * 停止录音
   */
  async stop() {
    if (this.state === 'inactive') {
      console.warn('录音未开始');
      return;
    }

    // 停止分段定时器
    this.stopSegmentTimer();

    // 停止 MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      
      // 等待最后一个分段处理完成
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 停止音频流
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.state = 'inactive';
    this.mediaRecorder = null;

    // 通知状态变化
    this.notifyStateChange('inactive');

    console.log('录音已停止，总时长:', this.totalRecordedTime, 'ms');
  }

  /**
   * 启动分段定时器
   */
  startSegmentTimer() {
    this.stopSegmentTimer(); // 先清除旧的定时器

    this.segmentTimer = setTimeout(() => {
      if (this.state === 'recording') {
        this.createSegment();
      }
    }, this.segmentDuration);
  }

  /**
   * 停止分段定时器
   */
  stopSegmentTimer() {
    if (this.segmentTimer) {
      clearTimeout(this.segmentTimer);
      this.segmentTimer = null;
    }
  }

  /**
   * 创建音频分段
   */
  createSegment() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // 停止当前录制以触发 onstop 事件
      this.mediaRecorder.stop();

      // 立即重新开始录制下一段
      setTimeout(() => {
        if (this.state === 'recording' && this.audioStream) {
          this.mediaRecorder = new MediaRecorder(this.audioStream, {
            mimeType: this.mimeType
          });

          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              this.currentChunks.push(event.data);
            }
          };

          this.mediaRecorder.onstop = () => {
            this.handleSegmentComplete();
          };

          this.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder错误:', event.error);
            if (this.onError) {
              this.onError(event.error);
            }
          };

          this.mediaRecorder.start();
          this.segmentStartTime = Date.now();

          // 启动下一个分段定时器
          this.startSegmentTimer();
        }
      }, 10);
    }
  }

  /**
   * 处理音频分段完成
   */
  handleSegmentComplete() {
    if (this.currentChunks.length === 0) {
      console.log('当前分段无数据');
      return;
    }

    // 创建音频 Blob
    const audioBlob = new Blob(this.currentChunks, { type: this.mimeType });
    const segmentDuration = Date.now() - this.segmentStartTime;

    console.log('音频分段完成:', {
      size: (audioBlob.size / 1024).toFixed(2) + ' KB',
      duration: segmentDuration + ' ms',
      chunks: this.currentChunks.length
    });

    // 更新总录制时间
    this.totalRecordedTime += segmentDuration;

    // 触发回调
    if (this.onSegmentReady) {
      this.onSegmentReady({
        blob: audioBlob,
        duration: segmentDuration,
        timestamp: Date.now(),
        mimeType: this.mimeType
      });
    }

    // 清空当前缓冲区
    this.currentChunks = [];
  }

  /**
   * 通知状态变化
   */
  notifyStateChange(newState) {
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.state;
  }

  /**
   * 获取总录制时间（毫秒）
   */
  getTotalRecordedTime() {
    return this.totalRecordedTime;
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopSegmentTimer();
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.currentChunks = [];
    this.state = 'inactive';
  }
}

export default AudioSegmentRecorder;
