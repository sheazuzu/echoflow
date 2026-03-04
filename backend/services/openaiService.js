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
 * @param {Buffer|null} audioBuffer - 音频数据（fileExists为true时可为null）
 * @param {string} language - 语言参数（'auto' 或具体语言代码）
 * @param {string} tempFilePath - 临时文件路径
 * @param {boolean} fileExists - 文件是否已存在于磁盘（diskStorage模式）
 * @returns {Promise<object>} 转录结果 { text, duration }
 */
const transcribeStream = async (audioBuffer, language, tempFilePath, fileExists = false) => {
    // 如果文件不在磁盘上，将buffer写入临时文件
    if (!fileExists && audioBuffer) {
        fs.writeFileSync(tempFilePath, audioBuffer);
    }
    
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
    const systemPrompt = `You are a senior executive assistant with extensive experience in creating high-quality, actionable meeting minutes. You produce bilingual (English + Chinese) meeting documentation.

## Core Principles
1. **Accuracy First**: Only include information explicitly discussed in the transcript. Never fabricate or assume details not present.
2. **Actionable & Specific**: Every point should be concrete and useful. Avoid vague, generic statements.
3. **Logical Structure**: Organize discussion points by topic/theme, not chronologically.
4. **Professional Tone**: Use clear, professional language. Chinese output should follow standard business writing conventions (简洁专业，避免口语化).

## Quality Standards
- **Summary**: Write 4-8 sentences that capture the meeting's purpose, main conclusions, and overall direction. A reader should understand the meeting's value from the summary alone.
- **Key Discussion Points**: Each point should be 1-3 sentences, including: what was discussed, why it matters, and what conclusion was reached (if any). Group related topics together.
- **Decisions Made**: Only include explicit decisions. Each decision should state: what was decided, the reasoning/context, and any conditions or scope.
- **Action Items**: Must be specific and trackable. Include WHO does WHAT by WHEN. If the transcript doesn't specify assignee/deadline, mark as "To be assigned" / "To be determined".
- **Risks & Issues**: Include only substantive risks/blockers mentioned. Each should briefly describe the risk and its potential impact.

## Handling Edge Cases
- If attendees cannot be identified from the transcript, use ["Not identified from transcript"] / ["无法从录音中识别"].
- If the date is not mentioned, use "Not specified" / "未指定".
- If no decisions were explicitly made, use an empty array [] rather than fabricating decisions.
- If no action items were assigned, use an empty array [].
- For short meetings (< 10 min), keep output concise. For longer meetings, be proportionally more detailed.

## Output Format
Output MUST be a valid JSON object with this exact structure:
{
  "english": {
    "title": "Concise, descriptive meeting title",
    "date": "YYYY-MM-DD or Not specified",
    "attendees": ["Name 1", "Name 2"],
    "summary": "4-8 sentence comprehensive overview",
    "key_discussion_points": ["Detailed point with context and conclusion"],
    "decisions_made": ["Specific decision with rationale"],
    "action_items": [{"task": "Specific deliverable", "assignee": "Person or To be assigned", "deadline": "Date or To be determined"}],
    "risks_issues": ["Risk/issue with impact description"]
  },
  "chinese": {
    "title": "简明扼要的会议标题",
    "date": "YYYY-MM-DD 或 未指定",
    "attendees": ["姓名1", "姓名2"],
    "summary": "4-8句话全面概述会议目的、主要结论和整体方向",
    "key_discussion_points": ["详细讨论点（含背景、要点和结论）"],
    "decisions_made": ["具体决策（含决策依据和适用范围）"],
    "action_items": [{"task": "具体可交付成果", "assignee": "负责人或待指定", "deadline": "日期或待定"}],
    "risks_issues": ["风险/问题（含影响描述）"]
  }
}

IMPORTANT: The Chinese version must NOT be a literal translation of the English version. Each should be independently well-written in its respective language, following native writing conventions.`;

    const userPrompt = `Please analyze the following meeting transcript and create detailed, high-quality meeting minutes. Output your response as a valid JSON object.

Focus on:
1. Identifying the core topics and organizing them logically
2. Extracting concrete decisions and commitments
3. Capturing specific action items with clear ownership
4. Noting any risks, concerns, or unresolved issues

Transcript:
${transcript}`;

    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        model: "gpt-4-turbo",
        temperature: 0.3,
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
