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

// CORS 配置 - 支持多个来源
const allowedOrigins = [
    'http://localhost:5173',  // 开发环境
    'https://localhost',       // 生产环境（Traefik 反向代理）
    'http://localhost'         // 生产环境（HTTP）
];

app.use(cors({
    origin: function (origin, callback) {
        // 允许没有 origin 的请求（如 Postman、服务器到服务器的请求）
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS 阻止了来自 ${origin} 的请求`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,  // 允许携带凭证
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
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

// 实时转录API端点
app.post('/api/transcribe/stream', upload.single('audio'), async (req, res) => {
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // 记录请求来源
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    logger('TRANSCRIBE', `[${requestId}] 收到转录请求，来源: ${origin}`);
    
    if (!req.file) {
        logger('TRANSCRIBE', `[${requestId}] ❌ 失败：未收到音频文件`);
        return res.status(400).json({ 
            success: false,
            message: "未上传音频文件",
            requestId
        });
    }

    const audioBuffer = req.file.buffer;
    const audioSize = (req.file.size / 1024).toFixed(2); // KB
    const language = req.body.language || 'auto'; // 支持语言参数
    
    logger('TRANSCRIBE', `[${requestId}] 📥 接收音频段: ${audioSize}KB, 语言: ${language}, MIME类型: ${req.file.mimetype}`);

    try {
        // 将音频buffer写入临时文件
        const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
        const tempFilePath = path.join(uploadDir, tempFileName);
        
        logger('TRANSCRIBE', `[${requestId}] 💾 写入临时文件: ${tempFileName}`);
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        // 调用 Whisper API 进行转录
        const transcriptionParams = {
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
        };
        
        // 如果指定了语言（非自动检测），添加语言参数
        if (language && language !== 'auto') {
            transcriptionParams.language = language;
        }
        
        logger('TRANSCRIBE', `[${requestId}] 🔄 调用 Whisper API...`);
        const startTime = Date.now();
        const transcription = await openai.audio.transcriptions.create(transcriptionParams);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // 清理临时文件
        fs.unlinkSync(tempFilePath);
        logger('TRANSCRIBE', `[${requestId}] 🗑️ 已清理临时文件`);
        
        const textPreview = transcription.text.length > 50 
            ? transcription.text.substring(0, 50) + '...' 
            : transcription.text;
        logger('TRANSCRIBE', `[${requestId}] ✅ 转录完成: "${textPreview}", 耗时: ${duration}s`);
        
        res.json({
            success: true,
            text: transcription.text,
            language: language,
            duration: parseFloat(duration),
            requestId
        });
        
    } catch (error) {
        logger('ERROR', `[${requestId}] ❌ 实时转录失败: ${error.message}`);
        console.error(`[${requestId}] 详细错误信息:`, error);
        
        // 记录更详细的错误信息
        if (error.response) {
            logger('ERROR', `[${requestId}] API 响应错误: ${JSON.stringify(error.response.data)}`);
        }
        if (error.code) {
            logger('ERROR', `[${requestId}] 错误代码: ${error.code}`);
        }
        
        // 清理可能存在的临时文件
        try {
            const tempFiles = fs.readdirSync(uploadDir).filter(f => f.startsWith('temp_'));
            tempFiles.forEach(f => {
                const filePath = path.join(uploadDir, f);
                const stats = fs.statSync(filePath);
                // 删除超过5分钟的临时文件
                if (Date.now() - stats.mtimeMs > 5 * 60 * 1000) {
                    fs.unlinkSync(filePath);
                    logger('TRANSCRIBE', `[${requestId}] 🗑️ 清理过期临时文件: ${f}`);
                }
            });
        } catch (cleanupError) {
            logger('WARN', `[${requestId}] ⚠️ 清理临时文件失败: ${cleanupError.message}`);
        }
        
        res.status(500).json({
            success: false,
            message: "转录失败",
            error: error.message,
            errorCode: error.code || 'UNKNOWN_ERROR',
            requestId
        });
    }
});

// 生成会议记录API端点
app.post('/api/generate-meeting-summary', express.json(), async (req, res) => {
    const { transcript } = req.body;

    if (!transcript) {
        logger('SUMMARY', '失败：未提供转录文字');
        return res.status(400).json({
            success: false,
            message: "未提供转录文字"
        });
    }

    if (transcript.length < 100) {
        logger('SUMMARY', '失败：转录文字太短');
        return res.status(400).json({
            success: false,
            message: "转录文字太短，无法生成有效的会议记录"
        });
    }

    logger('SUMMARY', `开始生成会议记录，转录文字长度: ${transcript.length} 字符`);

    try {
        const systemPrompt = `You are a professional bilingual meeting assistant specializing in detailed meeting documentation.

Your task is to take raw transcripts and create comprehensive, structured meeting minutes in BOTH English and Chinese.

Output MUST be a valid JSON object with the following structure:
{
  "english": {
    "title": "Meeting Title",
    "date": "Date (YYYY-MM-DD)",
    "attendees": ["Name 1", "Name 2"],
    "summary": "comprehensive overview covering all major discussion topics",
    "key_discussion_points": ["Point 1 with context", "Point 2 with details"],
    "decisions_made": ["Decision 1 with rationale", "Decision 2 with implementation details"],
    "action_items": [{"task": "Specific task description", "assignee": "Name", "deadline": "Specific date"}],
    "risks_issues": ["Risk 1 with impact assessment", "Issue 1 with proposed solutions"]
  },
  "chinese": {
    "title": "会议标题",
    "date": "日期 (YYYY-MM-DD)",
    "attendees": ["姓名1", "姓名2"],
    "summary": "全面概述，涵盖所有主要讨论议题",
    "key_discussion_points": ["讨论重点1（含背景）", "讨论重点2（含细节）"],
    "decisions_made": ["决策1（含决策依据）", "决策2（含实施细节）"],
    "action_items": [{"task": "具体任务描述", "assignee": "负责人", "deadline": "具体日期"}],
    "risks_issues": ["风险1（含影响评估）", "问题1（含解决方案）"]
  }
}`;

        const userPrompt = `Please create a meeting summary from the following transcript:\n\n${transcript}`;

        const startTime = Date.now();
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-4-turbo",
            response_format: { type: "json_object" }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const summary = JSON.parse(completion.choices[0].message.content);

        logger('SUMMARY', `会议记录生成完成，耗时: ${duration}s`);

        res.json({
            success: true,
            summary: summary,
            duration: parseFloat(duration)
        });

    } catch (error) {
        logger('ERROR', `生成会议记录失败: ${error.message}`);
        console.error(error);

        res.status(500).json({
            success: false,
            message: "生成会议记录失败",
            error: error.message
        });
    }
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

// 辅助函数：获取音频文件时长（增强版，支持webm等格式）
const getAudioDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            logger('ERROR', `文件不存在: ${filePath}`);
            resolve(600); // 默认10分钟
            return;
        }

        // 获取文件大小，用于估算时长
        const fileSizeBytes = fs.statSync(filePath).size;
        const fileSizeMB = fileSizeBytes / (1024 * 1024);
        
        // 方案1: 使用 ffprobe
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                logger('WARN', `ffprobe获取时长失败: ${err.message}`);
                
                // 方案2: 使用命令行 ffprobe（对webm格式更可靠）
                const { exec } = require('child_process');
                exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, 
                    (error, stdout, stderr) => {
                        if (error || !stdout.trim()) {
                            logger('WARN', `命令行ffprobe也失败，使用文件大小估算时长`);
                            // 方案3: 根据文件大小估算（假设平均码率 128kbps）
                            const estimatedDuration = Math.ceil((fileSizeMB * 8 * 1024) / 128);
                            logger('INFO', `文件大小 ${fileSizeMB.toFixed(2)}MB，估算时长 ${Math.round(estimatedDuration/60)} 分钟`);
                            resolve(Math.max(estimatedDuration, 600)); // 至少10分钟
                        } else {
                            const duration = parseFloat(stdout.trim());
                            if (isNaN(duration) || duration <= 0) {
                                logger('WARN', `解析时长失败，使用文件大小估算`);
                                const estimatedDuration = Math.ceil((fileSizeMB * 8 * 1024) / 128);
                                resolve(Math.max(estimatedDuration, 600));
                            } else {
                                logger('INFO', `成功获取文件时长: ${Math.round(duration/60)} 分钟`);
                                resolve(duration);
                            }
                        }
                    }
                );
                return;
            }
            
            // 成功获取元数据
            const duration = metadata?.format?.duration;
            if (!duration || isNaN(duration) || duration <= 0) {
                logger('WARN', `元数据中时长无效: ${duration}，使用文件大小估算`);
                const estimatedDuration = Math.ceil((fileSizeMB * 8 * 1024) / 128);
                logger('INFO', `文件大小 ${fileSizeMB.toFixed(2)}MB，估算时长 ${Math.round(estimatedDuration/60)} 分钟`);
                resolve(Math.max(estimatedDuration, 600));
            } else {
                logger('INFO', `成功获取文件时长: ${Math.round(duration/60)} 分钟`);
                resolve(duration);
            }
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
    
    // 生成标准化文件名：YYYYMMDD_HHMMSS_原始文件名
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    // 清理原始文件名：移除特殊字符
    const cleanFileName = req.file.originalname
        .replace(/[\\/:*?"<>|]/g, '_')  // 替换文件系统不允许的字符
        .replace(/\s+/g, '_');            // 空格替换为下划线
    
    const fileId = `${timestamp}_${cleanFileName}`;
    
    logger('UPLOAD', `接收文件: ${req.file.originalname}`);
    logger('UPLOAD', `标准化文件名: ${fileId}`);
    logger('UPLOAD', `文件大小: ${fileSizeMB.toFixed(2)}MB`);

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
            let fileDuration = await getAudioDuration(localFilePath);
            
            // 安全检查：确保时长有效
            if (!fileDuration || isNaN(fileDuration) || fileDuration <= 0) {
                logger('WARN', `文件时长无效 (${fileDuration})，使用文件大小估算`);
                // 根据文件大小估算时长（假设平均码率 128kbps）
                fileDuration = Math.ceil((fileSizeMB * 8 * 1024) / 128);
                logger('INFO', `估算时长: ${Math.round(fileDuration/60)} 分钟`);
            }
            
            let segmentTime = Math.ceil(fileDuration / estimatedChunkCount);
            
            // 安全检查：确保切片时间有效
            if (!segmentTime || isNaN(segmentTime) || segmentTime <= 0) {
                logger('WARN', `切片时间无效 (${segmentTime})，使用默认值 600 秒`);
                segmentTime = 600; // 默认10分钟
            }
            
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
    
    logger('CANCEL', `收到取消请求，fileId: ${fileId}`);
    
    const status = processingStatus.get(fileId);
    
    if (!status) {
        logger('CANCEL', `文件处理状态未找到: ${fileId}`);
        return res.status(404).json({ 
            code: 404,
            message: "文件处理状态未找到",
            fileId: fileId
        });
    }
    
    // 检查是否已经完成或已取消
    if (status.status === 'completed') {
        logger('CANCEL', `文件处理已完成，无法取消: ${fileId}`);
        return res.status(400).json({
            code: 400,
            message: "文件处理已完成，无法取消",
            fileId: fileId
        });
    }
    
    if (status.status === 'cancelled') {
        logger('CANCEL', `文件处理已经被取消: ${fileId}`);
        return res.json({
            code: 200,
            message: "文件处理已经被取消",
            fileId: fileId
        });
    }
    
    // 标记为已取消
    processingStatus.set(fileId, { 
        status: 'cancelled', 
        progress: 0, 
        error: '用户取消了处理',
        cancelledAt: new Date().toISOString()
    });
    
    logger('CANCEL', `已标记为取消状态: ${fileId}`);
    
    // 强制终止正在运行的进程
    const activeProcess = activeProcesses.get(fileId);
    if (activeProcess) {
        logger('CANCEL', `发现活动进程: ${fileId}，类型: ${activeProcess.type}`);
        
        if (activeProcess.process && activeProcess.process.kill) {
            try {
                // 终止进程（FFmpeg等）
                activeProcess.process.kill('SIGTERM');
                logger('CANCEL', `已发送 SIGTERM 信号给进程: ${fileId}`);
                
                // 如果进程在2秒内没有终止，强制杀死
                setTimeout(() => {
                    if (activeProcess.process && !activeProcess.process.killed) {
                        activeProcess.process.kill('SIGKILL');
                        logger('CANCEL', `已发送 SIGKILL 信号强制终止进程: ${fileId}`);
                    }
                }, 2000);
            } catch (killError) {
                logger('CANCEL', `终止进程失败: ${fileId}, 错误: ${killError.message}`);
            }
        }
        
        // 清理进程跟踪
        activeProcesses.delete(fileId);
        logger('CANCEL', `已清理进程跟踪: ${fileId}`);
    } else {
        logger('CANCEL', `没有找到活动进程: ${fileId}`);
    }
    
    // 清理临时文件（可选，根据需要）
    try {
        const uploadDir = path.join(__dirname, 'uploads');
        const chunksDir = path.join(uploadDir, `${fileId}_chunks`);
        
        // 异步清理，不阻塞响应
        if (fs.existsSync(chunksDir)) {
            fs.rm(chunksDir, { recursive: true, force: true }, (err) => {
                if (err) {
                    logger('CANCEL', `清理临时文件失败: ${fileId}, 错误: ${err.message}`);
                } else {
                    logger('CANCEL', `已清理临时文件: ${fileId}`);
                }
            });
        }
    } catch (cleanupError) {
        logger('CANCEL', `清理文件时出错: ${fileId}, 错误: ${cleanupError.message}`);
    }
    
    logger('CANCEL', `用户成功取消了文件处理: ${fileId}`);
    
    res.json({
        code: 200,
        message: "处理已成功取消，正在终止相关进程",
        fileId: fileId,
        cancelledAt: new Date().toISOString()
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
    const { fileId, recipients } = req.body;
    
    // 验证参数
    if (!fileId || !recipients) {
        return res.status(400).json({ 
            success: false, 
            message: '缺少必需参数：fileId 或 recipients' 
        });
    }
    
    // 验证recipients是数组且不为空
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '收件人列表必须是非空数组' 
        });
    }
    
    // 验证所有邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
        return res.status(400).json({ 
            success: false, 
            message: `以下邮箱地址格式无效: ${invalidEmails.join(', ')}` 
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
        
        // 批量发送邮件
        logger('EMAIL', `📧 准备发送会议纪要 - 收件人数量: ${recipients.length}, 会议ID: ${fileId}`);
        logger('EMAIL', `收件人列表: ${recipients.join(', ')}`);
        
        const sendResults = [];
        let successCount = 0;
        let failCount = 0;
        
        // 逐个发送邮件
        for (const recipientEmail of recipients) {
            try {
                logger('EMAIL', `📤 正在发送给: ${recipientEmail}`);
                const result = await emailService.sendEmail(emailTransporter, recipientEmail, emailContent);
                
                if (result.success) {
                    logger('EMAIL', `✅ 发送成功 - 收件人: ${recipientEmail}, MessageID: ${result.messageId}`);
                    sendResults.push({ email: recipientEmail, success: true });
                    successCount++;
                } else {
                    logger('ERROR', `❌ 发送失败 - 收件人: ${recipientEmail}, 错误: ${result.error}`);
                    sendResults.push({ email: recipientEmail, success: false, error: result.error });
                    failCount++;
                }
            } catch (error) {
                logger('ERROR', `❌ 发送异常 - 收件人: ${recipientEmail}, 异常: ${error.message}`);
                sendResults.push({ email: recipientEmail, success: false, error: error.message });
                failCount++;
            }
        }
        
        // 返回发送结果
        logger('EMAIL', `📊 发送完成 - 成功: ${successCount}, 失败: ${failCount}, 总计: ${recipients.length}`);
        
        if (successCount === recipients.length) {
            // 全部成功
            res.json({ 
                success: true, 
                message: `邮件发送成功！会议纪要已发送到 ${successCount} 个邮箱`,
                results: sendResults
            });
        } else if (successCount > 0) {
            // 部分成功
            const failedEmails = sendResults.filter(r => !r.success).map(r => r.email);
            res.json({ 
                success: true, 
                message: `部分邮件发送成功：${successCount} 个成功，${failCount} 个失败。失败的邮箱: ${failedEmails.join(', ')}`,
                results: sendResults
            });
        } else {
            // 全部失败
            res.status(500).json({ 
                success: false, 
                message: '所有邮件发送失败，请检查邮箱地址或稍后重试',
                results: sendResults
            });
        }
    } catch (error) {
        logger('ERROR', `❌ 邮件发送异常 - 会议ID: ${fileId}`);
        logger('ERROR', `异常信息: ${error.message}`);
        logger('ERROR', `异常堆栈: ${error.stack}`);
        res.status(500).json({ 
            success: false,
            message: '邮件发送过程中发生异常，请稍后重试' 
        });
    }
});

// 用户反馈API端点
app.post('/api/send-feedback', async (req, res) => {
    const { name, email, message, recipients } = req.body;
    
    // 验证参数
    if (!name || !email || !message) {
        return res.status(400).json({ 
            success: false, 
            message: '请填写所有必需字段（姓名、邮箱、反馈内容）' 
        });
    }
    
    // 验证发件人邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            message: '发件人邮箱地址格式无效' 
        });
    }
    
    // 验证收件人列表
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '请至少添加一个收件人邮箱' 
        });
    }
    
    // 验证所有收件人邮箱格式
    for (const recipientEmail of recipients) {
        if (!emailRegex.test(recipientEmail)) {
            return res.status(400).json({ 
                success: false, 
                message: `收件人邮箱地址格式无效: ${recipientEmail}` 
            });
        }
    }
    
    // 验证消息长度
    if (message.length < 10) {
        return res.status(400).json({ 
            success: false, 
            message: '反馈内容至少需要10个字符' 
        });
    }
    
    if (message.length > 5000) {
        return res.status(400).json({ 
            success: false, 
            message: '反馈内容不能超过5000个字符' 
        });
    }
    
    try {
        // 检查邮件传输器是否可用
        if (!emailTransporter) {
            logger('ERROR', `❌ SMTP邮件服务未配置，无法发送反馈`);
            return res.status(500).json({ 
                success: false, 
                message: 'SMTP邮件服务未配置，请联系管理员' 
            });
        }
        
        // 生成反馈邮件内容
        const feedbackEmailContent = {
            subject: `EchoFlow 用户反馈 - ${name}`,
            html: `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>用户反馈</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #6366f1;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #6366f1;
            margin: 0;
            font-size: 24px;
        }
        .field {
            margin-bottom: 20px;
        }
        .field-label {
            font-weight: bold;
            color: #4b5563;
            margin-bottom: 8px;
            display: block;
        }
        .field-content {
            color: #1f2937;
            padding: 12px;
            background-color: #f9fafb;
            border-radius: 6px;
            border-left: 3px solid #6366f1;
        }
        .message-content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #9ca3af;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💬 EchoFlow 用户反馈</h1>
        </div>
        
        <div class="field">
            <span class="field-label">👤 用户姓名：</span>
            <div class="field-content">${name}</div>
        </div>
        
        <div class="field">
            <span class="field-label">📧 联系邮箱：</span>
            <div class="field-content">${email}</div>
        </div>
        
        <div class="field">
            <span class="field-label">💭 反馈内容：</span>
            <div class="field-content message-content">${message}</div>
        </div>
        
        <div class="footer">
            <p>此邮件由 EchoFlow 系统自动生成</p>
            <p>发送时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
        </div>
    </div>
</body>
</html>
            `,
            text: `
EchoFlow 用户反馈
==================

用户姓名：${name}
联系邮箱：${email}

反馈内容：
${message}

==================
此邮件由 EchoFlow 系统自动生成
发送时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
            `
        };
        
        // 发送反馈邮件到所有收件人
        logger('EMAIL', `📧 准备发送用户反馈 - 发件人: ${name} (${email}), 收件人: ${recipients.join(', ')}`);
        
        const sendResults = [];
        let successCount = 0;
        let failCount = 0;
        
        // 逐个发送给每个收件人
        for (const recipientEmail of recipients) {
            const result = await emailService.sendEmail(emailTransporter, recipientEmail, feedbackEmailContent);
            sendResults.push({ email: recipientEmail, ...result });
            
            if (result.success) {
                successCount++;
                logger('EMAIL', `✅ 反馈邮件发送成功 - 收件人: ${recipientEmail}, MessageID: ${result.messageId}`);
            } else {
                failCount++;
                logger('ERROR', `❌ 反馈邮件发送失败 - 收件人: ${recipientEmail}`);
                logger('ERROR', `错误详情: ${result.error} (代码: ${result.code || '无'})`);
            }
        }
        
        // 根据发送结果返回响应
        if (successCount === recipients.length) {
            // 全部成功
            res.json({ 
                success: true, 
                message: `感谢您的反馈！邮件已成功发送给 ${successCount} 位收件人。` 
            });
        } else if (successCount > 0) {
            // 部分成功
            const failedEmails = sendResults.filter(r => !r.success).map(r => r.email).join(', ');
            res.json({ 
                success: true, 
                message: `邮件已发送给 ${successCount} 位收件人，但发送给以下收件人失败：${failedEmails}` 
            });
        } else {
            // 全部失败
            const firstError = sendResults[0];
            let userMessage = '反馈发送失败，请稍后重试';
            if (firstError.code === 'EAUTH') {
                userMessage = '邮件服务器认证失败，请联系管理员';
            } else if (firstError.code === 'ECONNECTION' || firstError.code === 'ETIMEDOUT') {
                userMessage = '网络连接失败，请稍后重试';
            } else if (firstError.error) {
                userMessage = `发送失败: ${firstError.error}`;
            }
            
            res.status(500).json({ 
                success: false, 
                message: userMessage
            });
        }
    } catch (error) {
        logger('ERROR', `❌ 反馈邮件发送异常`);
        logger('ERROR', `异常信息: ${error.message}`);
        logger('ERROR', `异常堆栈: ${error.stack}`);
        res.status(500).json({ 
            success: false,
            message: '发送过程中发生异常，请稍后重试' 
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