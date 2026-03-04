/**
 * OpenAI 服务模块
 * 封装所有 OpenAI/Whisper API 调用
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { toFile } = require('openai');
const logger = require('../utils/logger');
const config = require('../config');
const processManager = require('../utils/processManager');

// Whisper API 支持的音频格式
const SUPPORTED_AUDIO_EXTENSIONS = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];

/**
 * 从文件路径中提取有效的音频扩展名
 * 处理双扩展名（如 .m4a.mp3）和特殊字符等问题
 * @param {string} filePath - 文件路径
 * @returns {string} 有效的音频扩展名（含点号），默认 '.mp3'
 */
const getValidAudioExtension = (filePath) => {
    const baseName = path.basename(filePath);
    // 从文件名末尾开始匹配有效的音频扩展名
    const ext = path.extname(baseName).toLowerCase();
    if (SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
        return ext;
    }
    // 检查是否有双扩展名的情况（如 file.m4a.mp3）
    const nameWithoutExt = baseName.slice(0, -ext.length || undefined);
    const secondExt = path.extname(nameWithoutExt).toLowerCase();
    if (SUPPORTED_AUDIO_EXTENSIONS.includes(secondExt)) {
        return secondExt;
    }
    // 默认返回 .mp3
    return '.mp3';
};

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

    // 使用干净的文件名避免特殊字符和双扩展名导致的格式识别错误
    const validExt = getValidAudioExtension(filePath);
    const cleanApiFileName = `audio${validExt}`;
    logger('TRANSCRIBE_API', `调用OpenAI Whisper API转录: ${fileName}，API文件名: ${cleanApiFileName}`);
    
    try {
        // 使用 toFile 自定义传给 API 的文件名，避免原始文件名中的特殊字符和双扩展名问题
        const fileStream = fs.createReadStream(filePath);
        const apiFile = await toFile(fileStream, cleanApiFileName);
        const transcription = await openai.audio.transcriptions.create({
            file: apiFile,
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
    const systemPrompt = `You are a senior executive assistant with extensive experience in creating high-quality, comprehensive, and actionable meeting minutes. You produce bilingual (English + Chinese) meeting documentation.

## Core Principles
1. **Accuracy First**: Only include information explicitly discussed in the transcript. Never fabricate or assume details not present.
2. **Comprehensive & Detailed**: Capture ALL substantive topics discussed. Do NOT oversimplify or merge distinct topics into one bullet point. Each discussion point deserves its own entry with full context.
3. **Actionable & Specific**: Every point should be concrete and useful. Avoid vague, generic, one-sentence summaries. Expand on the reasoning, context, alternatives considered, and conclusions.
4. **Logical Structure**: Organize discussion points by topic/theme, not chronologically.
5. **Professional Tone**: Use clear, professional language. Chinese output should follow standard business writing conventions (简洁专业，避免口语化).

## Detail Level by Meeting Length
You MUST adjust the level of detail based on transcript length:

### Short Meetings (transcript < 3000 characters)
- Summary: 3-5 sentences
- Key Discussion Points: 3-5 items, each with a clear topic heading and 1-2 sentence detail
- Decisions/Actions: brief

### Medium Meetings (transcript 3000-10000 characters)
- Summary: 6-10 sentences covering purpose, key themes, outcomes
- Key Discussion Points: 6-10 items, each with a clear topic heading and 2-4 sentence detail with context, reasoning, and conclusions
- Decisions/Actions: moderate detail

### Long Meetings (transcript > 10000 characters)
- Summary: 10-15 sentences providing a thorough executive briefing. Cover the meeting's purpose, all major themes discussed, key conclusions for each theme, strategic implications, and agreed next steps.
- Key Discussion Points: 10-20 items (or more if warranted). Each point MUST have:
  * A clear, specific **topic** heading (e.g. "PGOS Dedicated Server Scalability" not just "Server Discussion")
  * A **detailed paragraph of 3-6 sentences** covering: what was raised, different perspectives/options discussed, technical details/data/examples mentioned, conclusion or consensus reached, and why it matters
- Decisions Made: Include full context and reasoning for each decision (2-3 sentences each)
- Action Items: Detailed description of each task
- Risks & Issues: Each risk should include cause, potential impact, and any proposed mitigation discussed

## Quality Standards
- **Summary**: Must be a standalone executive briefing. A reader who ONLY reads the summary should fully understand what the meeting was about, what was accomplished, and what comes next.
- **Key Discussion Points**: This is the MOST IMPORTANT section. Do NOT compress multiple topics into a single bullet. If the meeting discussed 15 different topics, list all 15 separately. Each point MUST have a descriptive topic heading that clearly identifies the subject matter. The topic should be specific (e.g. "Cost Comparison: PGOS vs PlayFab" not "Cost Discussion"). The detail should provide enough context that someone who missed the meeting can understand the full discussion.
- **Decisions Made**: Only include explicit decisions. State: what was decided, why, any conditions, and who it affects.
- **Action Items**: Must be specific and trackable. Include WHO does WHAT by WHEN. If not specified, mark as "To be assigned" / "To be determined".
- **Risks & Issues**: Include substantive risks/blockers with potential impact and any discussed mitigation.

## Handling Edge Cases
- If attendees cannot be identified, use ["Not identified from transcript"] / ["无法从录音中识别"].
- If date is not mentioned, use "Not specified" / "未指定".
- If no decisions were explicitly made, use an empty array [].
- If no action items were assigned, use an empty array [].
- Filter out small talk, filler words, and off-topic chatter. Focus on substantive content.

## Output Format
Output MUST be a valid JSON object with this exact structure:
{
  "english": {
    "title": "Concise, descriptive meeting title",
    "date": "YYYY-MM-DD or Not specified",
    "attendees": ["Name 1", "Name 2"],
    "summary": "Comprehensive executive overview (length proportional to meeting duration)",
    "key_discussion_points": [{"topic": "Clear, specific topic heading (e.g. 'Backend Architecture Selection')", "detail": "Detailed paragraph with full context, different viewpoints, technical details, conclusions, and implications"}],
    "decisions_made": ["Specific decision with full rationale and scope"],
    "action_items": [{"task": "Detailed deliverable description", "assignee": "Person or To be assigned", "deadline": "Date or To be determined"}],
    "risks_issues": ["Risk/issue with impact and mitigation if discussed"]
  },
  "chinese": {
    "title": "简明扼要的会议标题",
    "date": "YYYY-MM-DD 或 未指定",
    "attendees": ["姓名1", "姓名2"],
    "summary": "全面的管理层概述（篇幅与会议时长成正比）",
    "key_discussion_points": [{"topic": "清晰具体的主题标题（如'后端架构方案对比'）", "detail": "包含完整背景、讨论过程、各方观点和结论的详细段落"}],
    "decisions_made": ["具体决策（含完整的决策依据和适用范围）"],
    "action_items": [{"task": "详细的可交付成果描述", "assignee": "负责人或待指定", "deadline": "日期或待定"}],
    "risks_issues": ["风险/问题（含影响描述和讨论过的应对措施）"]
  }
}

IMPORTANT: 
1. The Chinese version must NOT be a literal translation of the English version. Each should be independently well-written in its respective language.
2. NEVER produce a short, skeletal summary for a long meeting. The output length should be PROPORTIONAL to the input length. A 1-hour meeting transcript should produce substantially more detailed minutes than a 10-minute meeting.`;

    const transcriptLength = transcript.length;
    const estimatedMinutes = Math.max(5, Math.round(transcriptLength / 500)); // 粗略估算会议时长
    const detailLevel = transcriptLength > 10000 ? 'VERY DETAILED' : transcriptLength > 3000 ? 'MODERATELY DETAILED' : 'CONCISE';
    
    const userPrompt = `Please analyze the following meeting transcript and create ${detailLevel} meeting minutes. This appears to be approximately a ${estimatedMinutes}-minute meeting with ${transcriptLength} characters of transcript text.

Output your response as a valid JSON object.

## Requirements:
1. **Be thorough**: Identify ALL distinct topics discussed and list each one separately. Do not merge or skip any substantive discussion point.
2. **Be detailed**: For each discussion point, explain the context, what was said, what different viewpoints were raised, and what conclusion was reached.
3. **Extract all decisions**: Even informal agreements or consensus should be captured.
4. **Capture all action items**: Any commitment to do something, however small, should be listed.
5. **Note all concerns**: Any risk, blocker, worry, or unresolved question should be documented.
6. **Proportional detail**: Since this is a ${estimatedMinutes}-minute meeting, the minutes should be comprehensive and detailed — NOT a brief skeleton.

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
        max_tokens: 4096,
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
