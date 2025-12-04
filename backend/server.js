require('dotenv').config();
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
    console.error("请在 backend 目录下创建 .env 文件，内容为: OPENAI_API_KEY=sk-...");
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
const splitAudioWithFFmpegCLI = async (filePath, segmentTime = 600) => {
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
        await execAsync(command);
        
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
const splitAudio = async (filePath, segmentTime = 600) => {
    logger('SPLIT', `开始切割文件: ${path.basename(filePath)}，每段${Math.round(segmentTime/60)}分钟`);
    
    // 方案1：首先尝试使用FFmpeg CLI（最稳定）
    try {
        return await splitAudioWithFFmpegCLI(filePath, segmentTime);
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
        
        ffmpeg(filePath)
            .outputOptions([
                '-f segment',
                `-segment_time ${segmentTime}`,
                '-c copy'
            ])
            .output(outputPattern)
            .on('start', (commandLine) => {
                logger('DEBUG', `fluent-ffmpeg命令: ${commandLine}`);
            })
            .on('end', () => {
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
                logger('ERROR', `fluent-ffmpeg切割失败: ${err.message}`);
                reject(err);
            })
            .run();
    });
};

// 辅助函数：调用 Whisper 转录
const transcribeChunk = async (filePath) => {
    const fileName = path.basename(filePath);
    logger('WHISPER', `正在转录片段: ${fileName}...`);
    
    // 首先检查文件是否存在
    if (!fs.existsSync(filePath)) {
        const errorMsg = `转录文件不存在: ${filePath}`;
        logger('ERROR', errorMsg);
        throw new Error(errorMsg);
    }
    
    const startTime = Date.now();

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

// 上传与处理接口
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        logger('UPLOAD', '失败：未收到文件');
        return res.status(400).json({ message: "未上传文件" });
    }

    const fileBuffer = req.file.buffer;
    const fileSizeMB = req.file.size / (1024 * 1024);
    const fileId = Date.now() + '-' + req.file.originalname;
    logger('UPLOAD', `接收文件: ${fileId}, 大小: ${fileSizeMB.toFixed(2)}MB`);

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
            
            const chunks = await splitAudio(localFilePath, segmentTime);

            processingStatus.set(fileId, { status: 'transcribing', progress: 70, currentChunk: 0, totalChunks: chunks.length });
            logger('PROCESS', `开始并行处理 ${chunks.length} 个切片...`);
            for (const [index, chunkPath] of chunks.entries()) {
                const progress = 70 + Math.floor((index / chunks.length) * 20);
                processingStatus.set(fileId, { status: 'transcribing', progress, currentChunk: index + 1, totalChunks: chunks.length });
                logger('PROCESS', `处理进度: ${index + 1}/${chunks.length}`);
                const text = await transcribeChunk(chunkPath);
                fullTranscript += text + " ";
                fs.unlinkSync(chunkPath);
            }
        } else {
            processingStatus.set(fileId, { status: 'transcribing', progress: 70 });
            logger('PROCESS', `文件小于 25MB，直接转录`);
            fullTranscript = await transcribeChunk(localFilePath);
        }

        processingStatus.set(fileId, { status: 'generating_summary', progress: 80 });
        logger('LLM', `转录完成，正在生成 8 点结构化会议纪要...`);

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
        processingStatus.set(fileId, { 
            status: 'completed', 
            progress: 100, 
            minutesData: aiResult,
            transcript: fullTranscript 
        });
        
        // 输出会议纪要简介到日志
        const chineseSummary = aiResult.chinese?.summary || "无摘要";
        const englishSummary = aiResult.english?.summary || "No summary";
        logger('SUMMARY', `中文纪要摘要: ${chineseSummary.substring(0, 100)}...`);
        logger('SUMMARY', `English Summary: ${englishSummary.substring(0, 100)}...`);
        
        logger('LLM', `GPT 总结生成完毕`);

        // 清理文件：删除本地临时文件和COS文件
        try {
            // 清理本地临时文件
            if (localFilePath && fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                logger('CLEANUP', `本地临时文件已清理: ${localFilePath}`);
            }
            
            // 清理COS文件（如果使用了COS）
            if (cosKey.startsWith('uploads/')) {
                cos.deleteObject({
                    Bucket: cosConfig.Bucket,
                    Region: cosConfig.Region,
                    Key: cosKey
                }, (err, data) => {
                    if (err) {
                        logger('COS_CLEANUP_ERROR', `删除COS文件失败: ${err.message}`);
                    } else {
                        logger('COS_CLEANUP_SUCCESS', `COS文件已删除: ${cosKey}`);
                    }
                });
            }
            
            logger('CLEANUP', `文件处理流程完成，所有临时文件已清理`);
            
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
    
    logger('CANCEL', `用户取消了文件处理: ${fileId}`);
    
    res.json({
        code: 200,
        message: "处理已成功取消",
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

app.listen(PORT, () => {
    logger('SYSTEM', `EchoFlow 后端服务已启动: http://localhost:${PORT}`);
});
