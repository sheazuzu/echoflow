/**
 * OpenAI 服务模块
 * 封装所有 OpenAI/Whisper API 调用
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const config = require('../config');
const processManager = require('../utils/processManager');

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    apiKey: config.apiKey,
});

/**
 * 调用 Whisper API 进行音频转录（文件处理流程用）
 * @param {string} filePath - 音频文件路径
 * @param {string|null} fileId - 文件ID，用于取消检查
 * @returns {Promise<string>} 转录文本
 */
const transcribeChunk = async (filePath, fileId = null) => {
    const fileName = path.basename(filePath);
    const fileSizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
    
    logger('TRANSCRIBE_START', `开始转录音频片段: ${fileName} (${fileSizeMB}MB)`);
    
    // 首先检查文件是否存在
    if (!fs.existsSync(filePath)) {
        const errorMsg = `转录文件不存在: ${filePath}`;
        logger('TRANSCRIBE_ERROR', errorMsg);
        throw new Error(errorMsg);
    }
    
    // 检查文件是否可读
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
    } catch (err) {
        const errorMsg = `转录文件不可读或无权限: ${filePath}`;
        logger('TRANSCRIBE_ERROR', errorMsg);
        throw new Error(errorMsg);
    }
    
    const startTime = Date.now();

    // 检查是否被取消（如果提供了fileId）
    if (fileId && processManager.getStatus(fileId)?.status === 'cancelled') {
        logger('TRANSCRIBE_CANCEL', `转录进程被取消，跳过片段: ${fileName}`);
        throw new Error('用户取消了处理');
    }

    logger('TRANSCRIBE_API', `调用OpenAI Whisper API转录: ${fileName}`);
    
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-1",
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const textLength = transcription.text.length;
        
        logger('TRANSCRIBE_SUCCESS', `音频片段转录完成: ${fileName}，耗时 ${duration}s，生成文本 ${textLength} 字符`);
        logger('TRANSCRIBE_DETAIL', `转录结果预览: ${transcription.text.substring(0, 100)}${textLength > 100 ? '...' : ''}`);
        
        return transcription.text;
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger('TRANSCRIBE_ERROR', `Whisper API调用失败: ${fileName}，耗时 ${duration}s，错误: ${error.message}`);
        
        if (error.code) {
            logger('TRANSCRIBE_ERROR', `错误代码: ${error.code}`);
        }
        if (error.status) {
            logger('TRANSCRIBE_ERROR', `HTTP状态码: ${error.status}`);
        }
        
        throw error;
    }
};

/**
 * 实时转录音频流（实时转录路由用）
 * @param {Buffer} audioBuffer - 音频数据
 * @param {string} language - 语言参数（'auto' 或具体语言代码）
 * @param {string} tempFilePath - 临时文件路径
 * @returns {Promise<object>} 转录结果 { text, duration }
 */
const transcribeStream = async (audioBuffer, language, tempFilePath) => {
    // 将音频buffer写入临时文件
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
    
    const startTime = Date.now();
    const transcription = await openai.audio.transcriptions.create(transcriptionParams);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // 验证转录结果
    if (!transcription || typeof transcription.text === 'undefined') {
        throw new Error('Whisper API返回无效的转录结果');
    }
    
    // 清理临时文件
    fs.unlinkSync(tempFilePath);
    
    return {
        text: transcription.text || '',
        duration: parseFloat(duration)
    };
};

/**
 * 生成会议纪要（GPT-4）
 * @param {string} transcript - 转录文本
 * @returns {Promise<object>} { summary, duration }
 */
const generateMeetingSummary = async (transcript) => {
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

    return {
        summary,
        duration: parseFloat(duration)
    };
};

/**
 * 在文件处理流程中生成会议纪要（带文件大小参数，选择合适的模型）
 * @param {string} transcript - 转录文本
 * @param {number} fileSizeMB - 文件大小（MB）
 * @returns {Promise<object>} 会议纪要结果
 */
const generateMeetingSummaryForFile = async (transcript, fileSizeMB) => {
    return generateMeetingSummary(transcript);
};

module.exports = {
    openai,
    transcribeChunk,
    transcribeStream,
    generateMeetingSummary,
    generateMeetingSummaryForFile
};
