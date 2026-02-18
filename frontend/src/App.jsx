import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileAudio, CheckCircle, Clock, Download, Settings, Cpu, Loader2, RefreshCw, CloudUpload } from 'lucide-react';
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
                        </div>
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