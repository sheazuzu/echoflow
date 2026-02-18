require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');
const COS = require('cos-nodejs-sdk-v5');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const emailService = require('./emailService');

const app = express();
const PORT = 3000;

// 简单的日志工具函数
const logger = (stage, message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${stage}] ${message}`);
};

// 生成标准化文件名：YYYYMMDD_HHMMSS_会议主题.扩展名
const generateStandardFileName = (originalName, meetingTopic = '') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    // 获取文件扩展名
    const ext = path.extname(originalName);
    
    // 清理会议主题：移除特殊字符，限制长度
    let topic = meetingTopic || path.basename(originalName, ext);
    topic = topic
        .replace(/[\\/:*?"<>|]/g, '_')  // 替换文件系统不允许的字符
        .replace(/\s+/g, '_')            // 空格替换为下划线
        .substring(0, 50);                // 限制长度为50个字符
    
    return `${timestamp}_${topic}${ext}`;
};

// 配置 OpenAI
// 1. 优先读取 .env 文件中的 OPENAI_API_KEY
// 2. 如果没有，请在下方 "" 中填入 Key 用于测试，但不要包含中文！
const apiKey = process.env.OPENAI_API_KEY || "";

if (!apiKey) {
    console.error("【启动警告】未检测到 OpenAI API Key！");
    console.error("请在项目根目录下创建 .env 文件，内容为: OPENAI_API_KEY=sk-...");
    console.error("或者直接在 server.js 代码中填入 Key。");
    // 不强制退出，允许服务启动，但后续 AI 功能会失败
}

const openai = new OpenAI({
    apiKey: apiKey,
});

// 腾讯云COS配置
const cosConfig = {
    SecretId: process.env.COS_SECRET_ID || "",
    SecretKey: process.env.COS_SECRET_KEY || "",
    Region: process.env.COS_REGION || "ap-guangzhou",
    Bucket: process.env.COS_BUCKET || "",
    Endpoint: process.env.COS_ENDPOINT || ""
};

// 初始化COS客户端
const cos = new COS({
    SecretId: cosConfig.SecretId,
    SecretKey: cosConfig.SecretKey,
    Region: cosConfig.Region
});

// 检查COS配置
if (!cosConfig.SecretId || !cosConfig.SecretKey || !cosConfig.Bucket || !cosConfig.Endpoint) {
    console.warn("【COS配置警告】腾讯云COS配置不完整，将使用本地文件存储模式");
    console.warn("请在.env文件中配置以下环境变量：");
    console.warn("COS_SECRET_ID=您的SecretId");
    console.warn("COS_SECRET_KEY=您的SecretKey");
    console.warn("COS_BUCKET=您的存储桶名称");
    console.warn("COS_ENDPOINT=您的COS Endpoint");
    console.warn("COS_REGION=您的存储桶区域（可选，默认ap-guangzhou）");
}

// 初始化邮件传输器
const emailTransporter = emailService.createTransporter();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// 确保存储目录存在（用于临时处理和切片）
const uploadDir = path.join(__dirname, 'uploads');
const splitDir = path.join(__dirname, 'uploads', 'splits');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(splitDir)) fs.mkdirSync(splitDir);

// 使用内存存储，避免本地文件保存问题
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'MeetingMind Backend'
    });
});

// COS辅助函数：上传文件到COS桶
const uploadToCOS = (fileBuffer, fileName) => {
    return new Promise((resolve, reject) => {
        if (!cosConfig.SecretId || !cosConfig.SecretKey || !cosConfig.Bucket || !cosConfig.Endpoint) {
            // COS配置不完整，使用本地存储模式
            const localFilePath = path.join(uploadDir, fileName);
            fs.writeFileSync(localFilePath, fileBuffer);
            resolve(localFilePath);
            return;
        }
        
        const cosKey = `uploads/${fileName}`;
        
        cos.putObject({
            Bucket: cosConfig.Bucket,
            Region: cosConfig.Region,
            Key: cosKey,
            Body: fileBuffer,
            ContentLength: fileBuffer.length
        }, (err, data) => {
            if (err) {
                logger('COS_ERROR', `上传到COS失败: ${err.message}`);
                // 上传失败时回退到本地存储
                const localFilePath = path.join(uploadDir, fileName);
                fs.writeFileSync(localFilePath, fileBuffer);
                resolve(localFilePath);
            } else {
                logger('COS_SUCCESS', `文件已上传到COS: ${cosKey}`);
                resolve(cosKey); // 返回COS对象键
            }
        });
    });
};

// COS辅助函数：上传转录结果到COS桶
const uploadTranscriptToCOS = (transcriptText, fileName) => {
    return new Promise((resolve, reject) => {
        if (!cosConfig.SecretId || !cosConfig.SecretKey || !cosConfig.Bucket || !cosConfig.Endpoint) {
            // COS配置不完整，使用本地存储模式
            const localFilePath = path.join(uploadDir, fileName + '_transcript.txt');
            fs.writeFileSync(localFilePath, transcriptText);
            resolve(localFilePath);
            return;
        }
        
        const cosKey = `transcripts/${fileName}_transcript.txt`;
        
        cos.putObject({
            Bucket: cosConfig.Bucket,
            Region: cosConfig.Region,
            Key: cosKey,
            Body: transcriptText,
            ContentLength: transcriptText.length
        }, (err, data) => {
            if (err) {
                logger('COS_ERROR', `转录结果上传到COS失败: ${err.message}`);
                // 上传失败时回退到本地存储
                const localFilePath = path.join(uploadDir, fileName + '_transcript.txt');
                fs.writeFileSync(localFilePath, transcriptText);
                resolve(localFilePath);
            } else {
                logger('COS_SUCCESS', `转录结果已上传到COS: ${cosKey}`);
                resolve(cosKey); // 返回COS对象键
            }
        });
    });
};

// COS辅助函数：从COS下载文件到本地临时文件
const downloadFromCOS = (cosKey) => {
    return new Promise((resolve, reject) => {
        if (!cosKey.startsWith('uploads/')) {
            // 如果是本地文件路径，直接返回
            resolve(cosKey);
            return;
        }
        
        const fileName = path.basename(cosKey);
        const localFilePath = path.join(uploadDir, fileName);
        
        cos.getObject({
            Bucket: cosConfig.Bucket,
            Region: cosConfig.Region,
            Key: cosKey
        }, (err, data) => {
            if (err) {
                logger('COS_ERROR', `从COS下载失败: ${err.message}`);
                reject(err);
            } else {
                fs.writeFileSync(localFilePath, data.Body);
                logger('COS_SUCCESS', `文件已从COS下载到: ${localFilePath}`);
                resolve(localFilePath);
            }
        });
    });
};

// 辅助函数：获取音频文件时长
const getAudioDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                logger('WARN', `无法获取音频时长，使用默认值: ${err.message}`);
                resolve(600); // 默认10分钟
                return;
            }
            const duration = metadata.format.duration || 600;
            resolve(duration);
        });
    });
};

// 备选方案：使用原生FFmpeg命令行切割音频（更稳定）
const splitAudioWithFFmpegCLI = async (filePath, segmentTime = 600, fileId = null) => {
    logger('SPLIT', `使用FFmpeg CLI切割文件: ${path.basename(filePath)}，每段${Math.round(segmentTime/60)}分钟`);
    
    // 清理文件名
    const cleanBaseName = path.basename(filePath, path.extname(filePath))
        .replace(/[\\s\\W]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    
    // 根据输入文件扩展名确定输出格式
    const inputExt = path.extname(filePath).toLowerCase();
    const outputExt = inputExt === '.mp3' ? '.mp3' : '.m4a';
    const outputPattern = path.join(splitDir, `${cleanBaseName}_%03d${outputExt}`);
    
    // 检查文件
    if (!fs.existsSync(filePath)) {
        throw new Error(`输入文件不存在: ${filePath}`);
    }
    
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
    } catch (err) {
        throw new Error(`文件不可读或无权限: ${filePath}`);
    }
    
    // 使用原生FFmpeg命令行，根据格式选择适当的编码方式
    const command = `ffmpeg -i "${filePath}" -f segment -segment_time ${segmentTime} -c copy "${outputPattern}"`;
    logger('DEBUG', `FFmpeg CLI命令: ${command}`);
    
    try {
        // 记录FFmpeg进程（使用child_process以便后续终止）
        const childProcess = exec(command);
        
        // 存储进程信息以便后续终止
        const processInfo = {
            type: ProcessType.FFMPEG,
            process: childProcess,
            startTime: new Date(),
            command: command
        };
        
        // 如果提供了fileId，则关联进程以便后续终止
        if (fileId) {
            activeProcesses.set(fileId, processInfo);
        }
        
        // 等待进程完成
        await new Promise((resolve, reject) => {
            childProcess.on('close', (code) => {
                // 清理进程跟踪
                if (fileId) {
                    activeProcesses.delete(fileId);
                }
                
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg进程退出码: ${code}`));
                }
            });
            
            childProcess.on('error', (error) => {
                // 清理进程跟踪
                if (fileId) {
                    activeProcesses.delete(fileId);
                }
                reject(error);
            });
        });
        
        // 读取生成的切片文件并过滤掉太短的切片
        const files = await fs.promises.readdir(splitDir);
        const allChunks = files
            .filter(f => f.startsWith(cleanBaseName))
            .map(f => path.join(splitDir, f))
            .sort();
        
        // 过滤掉太短的切片（小于1KB）
        const validChunks = [];
        for (const chunk of allChunks) {
            try {
                const stats = await fs.promises.stat(chunk);
                if (stats.size > 1024) { // 文件大小大于1KB
                    validChunks.push(chunk);
                } else {
                    logger('WARN', `跳过太短的切片: ${path.basename(chunk)} (${stats.size} bytes)`);
                    await fs.promises.unlink(chunk); // 删除无效切片
                }
            } catch (err) {
                logger('WARN', `无法检查切片文件: ${path.basename(chunk)}`);
            }
        }
        
        logger('SPLIT', `FFmpeg CLI切割完成，生成 ${allChunks.length} 个切片，有效切片: ${validChunks.length}`);
        return validChunks;
    } catch (error) {
        logger('ERROR', `FFmpeg CLI切割失败: ${error.message}`);
        throw error;
    }
};

