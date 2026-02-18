import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileAudio, CheckCircle, Clock, Download, Settings, Cpu, Loader2, RefreshCw, CloudUpload, Mic } from 'lucide-react';
import './App.css';

// 导入腾讯云logo
import tencentCloudLogo from './assets/tencentcloud.png';
// 导入新的白色logo作为主logo
import sheaWhiteLogo from './assets/shea-white.png';

const App = () => {
    const [appState, setAppState] = useState('idle'); // idle, processing, completed
    const [minutesData, setMinutesData] = useState(null);
    const [transcript, setTranscript] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [processingStatus, setProcessingStatus] = useState({ status: '', progress: 0 });
    const [currentFileId, setCurrentFileId] = useState('');
    const [isUploading, setIsUploading] = useState(false); // 新增：上传状态标识

    // 录音功能相关状态
    const [isRecording, setIsRecording] = useState(false); // 是否正在录音
    const [recordingTime, setRecordingTime] = useState(0); // 录音时长（秒）
    const [showAudioSourceSelector, setShowAudioSourceSelector] = useState(false); // 是否显示音频源选择对话框
    const [availableAudioDevices, setAvailableAudioDevices] = useState([]); // 可用的音频设备列表
    const [selectedAudioSources, setSelectedAudioSources] = useState([]); // 用户选择的音频源
    const [audioStreams, setAudioStreams] = useState([]); // 当前活动的音频流
    const [mediaRecorder, setMediaRecorder] = useState(null); // MediaRecorder实例
    const [recordedChunks, setRecordedChunks] = useState([]); // 录音数据块
    const [audioContext, setAudioContext] = useState(null); // Web Audio API上下文
    const [recordingTimerInterval, setRecordingTimerInterval] = useState(null); // 录音计时器
    const [browserSupportsRecording, setBrowserSupportsRecording] = useState(true); // 浏览器是否支持录音

    // 录音功能工具函数
    
    // 检查浏览器是否支持录音功能
    const checkBrowserSupport = () => {
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
        const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        const isSupported = hasMediaRecorder && hasGetUserMedia;
        setBrowserSupportsRecording(isSupported);
        return isSupported;
    };

    // 获取可用的音频设备列表
    const getAudioDevices = async () => {
        try {
            // 首先请求权限以获取设备标签
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
            
            setAvailableAudioDevices(audioInputDevices);
            return audioInputDevices;
        } catch (error) {
            console.error('获取音频设备失败:', error);
            setErrorMsg('无法获取音频设备列表，请检查麦克风权限');
            return [];
        }
    };

    // 组件加载时检查浏览器支持，卸载时清理资源
    useEffect(() => {
        checkBrowserSupport();
        
        // 组件卸载时清理
        return () => {
            // 如果正在录音，停止录音
            if (isRecording) {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
                
                if (recordingTimerInterval) {
                    clearInterval(recordingTimerInterval);
                }
                
                audioStreams.forEach(stream => {
                    stream.getTracks().forEach(track => track.stop());
                });
                
                if (audioContext && audioContext.state !== 'closed') {
                    audioContext.close();
                }
            }
        };
    }, [isRecording, mediaRecorder, recordingTimerInterval, audioStreams, audioContext]);

    // 处理开始录音按钮点击
    const handleStartRecordingClick = async () => {
        if (!browserSupportsRecording) {
            setErrorMsg('您的浏览器不支持录音功能，请使用Chrome、Edge或Firefox浏览器');
            return;
        }
        
        setErrorMsg('');
        // 获取音频设备列表
        await getAudioDevices();
        // 显示音频源选择对话框
        setShowAudioSourceSelector(true);
    };

    // 处理音频源选择变化
    const handleAudioSourceToggle = (sourceId) => {
        setSelectedAudioSources(prev => {
            if (prev.includes(sourceId)) {
                return prev.filter(id => id !== sourceId);
            } else {
                return [...prev, sourceId];
            }
        });
    };

    // 检查浏览器是否支持系统声音录制
    const checkSystemAudioSupport = () => {
        // getDisplayMedia API 用于捕获系统声音
        return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    };

    // 请求麦克风权限并获取音频流
    const requestMicrophonePermission = async (deviceId) => {
        try {
            const constraints = {
                audio: deviceId ? { deviceId: { exact: deviceId } } : true
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            return stream;
        } catch (error) {
            console.error('麦克风权限请求失败:', error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('麦克风权限被拒绝，无法录音');
            } else if (error.name === 'NotFoundError') {
                throw new Error('未找到麦克风设备');
            } else {
                throw new Error('无法访问麦克风：' + error.message);
            }
        }
    };

    // 请求系统声音权限并获取音频流
    const requestSystemAudioPermission = async () => {
        try {
            // 使用 getDisplayMedia 捕获系统音频
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true, // 需要视频才能捕获音频
                audio: true
            });
            
            // 只保留音频轨道，移除视频轨道
            const audioTracks = stream.getAudioTracks();
            const videoTracks = stream.getVideoTracks();
            
            // 停止视频轨道
            videoTracks.forEach(track => track.stop());
            
            if (audioTracks.length === 0) {
                throw new Error('未能捕获系统音频，请确保在共享时选择了"共享音频"选项');
            }
            
            // 创建只包含音频的新流
            const audioOnlyStream = new MediaStream(audioTracks);
            return audioOnlyStream;
        } catch (error) {
            console.error('系统声音权限请求失败:', error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('系统音频权限被拒绝');
            } else {
                throw new Error('无法捕获系统音频：' + error.message);
            }
        }
    };

    // 获取所有选中的音频流
    const getAllSelectedAudioStreams = async () => {
        const streams = [];
        const errors = [];
        
        for (const sourceId of selectedAudioSources) {
            try {
                if (sourceId === 'system-audio') {
                    const stream = await requestSystemAudioPermission();
                    streams.push(stream);
                } else {
                    // 麦克风设备
                    const stream = await requestMicrophonePermission(sourceId);
                    streams.push(stream);
                }
            } catch (error) {
                errors.push(error.message);
            }
        }
        
        if (streams.length === 0) {
            throw new Error(errors.join('; '));
        }
        
        return streams;
    };

    // 创建音频混音器，合并多个音频流
    const createAudioMixer = (streams) => {
        try {
            // 创建 Web Audio API 上下文
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            setAudioContext(ctx);
            
            // 创建目标节点用于混音
            const destination = ctx.createMediaStreamDestination();
            
            // 为每个音频流创建源节点并连接到目标
            streams.forEach(stream => {
                const source = ctx.createMediaStreamSource(stream);
                
                // 创建增益节点用于音量控制
                const gainNode = ctx.createGain();
                // 自动平衡音量：如果有多个源，降低每个源的音量
                gainNode.gain.value = 1.0 / Math.sqrt(streams.length);
                
                // 连接：源 -> 增益 -> 目标
                source.connect(gainNode);
                gainNode.connect(destination);
                
                // 监听音频轨道结束事件
                stream.getAudioTracks().forEach(track => {
                    track.onended = () => {
                        console.warn('音频源断开:', track.label);
                        setErrorMsg(`警告：音频源 ${track.label} 已断开`);
                    };
                });
            });
            
            // 返回混音后的流
            return destination.stream;
        } catch (error) {
            console.error('创建音频混音器失败:', error);
            throw new Error('无法创建音频混音器：' + error.message);
        }
    };

    // 开始录音
    const startRecording = (stream) => {
        try {
            // 检查支持的MIME类型
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/wav';
                }
            }
            
            // 创建MediaRecorder实例
            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks = [];
            
            // 监听数据可用事件
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            
            // 监听录音停止事件
            recorder.onstop = () => {
                setRecordedChunks(chunks);
            };
            
            // 监听错误事件
            recorder.onerror = (event) => {
                console.error('录音错误:', event.error);
                setErrorMsg('录音过程中出错：' + event.error.message);
                stopRecording();
            };
            
            // 开始录音
            recorder.start(1000); // 每秒收集一次数据
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);
            setRecordedChunks([]);
            
            // 启动计时器
            const timer = setInterval(() => {
                setRecordingTime(prev => {
                    const newTime = prev + 1;
                    // 检查是否超过2小时（7200秒）
                    if (newTime >= 7200) {
                        setErrorMsg('录音时长已达上限（2小时），自动停止录音');
                        stopRecording();
                    }
                    return newTime;
                });
            }, 1000);
            setRecordingTimerInterval(timer);
            
            console.log('录音已开始，MIME类型:', mimeType);
        } catch (error) {
            console.error('开始录音失败:', error);
            setErrorMsg('无法开始录音：' + error.message);
            throw error;
        }
    };

    // 停止录音
    const stopRecording = () => {
        // 检查录音时长
        if (recordingTime < 5 && recordingTime > 0) {
            const confirmed = window.confirm('录音时长过短（少于5秒），确定要停止吗？');
            if (!confirmed) {
                return;
            }
        }
        
        // 停止MediaRecorder
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        // 停止计时器
        if (recordingTimerInterval) {
            clearInterval(recordingTimerInterval);
            setRecordingTimerInterval(null);
        }
        
        // 停止所有音频流
        audioStreams.forEach(stream => {
            stream.getTracks().forEach(track => track.stop());
        });
        
        // 关闭AudioContext
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
        
        setIsRecording(false);
        console.log('录音已停止');
    };

    // 取消录音
    const cancelRecording = () => {
        const confirmed = window.confirm('确定要取消录音吗？录音数据将被丢弃。');
        if (!confirmed) {
            return;
        }
        
        // 停止MediaRecorder
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        // 停止计时器
        if (recordingTimerInterval) {
            clearInterval(recordingTimerInterval);
            setRecordingTimerInterval(null);
        }
        
        // 停止所有音频流
        audioStreams.forEach(stream => {
            stream.getTracks().forEach(track => track.stop());
        });
        
        // 关闭AudioContext
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
        
        // 清空录音数据
        setRecordedChunks([]);
        setIsRecording(false);
        setRecordingTime(0);
        setAudioStreams([]);
        setMediaRecorder(null);
        setAudioContext(null);
        
        console.log('录音已取消');
    };

    // 格式化录音时长（MM:SS）
    const formatRecordingTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 生成音频文件
    const generateAudioFile = async () => {
        try {
            if (recordedChunks.length === 0) {
                throw new Error('没有录音数据');
            }
            
            // 显示加载状态
            setProcessingStatus({ status: 'uploading', progress: 0 });
            setErrorMsg('正在生成音频文件...');
            
            // 确定MIME类型
            let mimeType = 'audio/webm;codecs=opus';
            if (recordedChunks[0] && recordedChunks[0].type) {
                mimeType = recordedChunks[0].type;
            }
            
            // 创建Blob
            const audioBlob = new Blob(recordedChunks, { type: mimeType });
            
            // 生成文件名：recording_YYYYMMDD_HHMMSS.webm
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            
            // 确定文件扩展名
            let extension = 'webm';
            if (mimeType.includes('wav')) {
                extension = 'wav';
            } else if (mimeType.includes('mp4')) {
                extension = 'm4a';
            }
            
            const fileName = `recording_${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
            
            // 创建File对象
            const audioFile = new File([audioBlob], fileName, { type: mimeType });
            
            console.log('音频文件生成成功:', fileName, '大小:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB');
            
            setErrorMsg('');
            return audioFile;
        } catch (error) {
            console.error('生成音频文件失败:', error);
            setErrorMsg('音频文件生成失败：' + error.message);
            throw error;
        }
    };

    const handleFileUpload = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            // 处理文件上传逻辑
        }
    };

    const startProcessing = async (fileObj) => {
        setAppState('processing');
        setErrorMsg('');
        setIsUploading(true); // 开始上传，显示加载状态
        setProcessingStatus({ status: 'uploading', progress: 0 });
        
        // 生成文件ID用于进度查询（使用时间戳+文件名）
        const fileId = `${Date.now()}-${fileObj.name}`;
        setCurrentFileId(fileId);

        const formData = new FormData();
        formData.append('file', fileObj);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const resData = await response.json();
            
            if (resData.code === 200) {
                // 文件接收成功，开始异步处理，设置文件ID用于进度轮询
                setCurrentFileId(resData.fileId);
                // 保持uploading状态，直到进度轮询检测到状态变化，避免状态闪断
                setProcessingStatus({ status: 'uploading', progress: 10 });
                // 保持isUploading为true，直到整个处理流程完成
                setIsUploading(true); // 确保上传状态持续显示
                
                // 不立即设置completed状态，等待进度轮询更新状态
            } else {
                throw new Error(resData.message || '处理失败');
            }
        } catch (error) {
            console.error("处理失败:", error);
            setAppState('idle');
            setIsUploading(false); // 只有在最终失败时才重置上传状态
            
            // 更准确的错误信息分类
            let errorMessage = "处理失败";
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMessage = "网络连接失败，请检查后端服务是否启动";
            } else if (error.message.includes('413')) {
                errorMessage = "文件过大，请上传小于50MB的文件";
            } else if (error.message.includes('400')) {
                errorMessage = "文件格式不支持，请上传MP3/M4A/WAV格式音频";
            } else if (error.message.includes('500')) {
                errorMessage = "服务器内部错误，请稍后重试";
            } else if (error.message.includes('OpenAI API')) {
                errorMessage = "AI服务配置错误，请检查API密钥";
            } else {
                errorMessage = `处理失败: ${error.message}`;
            }
            
            setErrorMsg(errorMessage);
            setAppState('idle');
            setProcessingStatus({ status: 'error', progress: 0 });
        }
    };



    // 开始进度轮询
    useEffect(() => {
        if (appState === 'processing' && currentFileId) {
            // 清除之前的轮询（如果有）
            if (window.progressInterval) {
                clearInterval(window.progressInterval);
            }
            
            // 确保上传状态持续显示
            setIsUploading(true);
            
            window.progressInterval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/progress/${currentFileId}`);
                    if (response.ok) {
                        const progressData = await response.json();
                        setProcessingStatus({
                            status: progressData.status,
                            progress: progressData.progress,
                            currentChunk: progressData.currentChunk,
                            totalChunks: progressData.totalChunks
                        });
                        
                        // 只有当处理完成或出错时才重置上传状态
                        if (progressData.status === 'completed' || progressData.status === 'error' || progressData.status === 'cancelled') {
                            setIsUploading(false);
                        }
                        
                        // 如果处理完成，更新应用状态并获取会议纪要数据
                        if (progressData.status === 'completed') {
                            try {
                                const minutesResponse = await fetch(`/api/minutes/${currentFileId}`);
                                if (minutesResponse.ok) {
                                    const minutesResult = await minutesResponse.json();
                                    setMinutesData(minutesResult.minutesData);
                                    setTranscript(minutesResult.transcript || '');
                                    setAppState('completed');
                                    setIsUploading(false); // 处理完成，重置上传状态
                                } else {
                                    setErrorMsg('获取会议纪要数据失败');
                                    setAppState('idle');
                                    setIsUploading(false); // 获取数据失败，重置上传状态
                                }
                            } catch (error) {
                                console.error('获取会议纪要数据失败:', error);
                                setErrorMsg('获取会议纪要数据失败，请刷新页面重试');
                                setAppState('idle');
                                setIsUploading(false); // 获取数据失败，重置上传状态
                            }
                            if (window.progressInterval) {
                                clearInterval(window.progressInterval);
                                window.progressInterval = null;
                            }
                        } else if (progressData.status === 'error' || progressData.status === 'cancelled') {
                            setErrorMsg(`处理${progressData.status === 'cancelled' ? '已取消' : '过程中出错'}: ${progressData.error || '未知错误'}`);
                            setAppState('idle');
                            setIsUploading(false); // 处理出错或取消，重置上传状态
                            if (window.progressInterval) {
                                clearInterval(window.progressInterval);
                                window.progressInterval = null;
                            }
                        }
                        
                        // 状态转换逻辑：当后端状态从uploading变为splitting时，保持uploading状态一段时间
                        // 确保用户能看到完整的上传过程，避免状态闪断
                        if (progressData.status === 'splitting' && processingStatus.status === 'uploading') {
                            // 保持uploading状态，确保用户能看到完整的上传过程
                            // 在下一次轮询时再更新为splitting状态
                            setProcessingStatus({ status: 'uploading', progress: 20 });
                        } else if (progressData.status === 'splitting' && processingStatus.status !== 'uploading') {
                            // 当状态已经不是uploading时，正常更新为splitting状态
                            setProcessingStatus({ status: 'splitting', progress: 30 });
                        }
                    }
                } catch (error) {
                    console.error('进度查询失败:', error);
                }
            }, 2000); // 每2秒查询一次进度
        }
        
        return () => {
            // 清理轮询
            if (window.progressInterval) {
                clearInterval(window.progressInterval);
                window.progressInterval = null;
            }
        };
    }, [appState, currentFileId]);

    // 监听录音停止后生成文件并上传
    useEffect(() => {
        const handleRecordingComplete = async () => {
            if (!isRecording && recordedChunks.length > 0) {
                try {
                    // 生成音频文件
                    const audioFile = await generateAudioFile();
                    
                    // 自动上传并处理
                    console.log('音频文件已生成，开始上传:', audioFile.name);
                    await startProcessing(audioFile);
                    
                    // 清空录音数据
                    setRecordedChunks([]);
                } catch (error) {
                    console.error('处理录音文件失败:', error);
                    setAppState('idle');
                }
            }
        };
        
        handleRecordingComplete();
    }, [isRecording, recordedChunks]);

    const resetApp = () => {
        // 清理轮询interval
        if (window.progressInterval) {
            clearInterval(window.progressInterval);
            window.progressInterval = null;
        }
        
        setAppState('idle');
        setMinutesData(null);
        setTranscript('');
        setErrorMsg('');
        setProcessingStatus({ status: '', progress: 0 });
        setCurrentFileId('');
        setIsUploading(false); // 重置上传状态
    };

    // 获取进度状态描述
    const getStatusDescription = (status, progressData) => {
        const statusMap = {
            'uploading': '上传文件中...',
            'splitting': '音频文件切割中...',
            'transcribing': progressData?.currentChunk && progressData?.totalChunks 
                ? `语音转录中... (${progressData.currentChunk}/${progressData.totalChunks})`
                : '语音转录中...',
            'generating_summary': '生成会议纪要中...',
            'completed': '处理完成',
            'error': '处理出错',
            'cancelled': '处理已取消'
        };
        return statusMap[status] || '处理中...';
    };



    // 渲染单个语言版本的纪要列
    const renderMinutesColumn = (data, langTitle) => {
        if (!data) return null;

        // 格式化文本
        let text = '';
        text += `1. Meeting Title / Date / Attendees\n`;
        text += `${data.title || "Not specified"}\n`;
        text += `${data.date || ""}\n`;
        if (data.attendees && data.attendees.length > 0) {
            text += `Attendees: ${data.attendees.join(', ')}\n`;
        }
        text += `\n`;
        
        text += `2. Summary\n`;
        text += `${data.summary || ""}\n\n`;
        
        text += `3. Key Discussion Points\n`;
        if (data.key_discussion_points && data.key_discussion_points.length > 0) {
            data.key_discussion_points.forEach(point => {
                text += `- ${point}\n`;
            });
        } else {
            text += `None\n`;
        }
        text += `\n`;
        
        text += `4. Decisions Made\n`;
        if (data.decisions_made && data.decisions_made.length > 0) {
            data.decisions_made.forEach(d => {
                text += `- ${d}\n`;
            });
        } else {
            text += `None\n`;
        }
        text += `\n`;
        
        text += `5. Action Items\n`;
        if (data.action_items && data.action_items.length > 0) {
            data.action_items.forEach(item => {
                text += `- [${item.assignee || 'Unassigned'}] ${item.task} (Due: ${item.deadline || 'No Date'})\n`;
            });
        } else {
            text += `No action items\n`;
        }
        text += `\n`;
        
        text += `6. Risks / Issues\n`;
        if (data.risks_issues && data.risks_issues.length > 0) {
            data.risks_issues.forEach(r => {
                text += `- ${r}\n`;
            });
        } else {
            text += `None\n`;
        }
        text += `\n`;
        
        text += `7. Next Steps\n`;
        if (data.next_steps && data.next_steps.length > 0) {
            data.next_steps.forEach(n => {
                text += `- ${n}\n`;
            });
        } else {
            text += `None\n`;
        }

        const copyToClipboard = () => {
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById(`btn-copy-${langTitle}`);
                if(btn) {
                    // const originalText = btn.innerText; // 简单处理，不保存原始文本
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 已复制!';
                    btn.style.background = '#4ade80';
                    setTimeout(() => {
                        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw" style="transform: rotate(0deg);"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg> 复制内容';
                        btn.style.background = '#818cf8';
                    }, 2000);
                }
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败');
            });
        };

        return (
            <div className="minutes-column">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #818cf8', paddingBottom: '10px'}}>
                    <h2 style={{margin: 0}}>
                        {langTitle}
                    </h2>
                    <button 
                        id={`btn-copy-${langTitle}`}
                        onClick={copyToClipboard}
                        style={{
                            padding: '6px 12px',
                            background: '#818cf8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <RefreshCw size={16} style={{transform: 'rotate(0deg)'}}/> 
                        复制内容
                    </button>
                </div>

                <textarea 
                    readOnly
                    value={text}
                    style={{
                        width: '100%',
                        height: '600px',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        resize: 'vertical',
                        backgroundColor: 'rgba(30, 41, 59, 0.6)',
                        color: '#f1f5f9',
                        whiteSpace: 'pre-wrap',
                        outline: 'none',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                    }}
                />
            </div>
        );
    };

    return (
        <div className="app-container">
            <header className="header">
                <div className="logo">
                    <img src={sheaWhiteLogo} alt="Shea Logo" style={{height: '48px', marginRight: '15px', filter: 'brightness(1.2)', transition: 'all 0.3s ease'}}/>
                    <span style={{fontSize: '1.8rem', fontWeight: '700', background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'}}>EchoFlow Pro</span>
                </div>
                <div className="partner-logo">
                    <img src={tencentCloudLogo} alt="Tencent Cloud" style={{height: '40px', opacity: 0.95, transition: 'all 0.3s ease'}} />
                </div>
            </header>

            {/* 音频源选择对话框 */}
            {showAudioSourceSelector && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        borderRadius: '16px',
                        padding: '30px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <h2 style={{marginTop: 0, marginBottom: '20px', color: '#f1f5f9', fontSize: '1.5rem'}}>
                            选择音频源
                        </h2>
                        
                        <div style={{marginBottom: '25px'}}>
                            <h3 style={{fontSize: '1rem', color: '#cbd5e1', marginBottom: '15px'}}>麦克风设备</h3>
                            {availableAudioDevices.length === 0 ? (
                                <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>未检测到麦克风设备</p>
                            ) : (
                                availableAudioDevices.map(device => (
                                    <label key={device.deviceId} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px',
                                        marginBottom: '10px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        border: selectedAudioSources.includes(device.deviceId) ? '2px solid #818cf8' : '2px solid transparent'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                    >
                                        <input 
                                            type="checkbox"
                                            checked={selectedAudioSources.includes(device.deviceId)}
                                            onChange={() => handleAudioSourceToggle(device.deviceId)}
                                            style={{marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer'}}
                                        />
                                        <span style={{color: '#f1f5f9', fontSize: '0.95rem'}}>
                                            {device.label || `麦克风 ${device.deviceId.substring(0, 8)}`}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>

                        {checkSystemAudioSupport() && (
                            <div style={{marginBottom: '25px'}}>
                                <h3 style={{fontSize: '1rem', color: '#cbd5e1', marginBottom: '15px'}}>系统声音</h3>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    border: selectedAudioSources.includes('system-audio') ? '2px solid #818cf8' : '2px solid transparent'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                >
                                    <input 
                                        type="checkbox"
                                        checked={selectedAudioSources.includes('system-audio')}
                                        onChange={() => handleAudioSourceToggle('system-audio')}
                                        style={{marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer'}}
                                    />
                                    <span style={{color: '#f1f5f9', fontSize: '0.95rem'}}>
                                        系统声音（屏幕共享音频）
                                    </span>
                                </label>
                                <p style={{color: '#94a3b8', fontSize: '0.85rem', marginTop: '8px', marginLeft: '28px'}}>
                                    注意：Safari浏览器不支持系统声音录制
                                </p>
                            </div>
                        )}

                        <div style={{display: 'flex', gap: '10px', marginTop: '25px'}}>
                            <button
                                onClick={() => {
                                    setShowAudioSourceSelector(false);
                                    setSelectedAudioSources([]);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#f1f5f9',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                            >
                                取消
                            </button>
                            <button
                                onClick={async () => {
                                    if (selectedAudioSources.length === 0) {
                                        setErrorMsg('请至少选择一个音频源');
                                        return;
                                    }
                                    
                                    try {
                                        setErrorMsg('');
                                        // 获取所有选中的音频流
                                        const streams = await getAllSelectedAudioStreams();
                                        setAudioStreams(streams);
                                        
                                        // 创建混音流
                                        let mixedStream;
                                        if (streams.length > 1) {
                                            // 多个音频源，需要混音
                                            mixedStream = createAudioMixer(streams);
                                        } else {
                                            // 单个音频源，直接使用
                                            mixedStream = streams[0];
                                        }
                                        
                                        // 关闭对话框
                                        setShowAudioSourceSelector(false);
                                        
                                        // 开始录音
                                        startRecording(mixedStream);
                                    } catch (error) {
                                        setErrorMsg(error.message);
                                    }
                                }}
                                disabled={selectedAudioSources.length === 0}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: selectedAudioSources.length === 0 ? 'rgba(129, 140, 248, 0.3)' : 'linear-gradient(135deg, #818cf8, #6366f1)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: selectedAudioSources.length === 0 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    opacity: selectedAudioSources.length === 0 ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedAudioSources.length > 0) {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(129, 140, 248, 0.4)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                确认并开始录制
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main>
                {appState === 'idle' && (
                    <div className="hero-section">
                        <h1>智能会议纪要生成</h1>
                        <p style={{ color: '#94a3b8', marginBottom: '40px', fontSize: '1.1rem' }}>
                            企业级 AI 引擎 · 自动分片处理大文件 · 8点结构化输出
                        </p>
                        {errorMsg && <p style={{color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px'}}>{errorMsg}</p>}



                        {/* 文件上传区域 */}
                        <div className="upload-section">
                            <div className={`upload-card ${isUploading ? 'uploading' : ''}`}>
                                <input type="file" accept="audio/*" onChange={handleFileUpload} className="file-input" />
                                <div className="upload-icon-wrapper" style={{background: 'rgba(99, 102, 241, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', position: 'relative'}}>
                                    <Upload size={40} color="#818cf8"/>
                                    <div className="upload-pulse" style={{
                                        position: 'absolute',
                                        top: '-10px',
                                        left: '-10px',
                                        right: '-10px',
                                        bottom: '-10px',
                                        borderRadius: '50%',
                                        border: '2px solid #818cf8',
                                        animation: isUploading ? 'uploadPulse 1.5s infinite' : 'none',
                                        opacity: isUploading ? 1 : 0
                                    }}></div>
                                </div>
                                <h3 style={{marginBottom: '10px'}}>
                                    {isUploading ? '文件上传中...' : '点击或拖拽上传音频文件'}
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: isUploading ? '#818cf8' : '#64748b' }}>
                                    {isUploading ? '请稍候，正在上传您的音频文件...' : '支持 MP3 / M4A / WAV / WebM 等音频格式'}
                                </p>
                            </div>

                            {/* 录音按钮 */}
                            {browserSupportsRecording && (
                                <div style={{marginTop: '30px', textAlign: 'center'}}>
                                    <div style={{margin: '20px 0', color: '#94a3b8', fontSize: '0.9rem'}}>或</div>
                                    <button 
                                        onClick={handleStartRecordingClick}
                                        disabled={isUploading || appState !== 'idle'}
                                        className="btn-recording"
                                        style={{
                                            padding: '15px 30px',
                                            background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                                            border: 'none',
                                            borderRadius: '12px',
                                            color: 'white',
                                            fontSize: '1rem',
                                            fontWeight: 'bold',
                                            cursor: isUploading || appState !== 'idle' ? 'not-allowed' : 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            transition: 'all 0.3s ease',
                                            opacity: isUploading || appState !== 'idle' ? 0.5 : 1,
                                            boxShadow: '0 4px 15px rgba(236, 72, 153, 0.3)'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isUploading && appState === 'idle') {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(236, 72, 153, 0.4)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(236, 72, 153, 0.3)';
                                        }}
                                    >
                                        <Mic size={20} />
                                        开始录音
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 录音中界面 */}
                {isRecording && (
                    <div className="recording-container" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '400px',
                        padding: '40px'
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                            borderRadius: '20px',
                            padding: '50px',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            textAlign: 'center',
                            maxWidth: '600px',
                            width: '100%'
                        }}>
                            {/* 录音图标动画 */}
                            <div style={{
                                width: '120px',
                                height: '120px',
                                margin: '0 auto 30px',
                                background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                animation: 'recordingPulse 2s ease-in-out infinite'
                            }}>
                                <Mic size={60} color="white" />
                                <div style={{
                                    position: 'absolute',
                                    top: '-10px',
                                    left: '-10px',
                                    right: '-10px',
                                    bottom: '-10px',
                                    borderRadius: '50%',
                                    border: '3px solid #ec4899',
                                    animation: 'recordingRipple 2s ease-out infinite'
                                }}></div>
                            </div>

                            <h2 style={{color: '#f1f5f9', marginBottom: '10px', fontSize: '1.8rem'}}>
                                正在录音...
                            </h2>
                            
                            {/* 录音时长 */}
                            <div style={{
                                fontSize: '3rem',
                                fontWeight: 'bold',
                                color: '#ec4899',
                                marginBottom: '30px',
                                fontFamily: 'monospace',
                                letterSpacing: '0.1em'
                            }}>
                                {formatRecordingTime(recordingTime)}
                            </div>

                            {/* 音量指示器（简化版） */}
                            <div style={{
                                width: '100%',
                                height: '60px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                borderRadius: '10px',
                                marginBottom: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                padding: '0 20px'
                            }}>
                                {[...Array(20)].map((_, i) => (
                                    <div key={i} style={{
                                        width: '8px',
                                        height: `${20 + Math.random() * 40}px`,
                                        background: 'linear-gradient(to top, #ec4899, #f43f5e)',
                                        borderRadius: '4px',
                                        animation: `waveAnimation ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate`,
                                        animationDelay: `${i * 0.05}s`
                                    }}></div>
                                ))}
                            </div>

                            {/* 控制按钮 */}
                            <div style={{display: 'flex', gap: '15px', justifyContent: 'center'}}>
                                <button
                                    onClick={cancelRecording}
                                    style={{
                                        padding: '15px 40px',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    取消录音
                                </button>
                                <button
                                    onClick={stopRecording}
                                    style={{
                                        padding: '15px 40px',
                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.3)';
                                    }}
                                >
                                    停止录音
                                </button>
                            </div>

                            <p style={{color: '#94a3b8', fontSize: '0.9rem', marginTop: '20px'}}>
                                录音将自动保存并处理为会议纪要
                            </p>
                        </div>

                        {/* 添加动画样式 */}
                        <style>{`
                            @keyframes recordingPulse {
                                0%, 100% {
                                    transform: scale(1);
                                    box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.7);
                                }
                                50% {
                                    transform: scale(1.05);
                                    box-shadow: 0 0 0 20px rgba(236, 72, 153, 0);
                                }
                            }
                            @keyframes recordingRipple {
                                0% {
                                    transform: scale(1);
                                    opacity: 1;
                                }
                                100% {
                                    transform: scale(1.5);
                                    opacity: 0;
                                }
                            }
                            @keyframes waveAnimation {
                                0% {
                                    height: 20px;
                                }
                                100% {
                                    height: 50px;
                                }
                            }
                        `}</style>
                    </div>
                )}

                {appState === 'processing' && (
                    <div className="processing-container">
                        <div className="processing-header">
                            <h2>AI 正在处理您的会议录音</h2>
                            <button 
                                onClick={async () => {
                                    // 停止进度轮询
                                    if (window.progressInterval) {
                                        clearInterval(window.progressInterval);
                                    }
                                    
                                    // 发送取消请求到后端
                                    if (currentFileId) {
                                        try {
                                            await fetch(`/api/cancel/${currentFileId}`, { 
                                                method: 'POST' 
                                            });
                                            console.log('取消请求发送成功');
                                        } catch (err) {
                                            console.log('取消请求发送失败:', err);
                                        }
                                    }
                                    
                                    // 重置应用状态回到首页
                                    resetApp();
                                }}
                                className="btn-cancel"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                                取消处理
                            </button>
                        </div>
                        
                        <div className="steps-container">
                            {['uploading', 'splitting', 'transcribing', 'generating_summary'].map((stepId, index) => {
                                const steps = [
                                    { id: 'uploading', label: '上传文件中', icon: Upload },
                                    { id: 'splitting', label: '智能音频分片', icon: FileAudio },
                                    { id: 'transcribing', label: 'AI 语音转录', icon: Cpu },
                                    { id: 'generating_summary', label: 'AI 生成结构化纪要', icon: Loader2 },
                                ];
                                const step = steps[index];
                                const currentStatus = processingStatus.status;
                                
                                // 计算步骤状态
                                let stepState = 'pending'; // pending, active, completed
                                const statusOrder = ['uploading', 'splitting', 'transcribing', 'generating_summary', 'completed'];
                                const currentIndex = statusOrder.indexOf(currentStatus);
                                const stepIndex = statusOrder.indexOf(step.id);
                                
                                if (currentStatus === 'completed') {
                                    stepState = 'completed';
                                } else if (currentStatus === 'error') {
                                    stepState = stepIndex <= currentIndex ? 'error' : 'pending';
                                } else {
                                    if (stepIndex < currentIndex) stepState = 'completed';
                                    else if (stepIndex === currentIndex) stepState = 'active';
                                    else stepState = 'pending';
                                }

                                // 特殊处理：如果直接跳过了 splitting (文件小)，当处于 transcribing 时，splitting 应显示完成
                                if ((currentStatus === 'transcribing' || currentStatus === 'generating_summary') && step.id === 'splitting') {
                                    stepState = 'completed';
                                }

                                return (
                                    <div key={step.id} className={`step-item ${stepState}`}>
                                        <div className="step-icon">
                                            {stepState === 'completed' ? (
                                                <CheckCircle size={20} />
                                            ) : (
                                                <step.icon size={20} className={stepState === 'active' && step.id === 'generating_summary' ? 'spin-icon' : ''} />
                                            )}
                                        </div>
                                        <div className="step-content">
                                            <div className="step-text-container">
                                                <div className="step-label">{step.label}</div>
                                            </div>
                                            {stepState === 'active' && (
                                                <div className="step-indicator">
                                                    <span className="pulse-dot"></span>
                                                    {getStatusDescription(step.id, processingStatus)}
                                                </div>
                                            )}
                                        </div>
                                        {index < steps.length - 1 && <div className={`step-line ${stepState === 'completed' ? 'completed' : ''}`}></div>}
                                    </div>
                                );
                            })}
                        </div>
                        
                        <style>{`
                            .steps-container {
                                display: flex;
                                flex-direction: column;
                                gap: 0;
                                max-width: 400px;
                                margin: 0 auto;
                                padding: 20px;
                            }
                            .step-item {
                                display: flex;
                                alignItems: flex-start;
                                gap: 15px;
                                position: relative;
                                opacity: 0.5;
                                transition: all 0.5s ease;
                                padding-bottom: 30px;
                            }
                            .step-item:last-child {
                                padding-bottom: 0;
                            }
                            .step-item.active {
                                opacity: 1;
                                animation: processingPulse 2s ease-in-out infinite;
                            }
                            .step-item.completed {
                                opacity: 1;
                            }
                            @keyframes processingPulse {
                                0%, 100% {
                                    opacity: 0.8;
                                    transform: scale(1);
                                }
                                50% {
                                    opacity: 1;
                                    transform: scale(1.02);
                                }
                            }
                            .step-icon {
                                width: 40px;
                                height: 40px;
                                border-radius: 50%;
                                background: #f1f5f9;
                                display: grid;
                                place-items: center;
                                color: #64748b;
                                z-index: 2;
                                transition: all 0.3s ease;
                                flex-shrink: 0;
                            }
                            .step-icon svg {
                                display: block;
                            }
                            .step-item.active .step-icon {
                                background: #818cf8;
                                color: white;
                                box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.2);
                                animation: activeIconPulse 1.5s ease-in-out infinite;
                            }
                            .step-item.completed .step-icon {
                                background: #4ade80;
                                color: white;
                                transition: all 0.5s ease;
                            }
                            @keyframes activeIconPulse {
                                0%, 100% {
                                    background: #818cf8;
                                    box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.2);
                                }
                                50% {
                                    background: #6366f1;
                                    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.3);
                                }
                            }
                            .step-content {
                                flex: 1;
                            }
                            .step-text-container {
                                height: 40px;
                                display: flex;
                                alignItems: center;
                            }
                            .step-label {
                                font-weight: 600;
                                font-size: 1rem;
                                line-height: 1.2;
                                color: #f1f5f9;
                                transition: all 0.3s ease;
                            }
                            .step-item.active .step-label {
                                animation: activeTextGlow 2s ease-in-out infinite;
                            }
                            @keyframes activeTextGlow {
                                0%, 100% {
                                    color: #f1f5f9;
                                    text-shadow: 0 0 0 rgba(129, 140, 248, 0);
                                }
                                50% {
                                    color: #818cf8;
                                    text-shadow: 0 0 10px rgba(129, 140, 248, 0.5);
                                }
                            }
                            .step-indicator {
                                font-size: 0.8rem;
                                color: #818cf8;
                                display: flex;
                                alignItems: center;
                                gap: 6px;
                                margin-top: -5px;
                                margin-bottom: 5px;
                                padding-left: 2px;
                            }
                            .pulse-dot {
                                width: 8px;
                                height: 8px;
                                background-color: #818cf8;
                                border-radius: 50%;
                                animation: pulse 1.5s infinite;
                            }
                            .step-line {
                                position: absolute;
                                left: 20px; /* Center of 40px icon */
                                top: 40px;
                                bottom: 0;
                                width: 2px;
                                background: #e2e8f0;
                                z-index: 1;
                                transform: translateX(-50%);
                            }
                            .step-line.completed {
                                background: #4ade80;
                            }
                            .spin-icon {
                                animation: spin 2s linear infinite;
                            }
                            @keyframes pulse {
                                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(129, 140, 248, 0.7); }
                                70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(129, 140, 248, 0); }
                                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(129, 140, 248, 0); }
                            }
                            @keyframes spin { 
                                0% { transform: rotate(0deg); } 
                                100% { transform: rotate(360deg); } 
                            }
                        `}</style>
                    </div>
                )}

                {appState === 'completed' && minutesData && (
                    <div className="result-container">
                        <div className="result-header">
                            <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                <CheckCircle size={20} color="#4ade80" />
                                <span style={{fontSize:'1.1rem', fontWeight:'bold'}}>会议纪要生成完成</span>
                            </div>
                            <div>
                                <button onClick={resetApp} className="btn-reset" style={{ marginRight: '15px' }}>
                                    <RefreshCw size={16} style={{marginRight:'5px', verticalAlign:'middle'}}/> 新会议
                                </button>
                                <button style={{padding:'10px 20px', background:'linear-gradient(135deg, #6366f1, #a855f7)', border:'none', borderRadius:'10px', color:'white', fontWeight:'bold', cursor:'pointer'}}>
                                    <Download size={16} style={{marginRight:'5px', verticalAlign:'middle'}}/> 导出 PDF
                                </button>
                            </div>
                        </div>

                        {/* 左右双栏布局 */}
                        <div className="minutes-split-view">
                            {/* 左侧中文 */}
                            {renderMinutesColumn(minutesData.chinese, "中文纪要")}
                            {/* 右侧英文 */}
                            {renderMinutesColumn(minutesData.english, "English Minutes")}
                        </div>

                        {/* 原始转录文本展示 */}
                        {transcript && (
                            <div className="transcript-section" style={{marginTop: '40px', paddingTop: '30px', borderTop: '1px solid rgba(226, 232, 240, 0.1)'}}>
                                <div style={{display: 'flex', alignItems: 'center', marginBottom: '15px', gap: '10px'}}>
                                    <FileAudio size={20} color="#818cf8"/>
                                    <h3 style={{margin: 0, fontSize: '1.2rem', color: '#f1f5f9'}}>原始转录文本 (Transcript)</h3>
                                </div>
                                <textarea 
                                    readOnly
                                    value={transcript}
                                    style={{
                                        width: '100%',
                                        height: '300px',
                                        padding: '20px',
                                        boxSizing: 'border-box',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        fontFamily: 'system-ui, -apple-system, sans-serif',
                                        fontSize: '14px',
                                        lineHeight: '1.8',
                                        resize: 'vertical',
                                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                                        color: '#cbd5e1',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        overflowY: 'auto',
                                        outline: 'none',
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-logo">
                        <img src={sheaWhiteLogo} alt="Shea Logo" style={{height: '24px', marginRight: '10px', opacity: 0.9}}/>
                    </div>
                    <div className="footer-text">
                        Copyright © 1992-2025 Shea All Rights Reserved
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;