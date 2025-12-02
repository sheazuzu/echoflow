import React, { useState, useEffect } from 'react';
import { Upload, FileAudio, CheckCircle, Clock, Download, Settings, Cpu, Loader2, RefreshCw } from 'lucide-react';
import './App.css';

// 导入腾讯云logo
import tencentCloudLogo from './assets/tencentcloud.png';

const App = () => {
    const [appState, setAppState] = useState('idle'); // idle, processing, completed
    const [minutesData, setMinutesData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [processingStatus, setProcessingStatus] = useState({ status: '', progress: 0 });
    const [currentFileId, setCurrentFileId] = useState('');

    const handleFileUpload = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            startProcessing(selectedFile);
        }
    };

    const startProcessing = async (fileObj) => {
        setAppState('processing');
        setErrorMsg('');
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
                setProcessingStatus({ status: 'uploaded', progress: 10 });
                
                // 不立即设置completed状态，等待进度轮询更新状态
            } else {
                throw new Error(resData.message || '处理失败');
            }
        } catch (error) {
            console.error("处理失败:", error);
            
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
        let interval;
        
        if (appState === 'processing' && currentFileId) {
            interval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/progress/${currentFileId}`);
                    if (response.ok) {
                        const progressData = await response.json();
                        setProcessingStatus({
                            status: progressData.status,
                            progress: progressData.progress
                        });
                        
                        // 如果处理完成，更新应用状态并获取会议纪要数据
                        if (progressData.status === 'completed') {
                            try {
                                const minutesResponse = await fetch(`/api/minutes/${currentFileId}`);
                                if (minutesResponse.ok) {
                                    const minutesResult = await minutesResponse.json();
                                    setMinutesData(minutesResult.minutesData);
                                    setAppState('completed');
                                } else {
                                    setErrorMsg('获取会议纪要数据失败');
                                    setAppState('idle');
                                }
                            } catch (error) {
                                console.error('获取会议纪要数据失败:', error);
                                setErrorMsg('获取会议纪要数据失败，请刷新页面重试');
                                setAppState('idle');
                            }
                            clearInterval(interval);
                        } else if (progressData.status === 'error') {
                            setErrorMsg(`处理过程中出错: ${progressData.error || '未知错误'}`);
                            setAppState('idle');
                            clearInterval(interval);
                        }
                    }
                } catch (error) {
                    console.error('进度查询失败:', error);
                }
            }, 2000); // 每2秒查询一次进度
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [appState, currentFileId]);

    const resetApp = () => {
        setAppState('idle');
        setMinutesData(null);
        setErrorMsg('');
        setProcessingStatus({ status: '', progress: 0 });
        setCurrentFileId('');
    };

    // 获取进度状态描述
    const getStatusDescription = (status) => {
        const statusMap = {
            'uploading': '文件上传中...',
            'splitting': '音频文件切割中...',
            'transcribing': '语音转录中...',
            'generating_summary': '生成会议纪要中...',
            'completed': '处理完成',
            'error': '处理出错'
        };
        return statusMap[status] || '处理中...';
    };

    // 获取进度图标
    const getStatusIcon = (status) => {
        switch (status) {
            case 'uploading':
            case 'splitting':
            case 'transcribing':
            case 'generating_summary':
                return <Loader2 size={24} color="#818cf8" style={{animation: 'spin 2s linear infinite'}} />;
            case 'completed':
                return <CheckCircle size={24} color="#4ade80" />;
            case 'error':
                return <div style={{color: '#ef4444', fontSize: '24px'}}>⚠️</div>;
            default:
                return <Loader2 size={24} color="#818cf8" style={{animation: 'spin 2s linear infinite'}} />;
        }
    };

    // 渲染单个语言版本的纪要列
    const renderMinutesColumn = (data, langTitle) => {
        if (!data) return null;
        return (
            <div className="minutes-column">
                <h2 style={{marginTop: 0, marginBottom: '30px', borderBottom: '2px solid #818cf8', paddingBottom: '10px', display: 'inline-block'}}>
                    {langTitle}
                </h2>

                <div className="minute-section">
                    <div className="minute-label">1. Meeting Title / Date</div>
                    <div className="minute-content" style={{fontWeight: 'bold', fontSize: '1.2em'}}>
                        {data.title || "Not specified"}
                    </div>
                    <div className="minute-content" style={{color: '#94a3b8'}}>
                        {data.date}
                    </div>
                </div>

                <div className="minute-section">
                    <div className="minute-label">2. Summary</div>
                    <div className="minute-content">{data.summary}</div>
                </div>

                <div className="minute-section">
                    <div className="minute-label">3. Key Discussion Points</div>
                    <ul className="bullet-list">
                        {data.key_discussion_points?.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>

                <div className="minute-section">
                    <div className="minute-label">4. Decisions Made</div>
                    <ul className="bullet-list">
                        {data.decisions_made?.length > 0 ? data.decisions_made.map((d, i) => (
                            <li key={i}>{d}</li>
                        )) : <li style={{color:'#64748b', listStyle:'none'}}>None</li>}
                    </ul>
                </div>

                <div className="minute-section">
                    <div className="minute-label">5. Action Items</div>
                    {data.action_items?.length > 0 ? data.action_items.map((item, i) => (
                        <div key={i} className="action-card">
                            <div className="action-card-header">
                                <span>{item.assignee || 'Unassigned'}</span>
                                <span>{item.deadline || 'No Date'}</span>
                            </div>
                            <div style={{fontWeight: '500'}}>{item.task}</div>
                        </div>
                    )) : <div style={{color:'#64748b'}}>No action items</div>}
                </div>

                <div className="minute-section">
                    <div className="minute-label">6. Risks / Issues</div>
                    <ul className="bullet-list">
                        {data.risks_issues?.length > 0 ? data.risks_issues.map((r, i) => (
                            <li key={i}>{r}</li>
                        )) : <li style={{color:'#64748b', listStyle:'none'}}>None</li>}
                    </ul>
                </div>

                <div className="minute-section">
                    <div className="minute-label">7. Next Steps</div>
                    <ul className="bullet-list">
                        {data.next_steps?.length > 0 ? data.next_steps.map((n, i) => (
                            <li key={i}>{n}</li>
                        )) : <li style={{color:'#64748b', listStyle:'none'}}>None</li>}
                    </ul>
                </div>
            </div>
        );
    };

    return (
        <div className="app-container">
            <header className="header">
                <div className="logo">
                    <Cpu size={24} color="#a855f7" style={{marginRight: '10px'}}/>
                    <span>EchoFlow Pro</span>
                </div>
                <div className="partner-logo">
                    <img src={tencentCloudLogo} alt="Tencent Cloud" style={{height: '24px', opacity: 0.8}} />
                </div>
                <div><Settings size={20} color="#94a3b8" /></div>
            </header>

            <main>
                {appState === 'idle' && (
                    <div className="hero-section">
                        <h1>智能会议纪要生成</h1>
                        <p style={{ color: '#94a3b8', marginBottom: '40px', fontSize: '1.1rem' }}>
                            企业级 AI 引擎 · 自动分片处理大文件 · 8点结构化输出
                        </p>
                        {errorMsg && <p style={{color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px'}}>{errorMsg}</p>}

                        <div className="upload-card">
                            <input type="file" accept="audio/*" onChange={handleFileUpload} className="file-input" />
                            <div className="upload-icon-wrapper" style={{background: 'rgba(99, 102, 241, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'}}>
                                <Upload size={40} color="#818cf8"/>
                            </div>
                            <h3 style={{marginBottom: '10px'}}>点击或拖拽上传录音</h3>
                            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>支持 MP3 / M4A / WAV</p>
                        </div>
                    </div>
                )}

                {appState === 'processing' && (
                    <div className="processing-container">
                        <div style={{textAlign: 'center', marginBottom: '30px'}}>
                            {getStatusIcon(processingStatus.status)}
                        </div>
                        <h3>{getStatusDescription(processingStatus.status)}</h3>
                        <p style={{color: '#94a3b8', marginTop: '15px'}}>
                            {processingStatus.status === 'uploading' && '文件上传中，请稍候...'}
                            {processingStatus.status === 'splitting' && '正在切割大文件为多个片段...'}
                            {processingStatus.status === 'transcribing' && '使用 Whisper 进行语音转录...'}
                            {processingStatus.status === 'generating_summary' && '使用 GPT 生成结构化会议纪要...'}
                            {processingStatus.status === 'completed' && '处理完成！'}
                            {!processingStatus.status && 'AI 正在深度分析...'}
                        </p>
                        
                        <div className="progress-bar-bg">
                            <div 
                                className="progress-bar-fill" 
                                style={{ 
                                    width: `${processingStatus.progress}%`, 
                                    transition: 'width 0.5s ease-in-out' 
                                }}
                            ></div>
                        </div>
                        
                        <div style={{textAlign: 'center', marginTop: '15px', fontSize: '0.9rem', color: '#64748b'}}>
                            进度: {processingStatus.progress}%
                        </div>
                        
                        <style>{`
                            @keyframes spin { 
                                0% { transform: rotate(0deg); } 
                                100% { transform: rotate(360deg); } 
                            }
                            .progress-bar-fill {
                                height: 100%;
                                background: linear-gradient(90deg, #6366f1, #a855f7);
                                border-radius: 10px;
                                transition: width 0.5s ease-in-out;
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
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