// 主音频切割函数，支持多种备选方案
const splitAudio = async (filePath, segmentTime = 600, fileId = null) => {
    logger('SPLIT', `开始切割文件: ${path.basename(filePath)}，每段${Math.round(segmentTime/60)}分钟`);
    
    // 检查是否被取消
    if (fileId && processingStatus.get(fileId)?.status === 'cancelled') {
        logger('CANCEL', `音频切割进程被取消，跳过文件: ${path.basename(filePath)}`);
        throw new Error('用户取消了处理');
    }
    
    // 方案1：首先尝试使用FFmpeg CLI（最稳定）
    try {
        return await splitAudioWithFFmpegCLI(filePath, segmentTime, fileId);
    } catch (error) {
        logger('WARN', `FFmpeg CLI方案失败，尝试fluent-ffmpeg方案: ${error.message}`);
    }
    
    // 方案2：回退到fluent-ffmpeg
    return new Promise((resolve, reject) => {
        const cleanBaseName = path.basename(filePath, path.extname(filePath))
            .replace(/[\\s\\W]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
            
        // 根据输入文件扩展名确定输出格式
        const inputExt = path.extname(filePath).toLowerCase();
        const outputExt = inputExt === '.mp3' ? '.mp3' : '.m4a';
        const outputPattern = path.join(splitDir, `${cleanBaseName}_%03d${outputExt}`);
        
        if (!fs.existsSync(filePath)) {
            reject(new Error(`输入文件不存在: ${filePath}`));
            return;
        }
        
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
        } catch (err) {
            reject(new Error(`文件不可读或无权限: ${filePath}`));
            return;
        }
        
        logger('DEBUG', `使用fluent-ffmpeg处理文件: ${filePath} -> ${outputPattern}`);
        
        const ffmpegProcess = ffmpeg(filePath)
            .outputOptions([
                '-f segment',
                `-segment_time ${segmentTime}`,
                '-c copy'
            ])
            .output(outputPattern)
            .on('start', (commandLine) => {
                logger('DEBUG', `fluent-ffmpeg命令: ${commandLine}`);
                
                // 记录进程信息
                if (fileId) {
                    activeProcesses.set(fileId, {
                        type: ProcessType.FFMPEG,
                        process: ffmpegProcess,
                        startTime: new Date(),
                        command: commandLine
                    });
                }
            })
            .on('end', () => {
                // 清理进程跟踪
                if (fileId) {
                    activeProcesses.delete(fileId);
                }
                
                fs.readdir(splitDir, (err, files) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const allChunks = files
                        .filter(f => f.startsWith(cleanBaseName))
                        .map(f => path.join(splitDir, f))
                        .sort();
                    
                    // 过滤掉太短的切片（小于1KB）
                    const validChunks = [];
                    for (const chunk of allChunks) {
                        try {
                            const stats = fs.statSync(chunk);
                            if (stats.size > 1024) { // 文件大小大于1KB
                                validChunks.push(chunk);
                            } else {
                                logger('WARN', `跳过太短的切片: ${path.basename(chunk)} (${stats.size} bytes)`);
                                fs.unlinkSync(chunk); // 删除无效切片
                            }
                        } catch (err) {
                            logger('WARN', `无法检查切片文件: ${path.basename(chunk)}`);
                        }
                    }
                    
                    logger('SPLIT', `fluent-ffmpeg切割完成，生成 ${allChunks.length} 个切片，有效切片: ${validChunks.length}`);
                    resolve(validChunks);
                });
            })
            .on('error', (err) => {
                // 清理进程跟踪
                if (fileId) {
                    activeProcesses.delete(fileId);
                }
                
                logger('ERROR', `fluent-ffmpeg切割失败: ${err.message}`);
                reject(err);
            })
            .run();
            
        // 添加取消检查
        if (fileId) {
            const checkCancelInterval = setInterval(() => {
                if (processingStatus.get(fileId)?.status === 'cancelled') {
                    clearInterval(checkCancelInterval);
                    logger('CANCEL', `检测到取消请求，终止fluent-ffmpeg进程: ${fileId}`);
                    
                    // 尝试终止ffmpeg进程
                    try {
                        ffmpegProcess.kill();
                        logger('CANCEL', `已发送终止信号给fluent-ffmpeg进程: ${fileId}`);
                    } catch (err) {
                        logger('WARN', `终止fluent-ffmpeg进程失败: ${err.message}`);
                    }
                    
                    reject(new Error('用户取消了处理'));
                }
            }, 1000); // 每秒检查一次
            
            // 清理定时器
            ffmpegProcess.on('end', () => clearInterval(checkCancelInterval));
            ffmpegProcess.on('error', () => clearInterval(checkCancelInterval));
        }
    });
};

