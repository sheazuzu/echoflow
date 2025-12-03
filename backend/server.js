require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');

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

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// 确保存储目录存在
const uploadDir = path.join(__dirname, 'uploads');
const splitDir = path.join(__dirname, 'uploads', 'splits');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(splitDir)) fs.mkdirSync(splitDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'MeetingMind Backend'
    });
});

// 辅助函数：使用 FFmpeg 切割音频
const splitAudio = (filePath) => {
    return new Promise((resolve, reject) => {
        logger('SPLIT', `开始切割文件: ${path.basename(filePath)}`);
        const outputPattern = path.join(splitDir, `${path.basename(filePath, path.extname(filePath))}_%03d.mp3`);
        ffmpeg(filePath)
            .outputOptions([
                '-f segment',
                '-segment_time 600', // 每 600秒 (10分钟) 切一段
                '-c copy'
            ])
            .output(outputPattern)
            .on('end', () => {
                fs.readdir(splitDir, (err, files) => {
                    if (err) reject(err);
                    const chunks = files
                        .filter(f => f.startsWith(path.basename(filePath, path.extname(filePath))))
                        .map(f => path.join(splitDir, f))
                        .sort();
                    logger('SPLIT', `切割完成，生成 ${chunks.length} 个切片`);
                    resolve(chunks);
                });
            })
            .on('error', (err) => {
                logger('ERROR', `切割失败: ${err.message}`);
                reject(err);
            })
            .run();
    });
};

// 辅助函数：调用 Whisper 转录
const transcribeChunk = async (filePath) => {
    const fileName = path.basename(filePath);
    logger('WHISPER', `正在转录片段: ${fileName}...`);
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

    const filePath = req.file.path;
    const fileSizeMB = req.file.size / (1024 * 1024);
    const fileId = req.file.filename;
    logger('UPLOAD', `接收文件: ${fileId}, 大小: ${fileSizeMB.toFixed(2)}MB`);

    // 立即返回响应，让前端可以开始轮询进度
    res.json({
        code: 200,
        message: "文件接收成功，开始处理",
        fileId: fileId
    });

    // 初始化处理状态
    processingStatus.set(fileId, { status: 'uploaded', progress: 0 });

    // 异步处理逻辑
    processFile(fileId, filePath, fileSizeMB).catch(error => {
        logger('ERROR', `异步处理失败: ${error.message}`);
        console.error(error);
    });
});

// 异步文件处理函数
async function processFile(fileId, filePath, fileSizeMB) {
    try {
        let fullTranscript = "";

        // 1. 检查大小与处理音频
        if (fileSizeMB > 25) {
            processingStatus.set(fileId, { status: 'splitting', progress: 10 });
            logger('PROCESS', `文件超过 25MB，启动自动切片流程`);
            const chunks = await splitAudio(filePath);

            processingStatus.set(fileId, { status: 'transcribing', progress: 30 });
            logger('PROCESS', `开始并行处理 ${chunks.length} 个切片...`);
            for (const [index, chunkPath] of chunks.entries()) {
                const progress = 30 + Math.floor((index / chunks.length) * 40);
                processingStatus.set(fileId, { status: 'transcribing', progress });
                logger('PROCESS', `处理进度: ${index + 1}/${chunks.length}`);
                const text = await transcribeChunk(chunkPath);
                fullTranscript += text + " ";
                fs.unlinkSync(chunkPath);
            }
        } else {
            processingStatus.set(fileId, { status: 'transcribing', progress: 50 });
            logger('PROCESS', `文件小于 25MB，直接转录`);
            fullTranscript = await transcribeChunk(filePath);
        }

        processingStatus.set(fileId, { status: 'generating_summary', progress: 80 });
        logger('LLM', `转录完成，正在生成 8 点结构化会议纪要...`);

        // 2. 调用 LLM 生成总结 (Updated Prompt)
        const systemPrompt = `You are a professional bilingual meeting assistant.

Your task is to take raw transcripts and create structured meeting minutes in BOTH English and Chinese.
Be concise, well-structured, and remove irrelevant small talk or fillers.
Identify speakers if possible and list them in the "attendees" field.
Ensure the "date" field is extracted from the context or marked as "Not specified".

Output MUST be a valid JSON object with the following structure:
{
"english": {
"title": "Meeting Title",
"date": "Date (YYYY-MM-DD)",
"attendees": ["Name 1", "Name 2"],
"summary": "3-5 sentences overview",
"key_discussion_points": ["Point 1", "Point 2"],
"decisions_made": ["Decision 1"],
"action_items": [{"task": "Task description", "assignee": "Name", "deadline": "Date"}],
"risks_issues": ["Risk 1"],
"next_steps": ["Step 1"]
},
"chinese": {
"title": "会议标题",
"date": "日期 (YYYY-MM-DD)",
"attendees": ["姓名1", "姓名2"],
"summary": "会议概述",
"key_discussion_points": ["讨论重点1", "讨论重点2"],
"decisions_made": ["决策1"],
"action_items": [{"task": "任务描述", "assignee": "负责人", "deadline": "截止日期"}],
"risks_issues": ["风险与问题1"],
"next_steps": ["下一步计划1"]
}
}`;

        const userPrompt = `Here is the transcript of a meeting. 


Please summarize it into structured meeting minutes in TWO versions (English and Chinese).
Follow the JSON structure strictly.
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
        processingStatus.set(fileId, { status: 'completed', progress: 100, minutesData: aiResult });
        
        // 输出会议纪要简介到日志
        const chineseSummary = aiResult.chinese?.summary || "无摘要";
        const englishSummary = aiResult.english?.summary || "No summary";
        logger('SUMMARY', `中文纪要摘要: ${chineseSummary.substring(0, 100)}...`);
        logger('SUMMARY', `English Summary: ${englishSummary.substring(0, 100)}...`);
        
        logger('LLM', `GPT 总结生成完毕`);

        // 清理原文件
        fs.unlinkSync(filePath);
        logger('CLEANUP', `原文件 ${fileId} 已清理，流程结束`);

    } catch (error) {
        processingStatus.set(fileId, { status: 'error', progress: 0, error: error.message });
        logger('ERROR', `处理流程异常: ${error.message}`);
        console.error(error);
        
        // 清理原文件
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (cleanupError) {
            logger('ERROR', `清理文件失败: ${cleanupError.message}`);
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
        error: status.error
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
        minutesData: status.minutesData
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