// 辅助函数：调用 Whisper 转录
const transcribeChunk = async (filePath, fileId = null) => {
    const fileName = path.basename(filePath);
    logger('WHISPER', `正在转录片段: ${fileName}...`);
    
    // 首先检查文件是否存在
    if (!fs.existsSync(filePath)) {
        const errorMsg = `转录文件不存在: ${filePath}`;
        logger('ERROR', errorMsg);
        throw new Error(errorMsg);
    }
    
    const startTime = Date.now();

    // 检查是否被取消（如果提供了fileId）
    if (fileId && processingStatus.get(fileId)?.status === 'cancelled') {
        logger('CANCEL', `转录进程被取消，跳过片段: ${fileName}`);
        throw new Error('用户取消了处理');
    }

    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger('WHISPER', `片段 ${fileName} 转录完成，耗时 ${duration}s`);
    return transcription.text;
};

// 处理进度状态存储（简单内存存储，生产环境建议使用Redis）
const processingStatus = new Map();

// 进程跟踪器：存储正在运行的FFmpeg和OpenAI进程
const activeProcesses = new Map();

// 进程类型枚举
const ProcessType = {
    FFMPEG: 'ffmpeg',
    OPENAI: 'openai',
    SPLIT: 'split',
    TRANSCRIBE: 'transcribe',
    SUMMARY: 'summary'
};

// 上传与处理接口
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        logger('UPLOAD', '失败：未收到文件');
        return res.status(400).json({ message: "未上传文件" });
    }

    const fileBuffer = req.file.buffer;
    const fileSizeMB = req.file.size / (1024 * 1024);
    const meetingTopic = req.body.meetingTopic || ''; // 获取会议主题（可选）
    
    // 生成标准化文件名：YYYYMMDD_HHMMSS_会议主题.扩展名
    const fileId = generateStandardFileName(req.file.originalname, meetingTopic);
    
    logger('UPLOAD', `接收文件: ${req.file.originalname}`);
    logger('UPLOAD', `标准化文件名: ${fileId}`);
    logger('UPLOAD', `文件大小: ${fileSizeMB.toFixed(2)}MB`);
    if (meetingTopic) {
        logger('UPLOAD', `会议主题: ${meetingTopic}`);
    }

    // 立即返回响应，让前端可以开始轮询进度
    res.json({
        code: 200,
        message: "文件接收成功，开始处理",
        fileId: fileId
    });

    // 初始化处理状态
    processingStatus.set(fileId, { status: 'uploading_to_cos', progress: 5 });

    try {
        // 1. 上传文件到COS
        logger('COS_UPLOAD', `开始上传文件到COS: ${fileId}`);
        processingStatus.set(fileId, { status: 'uploading_to_cos', progress: 10 });
        
        const cosKey = await uploadToCOS(fileBuffer, fileId);
        processingStatus.set(fileId, { status: 'uploaded_to_cos', progress: 30 });
        
        // 2. 开始处理文件
        logger('PROCESS', `文件上传完成，开始处理: ${cosKey}`);
        await processFile(fileId, cosKey, fileSizeMB);
        
    } catch (error) {
        logger('ERROR', `文件处理流程异常: ${error.message}`);
        processingStatus.set(fileId, { status: 'error', progress: 0, error: error.message });
        console.error(error);
    }
});

// 异步文件处理函数
async function processFile(fileId, cosKey, fileSizeMB) {
    let localFilePath = null;
    let transcriptCosKey = null; // 存储转录结果的COS键
    
    try {
        // 1. 从COS下载文件到本地临时文件
        logger('COS_DOWNLOAD', `开始从COS下载文件: ${cosKey}`);
        processingStatus.set(fileId, { status: 'downloading_from_cos', progress: 40 });
        
        localFilePath = await downloadFromCOS(cosKey);
        processingStatus.set(fileId, { status: 'downloaded_from_cos', progress: 50 });
        
        // 检查文件是否存在
        if (!fs.existsSync(localFilePath)) {
            const errorMsg = `处理文件不存在: ${localFilePath}. 请检查文件是否成功下载。`;
            logger('ERROR', errorMsg);
            processingStatus.set(fileId, { status: 'error', progress: 0, error: errorMsg });
            throw new Error(errorMsg);
        }
        
        let fullTranscript = "";

        // 1. 检查大小与处理音频
        if (fileSizeMB > 25) {
            processingStatus.set(fileId, { status: 'splitting', progress: 60 });
            logger('PROCESS', `文件超过 25MB (${fileSizeMB.toFixed(2)}MB)，启动自动切片流程`);
            
            // 动态计算切片时间：目标每个切片接近25MB但不超过
            const targetChunkSizeMB = 24; // 目标切片大小，留1MB缓冲
            const estimatedChunkCount = Math.ceil(fileSizeMB / targetChunkSizeMB);
            const fileDuration = await getAudioDuration(localFilePath);
            const segmentTime = Math.ceil(fileDuration / estimatedChunkCount);
            
            logger('PROCESS', `文件时长约${Math.round(fileDuration/60)}分钟，预计切成${estimatedChunkCount}个切片，每段${Math.round(segmentTime/60)}分钟`);
            
            // 记录切片进程
            activeProcesses.set(fileId, { type: ProcessType.SPLIT, startTime: new Date() });
            
            const chunks = await splitAudio(localFilePath, segmentTime, fileId);

            processingStatus.set(fileId, { status: 'transcribing', progress: 70, currentChunk: 0, totalChunks: chunks.length });
            logger('PROCESS', `开始并行处理 ${chunks.length} 个切片...`);
            
            // 记录转录进程
            activeProcesses.set(fileId, { type: ProcessType.TRANSCRIBE, startTime: new Date(), totalChunks: chunks.length });
            
            for (const [index, chunkPath] of chunks.entries()) {
                const progress = 70 + Math.floor((index / chunks.length) * 20);
                processingStatus.set(fileId, { status: 'transcribing', progress, currentChunk: index + 1, totalChunks: chunks.length });
                logger('PROCESS', `处理进度: ${index + 1}/${chunks.length}`);
                
                // 检查是否被取消
                if (processingStatus.get(fileId)?.status === 'cancelled') {
                    logger('CANCEL', `转录进程被取消，终止处理切片 ${index + 1}/${chunks.length}`);
                    fs.unlinkSync(chunkPath);
                    break;
                }
                
                const text = await transcribeChunk(chunkPath, fileId);
                fullTranscript += text + " ";
                fs.unlinkSync(chunkPath);
            }
        } else {
            processingStatus.set(fileId, { status: 'transcribing', progress: 70 });
            logger('PROCESS', `文件小于 25MB，直接转录`);
            
            // 记录转录进程
            activeProcesses.set(fileId, { type: ProcessType.TRANSCRIBE, startTime: new Date(), totalChunks: 1 });
            
            // 检查是否被取消
            if (processingStatus.get(fileId)?.status === 'cancelled') {
                logger('CANCEL', `转录进程被取消，跳过小文件转录`);
                throw new Error('用户取消了处理');
            }
            
            fullTranscript = await transcribeChunk(localFilePath, fileId);
        }

        processingStatus.set(fileId, { status: 'generating_summary', progress: 80 });
        logger('LLM', `转录完成，正在生成 8 点结构化会议纪要...`);

        // 检查是否被取消
        if (processingStatus.get(fileId)?.status === 'cancelled') {
            logger('CANCEL', `总结生成进程被取消，跳过LLM调用`);
            throw new Error('用户取消了处理');
        }

        // 记录总结生成进程
        activeProcesses.set(fileId, { type: ProcessType.SUMMARY, startTime: new Date() });

        // 2. 调用 LLM 生成总结 (Enhanced Prompt for Detailed Minutes)
        const systemPrompt = `You are a professional bilingual meeting assistant specializing in detailed meeting documentation.

Your task is to take raw transcripts and create comprehensive, structured meeting minutes in BOTH English and Chinese.
For long meetings (1.5+ hours), provide detailed analysis with:
- Comprehensive summary (8-12 sentences covering all major topics)
- Detailed discussion points (5-10 key points with context)
- Specific decisions made (include rationale when available)
- Action items with clear assignments and deadlines


Be thorough but organized, remove irrelevant small talk or fillers.
Identify speakers whenever possible and list them in the "attendees" field.
Extract the date from context or mark as "Not specified".

Output MUST be a valid JSON object with the following structure:
{
"english": {
"title": "Meeting Title",
"date": "Date (YYYY-MM-DD)",
"attendees": ["Name 1", "Name 2"],
"summary": "comprehensive overview covering all major discussion topics",
"key_discussion_points": ["Point 1 with context", "Point 2 with details", "Point X with specific examples"],
"action_items": [{"task": "Specific task description", "assignee": "Name", "deadline": "Specific date"}],
"risks_issues": ["Risk 1 with impact assessment", "Issue 1 with proposed solutions"]
},
"chinese": {
"title": "会议标题",
"date": "日期 (YYYY-MM-DD)",
"attendees": ["姓名1", "姓名2"],
"summary": "全面概述，涵盖所有主要讨论议题",
"key_discussion_points": ["讨论重点1（含背景）", "讨论重点2（含细节）", "讨论重点N（含具体示例）"],
"decisions_made": ["决策1（含决策依据）", "决策2（含实施细节）"],
"action_items": [{"task": "具体任务描述", "assignee": "负责人", "deadline": "具体日期"}]

}
}`;

        const userPrompt = `Here is the transcript of a ${Math.round(fileSizeMB/2.5)}-minute meeting (${fileSizeMB.toFixed(1)}MB audio file).

Please create meeting summary.

\n\nTranscript:\n${fullTranscript}`;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-4-turbo",
            response_format: { type: "json_object" }
        });

        const aiResult = JSON.parse(completion.choices[0].message.content);
        
        // 3. 将转录结果上传到COS桶
        logger('COS_UPLOAD', `开始上传转录结果到COS桶`);
        transcriptCosKey = await uploadTranscriptToCOS(fullTranscript, fileId);
        logger('COS_SUCCESS', `转录结果已存储到COS: ${transcriptCosKey}`);
        
        processingStatus.set(fileId, { 
            status: 'completed', 
            progress: 100, 
            minutesData: aiResult,
            transcript: fullTranscript,
            transcriptCosKey: transcriptCosKey // 存储转录结果的COS键
        });
        
        // 输出会议纪要简介到日志
        const chineseSummary = aiResult.chinese?.summary || "无摘要";
        const englishSummary = aiResult.english?.summary || "No summary";
        logger('SUMMARY', `中文纪要摘要: ${chineseSummary.substring(0, 100)}...`);
        logger('SUMMARY', `English Summary: ${englishSummary.substring(0, 100)}...`);
        
        logger('LLM', `GPT 总结生成完毕`);

        // 清理文件：只清理本地临时文件，保留COS中的转录结果
        try {
            // 清理本地临时文件
            if (localFilePath && fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                logger('CLEANUP', `本地临时文件已清理: ${localFilePath}`);
            }
            
            // 清理COS中的音频文件（不保留音频文件）
            if (cosKey.startsWith('uploads/')) {
                cos.deleteObject({
                    Bucket: cosConfig.Bucket,
                    Region: cosConfig.Region,
                    Key: cosKey
                }, (err, data) => {
                    if (err) {
                        logger('COS_CLEANUP_ERROR', `删除COS音频文件失败: ${err.message}`);
                    } else {
                        logger('COS_CLEANUP_SUCCESS', `COS音频文件已删除: ${cosKey}`);
                    }
                });
            }
            
            logger('CLEANUP', `文件处理流程完成，本地临时文件已清理，转录结果已存储在COS: ${transcriptCosKey}`);
            
        } catch (cleanupError) {
            logger('ERROR', `清理文件失败: ${cleanupError.message}`);
        }

    } catch (error) {
        processingStatus.set(fileId, { status: 'error', progress: 0, error: error.message });
        logger('ERROR', `处理流程异常: ${error.message}`);
        console.error(error);
        
        // 异常情况下清理文件
        try {
            if (localFilePath && fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                logger('CLEANUP', `异常清理本地临时文件: ${localFilePath}`);
            }
        } catch (cleanupError) {
            logger('ERROR', `异常清理文件失败: ${cleanupError.message}`);
        }
    }
}

// 进度查询接口
app.get('/api/progress/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const status = processingStatus.get(fileId);
    
    if (!status) {
        return res.status(404).json({ message: "文件处理状态未找到" });
    }
    
    res.json({
        fileId,
        status: status.status,
        progress: status.progress,
        error: status.error,
        currentChunk: status.currentChunk,
        totalChunks: status.totalChunks
    });
});

// 取消处理接口
app.post('/api/cancel/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const status = processingStatus.get(fileId);
    
    if (!status) {
        return res.status(404).json({ message: "文件处理状态未找到" });
    }
    
    // 标记为已取消
    processingStatus.set(fileId, { 
        status: 'cancelled', 
        progress: 0, 
        error: '用户取消了处理'
    });
    
    // 强制终止正在运行的进程
    const activeProcess = activeProcesses.get(fileId);
    if (activeProcess) {
        logger('CANCEL', `强制终止进程: ${fileId}，类型: ${activeProcess.type}`);
        
        if (activeProcess.process && activeProcess.process.kill) {
            // 终止FFmpeg进程
            activeProcess.process.kill('SIGTERM');
            logger('CANCEL', `已发送终止信号给进程: ${fileId}`);
        }
        
        // 清理进程跟踪
        activeProcesses.delete(fileId);
    }
    
    logger('CANCEL', `用户取消了文件处理: ${fileId}`);
    
    res.json({
        code: 200,
        message: "处理已成功取消，正在终止相关进程",
        fileId: fileId
    });
});

// 获取会议纪要数据接口
app.get('/api/minutes/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const status = processingStatus.get(fileId);
    
    if (!status) {
        return res.status(404).json({ message: "文件处理状态未找到" });
    }
    
    if (status.status !== 'completed') {
        return res.status(400).json({ message: "文件处理尚未完成" });
    }
    
    if (!status.minutesData) {
        return res.status(404).json({ message: "会议纪要数据未找到" });
    }
    
    res.json({
        fileId,
        status: status.status,
        minutesData: status.minutesData,
        transcript: status.transcript
    });
});

// 获取转录结果接口
app.get('/api/transcript/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const status = processingStatus.get(fileId);
    
    if (!status) {
        return res.status(404).json({ message: "文件处理状态未找到" });
    }
    
    if (status.status !== 'completed') {
        return res.status(400).json({ message: "文件处理尚未完成" });
    }
    
    if (!status.transcriptCosKey) {
        return res.status(404).json({ message: "转录结果未找到" });
    }
    
    try {
        // 如果转录结果存储在COS中，从COS下载
        if (status.transcriptCosKey.startsWith('transcripts/')) {
            const localFilePath = await downloadFromCOS(status.transcriptCosKey);
            const transcriptText = fs.readFileSync(localFilePath, 'utf8');
            
            // 清理本地临时文件
            fs.unlinkSync(localFilePath);
            
            res.json({
                fileId,
                transcript: transcriptText,
                transcriptCosKey: status.transcriptCosKey,
                storage: 'cos'
            });
        } else {
            // 如果转录结果存储在本地
            res.json({
                fileId,
                transcript: status.transcript,
                transcriptPath: status.transcriptCosKey,
                storage: 'local'
            });
        }
    } catch (error) {
        logger('ERROR', `获取转录结果失败: ${error.message}`);
        res.status(500).json({ message: "获取转录结果失败", error: error.message });
    }
});

// 邮件发送API端点
app.post('/api/send-email', async (req, res) => {
    const { fileId, recipientEmail } = req.body;
    
    // 验证参数
    if (!fileId || !recipientEmail) {
        return res.status(400).json({ 
            success: false, 
            message: '缺少必需参数：fileId 或 recipientEmail' 
        });
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ 
            success: false, 
            message: '邮箱地址格式无效' 
        });
    }
    
    // 从processingStatus中获取会议纪要数据
    const status = processingStatus.get(fileId);
    
    if (!status) {
        return res.status(404).json({ 
            success: false, 
            message: '文件处理状态未找到' 
        });
    }
    
    if (status.status !== 'completed') {
        return res.status(400).json({ 
            success: false, 
            message: '文件处理尚未完成，无法发送邮件' 
        });
    }
    
    const minutesData = status.minutesData;
    
    if (!minutesData) {
        return res.status(404).json({ 
            success: false, 
            message: '会议纪要数据未找到' 
        });
    }
    
    try {
        // 检查邮件传输器是否可用
        if (!emailTransporter) {
            const maskedUser = process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : '未设置';
            logger('ERROR', `❌ SMTP邮件服务未配置`);
            logger('ERROR', `配置检查: HOST=${process.env.SMTP_HOST || '未设置'}, PORT=${process.env.SMTP_PORT || 587}, USER=${maskedUser}, PASS=${process.env.SMTP_PASS ? '已设置' : '未设置'}`);
            return res.status(500).json({ 
                success: false, 
                message: 'SMTP邮件服务未配置，请联系管理员配置邮件服务器' 
            });
        }
        
        // 生成邮件内容
        const emailContent = emailService.generateEmailContent(minutesData);
        
        // 发送邮件
        logger('EMAIL', `📧 准备发送会议纪要 - 收件人: ${recipientEmail}, 会议ID: ${fileId}`);
        const result = await emailService.sendEmail(emailTransporter, recipientEmail, emailContent);
        
        if (result.success) {
            logger('EMAIL', `✅ 邮件发送成功 - 收件人: ${recipientEmail}, MessageID: ${result.messageId}`);
            res.json({ 
                success: true, 
                message: '邮件发送成功！会议纪要已发送到指定邮箱' 
            });
        } else {
            logger('ERROR', `❌ 邮件发送失败 - 收件人: ${recipientEmail}`);
            logger('ERROR', `错误详情: ${result.error} (代码: ${result.code || '无'})`);
            
            // 根据错误类型提供更友好的提示
            let userMessage = '邮件发送失败';
            if (result.code === 'EAUTH') {
                userMessage = '邮件服务器认证失败，请检查SMTP用户名和密码配置';
            } else if (result.code === 'ECONNECTION' || result.code === 'ETIMEDOUT') {
                userMessage = '无法连接到邮件服务器，请检查网络和SMTP服务器配置';
            } else if (result.error) {
                userMessage = `邮件发送失败: ${result.error}`;
            }
            
            res.status(500).json({ 
                success: false, 
                message: userMessage
            });
        }
    } catch (error) {
        logger('ERROR', `❌ 邮件发送异常 - 收件人: ${recipientEmail}, 会议ID: ${fileId}`);
        logger('ERROR', `异常信息: ${error.message}`);
        logger('ERROR', `异常堆栈: ${error.stack}`);
        res.status(500).json({ 
            success: false,
            message: '邮件发送过程中发生异常，请稍后重试' 
        });
    }
});

// SMTP连接测试API端点
app.get('/api/test-smtp', async (req, res) => {
    try {
        const result = await emailService.testSMTPConnection(emailTransporter);
        
        if (result.success) {
            console.log('✅ SMTP连接测试成功 - 服务器:', result.details.server);
            res.json({
                success: true,
                message: result.message,
                details: result.details
            });
        } else {
            console.error('❌ SMTP连接测试失败:', result.message);
            console.error('SMTP配置检查:');
            if (result.details) {
                console.error('- 服务器:', result.details.server || process.env.SMTP_HOST || '未设置');
                console.error('- 端口:', result.details.port || process.env.SMTP_PORT || 587);
                console.error('- 用户:', result.details.user || '未设置');
                console.error('- 密码配置:', process.env.SMTP_PASS ? '已设置(长度:' + process.env.SMTP_PASS.length + ')' : '未设置');
                if (result.details.error) {
                    console.error('- 完整错误:', result.details.error);
                }
                if (result.details.response) {
                    console.error('- SMTP响应:', result.details.response);
                }
            }
            
            const maskedUser = process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : '未设置';
            res.status(500).json({
                success: false,
                message: result.message,
                details: result.details || {
                    server: process.env.SMTP_HOST || '未设置',
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    user: maskedUser,
                    configured: false
                }
            });
        }
    } catch (error) {
        console.error('❌ SMTP测试异常:', error.message);
        res.status(500).json({
            success: false,
            message: 'SMTP测试异常: ' + error.message,
            details: {
                error: error.message
            }
        });
    }
});

// 清理过期的处理状态（简单实现，生产环境需要更完善的清理机制）
setInterval(() => {
    const now = Date.now();
    for (const [fileId, status] of processingStatus.entries()) {
        // 假设文件名包含时间戳，超过30分钟清理
        const fileTime = parseInt(fileId.split('-')[0]);
        if (now - fileTime > 30 * 60 * 1000) {
            processingStatus.delete(fileId);
        }
    }
}, 5 * 60 * 1000); // 每5分钟清理一次

app.listen(PORT, async () => {
    logger('SYSTEM', `EchoFlow 后端服务已启动: http://localhost:${PORT}`);
    
    // 测试SMTP服务器连通性
    logger('SYSTEM', '正在测试SMTP服务器连通性...');
    const smtpTestResult = await emailService.testSMTPConnection(emailTransporter);
    
    if (smtpTestResult.success) {
        logger('SYSTEM', `✓ ${smtpTestResult.message}`);
    } else {
        logger('ERROR', `✗ ${smtpTestResult.message}`);
        logger('ERROR', '邮件发送功能将不可用，请检查.env文件中的SMTP配置');
    }
});