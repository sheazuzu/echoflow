/**
 * 文件上传与处理路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const upload = require('../middleware/upload');
const { getUploadDir, getSplitDir } = require('../utils/fileHelper');
const processManager = require('../utils/processManager');
const cosService = require('../services/cosService');
const audioService = require('../services/audioService');
const openaiService = require('../services/openaiService');

// 上传与处理接口
router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        logger('UPLOAD', '失败：未收到文件');
        return res.status(400).json({ message: "未上传文件" });
    }

    const tmpFilePath = req.file.path;  // diskStorage 保存的临时文件路径
    const fileSizeMB = req.file.size / (1024 * 1024);
    
    // 获取会议主题（如果前端传递了）
    const meetingTopic = req.body.meetingTopic || '';
    
    // 生成标准化文件名：YYYYMMDD_HHMMSS_会议主题_原始文件名
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    // 清理会议主题：移除特殊字符，限制长度
    let cleanTopic = '';
    if (meetingTopic) {
        cleanTopic = meetingTopic
            .replace(/[\\/:*?"<>|,&()#%!@$^~`{}\[\]+=;']/g, '_')  // 替换所有可能导致URL和文件系统问题的特殊字符
            .replace(/\s+/g, '_')            // 空格替换为下划线
            .replace(/_+/g, '_')             // 多个连续下划线合并为一个
            .replace(/^_+|_+$/g, '')         // 去除首尾下划线
            .substring(0, 50);               // 限制主题长度为50字符
        cleanTopic = '_' + cleanTopic;       // 添加分隔符
    }
    
    // 清理原始文件名：移除所有可能导致URL和文件系统问题的特殊字符
    // 注意：必须移除非ASCII字符，防止COS路径不匹配和Whisper API格式识别失败
    let cleanFileName = req.file.originalname
        .replace(/[^\x20-\x7E]/g, '_')  // 移除所有非ASCII可打印字符（包括中文、特殊编码字符等）
        .replace(/[\\/:*?"<>|,&()#%!@$^~`{}\[\]+=;']/g, '_')  // 替换特殊字符
        .replace(/\s+/g, '_')            // 空格替换为下划线
        .replace(/_+/g, '_')             // 多个连续下划线合并为一个
        .replace(/^_+|_+$/g, '');        // 去除首尾下划线
    
    // 修复双扩展名问题（如 file.m4a.mp3 → file.m4a）
    // Whisper API会根据扩展名判断文件格式，双扩展名会导致格式识别错误
    const audioExtensions = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];
    const currentExt = path.extname(cleanFileName).toLowerCase();
    if (audioExtensions.includes(currentExt)) {
        const nameWithoutExt = cleanFileName.slice(0, -currentExt.length);
        const secondExt = path.extname(nameWithoutExt).toLowerCase();
        if (audioExtensions.includes(secondExt)) {
            // 双扩展名情况：保留第一个音频扩展名（更可能是真实格式）
            cleanFileName = nameWithoutExt;
            logger('UPLOAD', `修复双扩展名: 去除多余的 ${currentExt}，保留 ${secondExt}`);
        }
    }
    
    // 文件名格式：时间戳_会议主题_原始文件名
    const fileId = `${timestamp}${cleanTopic}_${cleanFileName}`;
    
    logger('UPLOAD', `接收文件: ${req.file.originalname}`);
    if (meetingTopic) {
        logger('UPLOAD', `会议主题: ${meetingTopic}`);
    }
    logger('UPLOAD', `标准化文件名: ${fileId}`);
    logger('UPLOAD', `文件大小: ${fileSizeMB.toFixed(2)}MB`);

    // 立即返回响应，让前端可以开始轮询进度
    res.json({
        code: 200,
        message: "文件接收成功，开始处理",
        fileId: fileId
    });

    // 初始化处理状态
    processManager.setStatus(fileId, { status: 'uploading_to_cos', progress: 5 });

    try {
        // 1. 上传文件到COS（从磁盘文件读取buffer）
        logger('PROCESS_START', `开始处理文件: ${fileId} (${fileSizeMB.toFixed(2)}MB)`);
        logger('STEP_UPLOAD', `步骤1: 上传文件到COS存储`);
        processManager.setStatus(fileId, { status: 'uploading_to_cos', progress: 10 });
        
        const fileBuffer = fs.readFileSync(tmpFilePath);
        const cosKey = await cosService.uploadToCOS(fileBuffer, fileId);
        processManager.setStatus(fileId, { status: 'uploaded_to_cos', progress: 30 });
        
        // 上传COS后删除multer临时文件，释放磁盘空间
        try {
            fs.unlinkSync(tmpFilePath);
            logger('CLEANUP_TMP', `已清理multer临时上传文件: ${tmpFilePath}`);
        } catch (tmpErr) {
            logger('CLEANUP_WARN', `清理multer临时文件失败: ${tmpErr.message}`);
        }
        
        // 2. 开始处理文件
        logger('STEP_PROCESS', `步骤2: 开始音频处理流程`);
        logger('PROCESS_INFO', `文件已上传到COS: ${cosKey}`);
        await processFile(fileId, cosKey, fileSizeMB);
        
    } catch (error) {
        logger('PROCESS_ERROR', `文件处理流程异常: ${error.message}`);
        logger('ERROR_DETAIL', `错误堆栈: ${error.stack}`);
        processManager.setStatus(fileId, { status: 'error', progress: 0, error: error.message });
        console.error(error);
        
        // 异常时清理multer临时上传文件（如果还未被清理）
        try {
            if (tmpFilePath && fs.existsSync(tmpFilePath)) {
                fs.unlinkSync(tmpFilePath);
                logger('ERROR_CLEANUP_TMP', `异常清理multer临时文件: ${tmpFilePath}`);
            }
        } catch (cleanupErr) {
            logger('CLEANUP_WARN', `异常清理multer临时文件失败: ${cleanupErr.message}`);
        }
    }
});

// 异步文件处理函数
async function processFile(fileId, cosKey, fileSizeMB) {
    const uploadDir = getUploadDir();
    const splitDir = getSplitDir();
    let localFilePath = null;
    let transcriptCosKey = null;
    
    try {
        // 1. 从COS下载文件到本地临时文件
        logger('STEP_DOWNLOAD', `步骤3: 从COS下载文件到本地处理`);
        logger('COS_DOWNLOAD', `开始从COS下载文件: ${cosKey}`);
        processManager.setStatus(fileId, { status: 'downloading_from_cos', progress: 40 });
        
        localFilePath = await cosService.downloadFromCOS(cosKey);
        processManager.setStatus(fileId, { status: 'downloaded_from_cos', progress: 50 });
        
        // 检查文件是否存在
        if (!fs.existsSync(localFilePath)) {
            const errorMsg = `处理文件不存在: ${localFilePath}. 请检查文件是否成功下载。`;
            logger('FILE_ERROR', errorMsg);
            processManager.setStatus(fileId, { status: 'error', progress: 0, error: errorMsg });
            throw new Error(errorMsg);
        }
        
        // 检查文件大小和可读性
        const fileStats = fs.statSync(localFilePath);
        const actualFileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
        logger('FILE_INFO', `文件下载完成: ${localFilePath}，实际大小: ${actualFileSizeMB}MB`);
        
        let fullTranscript = "";

        // 1. 检查大小与处理音频
        if (fileSizeMB > 25) {
            logger('STEP_SPLIT', `步骤4: 音频文件过大(${fileSizeMB.toFixed(2)}MB > 25MB)，启动切片流程`);
            processManager.setStatus(fileId, { status: 'splitting', progress: 60 });
            logger('PROCESS_INFO', `文件超过 25MB (${fileSizeMB.toFixed(2)}MB)，启动自动切片流程`);
            
            // 动态计算切片时间
            const targetChunkSizeMB = 24;
            const estimatedChunkCount = Math.ceil(fileSizeMB / targetChunkSizeMB);
            let fileDuration = await audioService.getAudioDuration(localFilePath);
            
            // 安全检查：确保时长有效
            if (!fileDuration || isNaN(fileDuration) || fileDuration <= 0) {
                logger('DURATION_WARN', `文件时长无效 (${fileDuration})，降级到文件大小估算`);
                fileDuration = Math.ceil((fileSizeMB * 8 * 1024) / 128);
                logger('DURATION_ESTIMATE', `估算时长: ${Math.round(fileDuration/60)} 分钟 (基于文件大小${fileSizeMB.toFixed(2)}MB)`);
            }
            
            let segmentTime = Math.ceil(fileDuration / estimatedChunkCount);
            
            // 安全检查：确保切片时间有效
            if (!segmentTime || isNaN(segmentTime) || segmentTime <= 0) {
                logger('SPLIT_WARN', `切片时间计算无效 (${segmentTime}秒)，降级到默认值 600 秒(10分钟)`);
                segmentTime = 600;
            }
            
            logger('SPLIT_DETAIL', `文件时长约${Math.round(fileDuration/60)}分钟，预计切成${estimatedChunkCount}个切片，每段${Math.round(segmentTime/60)}分钟`);
            
            // 记录切片进程
            processManager.registerProcess(fileId, { type: processManager.ProcessType.SPLIT, startTime: new Date() });
            
            const chunks = await audioService.splitAudio(localFilePath, segmentTime, fileId);

            logger('STEP_TRANSCRIBE', `步骤5: 开始转录音频内容`);
            processManager.setStatus(fileId, { status: 'transcribing', progress: 70, currentChunk: 0, totalChunks: chunks.length });
            logger('TRANSCRIBE_START', `开始并行处理 ${chunks.length} 个音频切片...`);
            
            // 记录转录进程
            processManager.registerProcess(fileId, { type: processManager.ProcessType.TRANSCRIBE, startTime: new Date(), totalChunks: chunks.length });
            
            for (const [index, chunkPath] of chunks.entries()) {
                const progress = 70 + Math.floor((index / chunks.length) * 20);
                processManager.setStatus(fileId, { status: 'transcribing', progress, currentChunk: index + 1, totalChunks: chunks.length });
                logger('TRANSCRIBE_PROGRESS', `转录进度: ${index + 1}/${chunks.length} (${progress}%)`);
                
                // 检查是否被取消
                if (processManager.getStatus(fileId)?.status === 'cancelled') {
                    logger('TRANSCRIBE_CANCEL', `转录进程被取消，终止处理切片 ${index + 1}/${chunks.length}`);
                    fs.unlinkSync(chunkPath);
                    break;
                }
                
                const text = await openaiService.transcribeChunk(chunkPath, fileId);
                fullTranscript += text + " ";
                fs.unlinkSync(chunkPath);
                logger('TRANSCRIBE_CHUNK', `切片 ${index + 1}/${chunks.length} 转录完成，累计文本长度: ${fullTranscript.length} 字符`);
            }
        } else {
            logger('STEP_TRANSCRIBE', `步骤5: 开始转录音频内容（小文件直接转录）`);
            processManager.setStatus(fileId, { status: 'transcribing', progress: 70 });
            logger('TRANSCRIBE_DIRECT', `文件小于 25MB (${fileSizeMB.toFixed(2)}MB)，直接转录，无需切片`);
            
            // 记录转录进程
            processManager.registerProcess(fileId, { type: processManager.ProcessType.TRANSCRIBE, startTime: new Date(), totalChunks: 1 });
            
            // 检查是否被取消
            if (processManager.getStatus(fileId)?.status === 'cancelled') {
                logger('TRANSCRIBE_CANCEL', `转录进程被取消，跳过小文件转录: ${fileId}`);
                throw new Error('用户取消了处理');
            }
            
            fullTranscript = await openaiService.transcribeChunk(localFilePath, fileId);
        }

        // 保持处理状态连续性
        processManager.setStatus(fileId, { status: 'transcribing', progress: 80 });
        
        logger('STEP_SUMMARY', `步骤6: 生成结构化会议纪要`);
        const transcriptLength = fullTranscript.length;
        logger('LLM_PREPARE', `转录完成，准备生成会议纪要，转录文本长度: ${transcriptLength} 字符`);

        // 检查是否被取消
        if (processManager.getStatus(fileId)?.status === 'cancelled') {
            logger('LLM_CANCEL', `总结生成进程被取消，跳过LLM调用`);
            throw new Error('用户取消了处理');
        }

        // 记录总结生成进程
        processManager.registerProcess(fileId, { type: processManager.ProcessType.SUMMARY, startTime: new Date() });
        
        // 立即更新状态为generating_summary
        processManager.setStatus(fileId, { status: 'generating_summary', progress: 80 });

        // 2. 调用 LLM 生成总结 (Enhanced Prompt for Detailed Minutes)
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

        const detailLevel = transcriptLength > 10000 ? 'VERY DETAILED' : transcriptLength > 3000 ? 'MODERATELY DETAILED' : 'CONCISE';
        const estimatedMinutes = Math.max(5, Math.round(transcriptLength / 500));
        
        const userPrompt = `Please analyze the following meeting transcript and create ${detailLevel} meeting minutes. This appears to be approximately a ${estimatedMinutes}-minute meeting (${fileSizeMB.toFixed(1)}MB audio file) with ${transcriptLength} characters of transcript text.

Output your response as a valid JSON object.

## Requirements:
1. **Be thorough**: Identify ALL distinct topics discussed and list each one separately. Do not merge or skip any substantive discussion point.
2. **Be detailed**: For each discussion point, explain the context, what was said, what different viewpoints were raised, and what conclusion was reached.
3. **Extract all decisions**: Even informal agreements or consensus should be captured.
4. **Capture all action items**: Any commitment to do something, however small, should be listed.
5. **Note all concerns**: Any risk, blocker, worry, or unresolved question should be documented.
6. **Proportional detail**: Since this is a ${estimatedMinutes}-minute meeting, the minutes should be comprehensive and detailed — NOT a brief skeleton.

Transcript:
${fullTranscript}`;

        const completion = await openaiService.openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-4-turbo",
            temperature: 0.3,
            max_tokens: 4096,
            response_format: { type: "json_object" }
        });

        const aiResult = JSON.parse(completion.choices[0].message.content);
        
        logger('LLM_SUCCESS', `GPT总结生成完成，开始处理结果`);
        
        // 3. 将转录结果上传到COS桶
        logger('STEP_UPLOAD_TRANSCRIPT', `步骤7: 上传转录结果到COS存储`);
        logger('COS_UPLOAD', `开始上传转录结果到COS桶`);
        transcriptCosKey = await cosService.uploadTranscriptToCOS(fullTranscript, fileId);
        logger('COS_SUCCESS', `转录结果已存储到COS: ${transcriptCosKey}`);
        
        processManager.setStatus(fileId, { 
            status: 'completed', 
            progress: 100, 
            minutesData: aiResult,
            transcript: fullTranscript,
            transcriptCosKey: transcriptCosKey,
            cosKey: cosKey
        });
        
        // 输出会议纪要简介到日志
        const chineseTitle = aiResult.chinese?.title || "无标题";
        
        logger('SUMMARY_SUCCESS', `会议纪要生成完成`);
        logger('SUMMARY_DETAIL', `中文标题: ${chineseTitle}`);
        logger('PROCESS_COMPLETE', `文件处理流程全部完成: ${fileId}`);

        // 清理文件
        try {
            logger('STEP_CLEANUP', `步骤8: 清理本地临时文件`);
            if (localFilePath && fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                logger('CLEANUP_SUCCESS', `本地临时文件已清理: ${localFilePath}`);
            }
            
            logger('COS_KEEP', `COS音频文件已保留供下载: ${cosKey}`);
            logger('COS_KEEP', `COS转录结果已存储: ${transcriptCosKey}`);
            logger('CLEANUP_COMPLETE', `文件处理流程完成，本地临时文件已清理，转录结果已存储在COS`);
            
        } catch (cleanupError) {
            logger('CLEANUP_ERROR', `清理文件失败: ${cleanupError.message}`);
            logger('ERROR_STACK', `清理错误堆栈: ${cleanupError.stack}`);
        }

    } catch (error) {
        logger('PROCESS_FAILED', `文件处理流程失败: ${fileId}`);
        logger('ERROR_DETAIL', `错误信息: ${error.message}`);
        logger('ERROR_STACK', `错误堆栈: ${error.stack}`);
        
        processManager.setStatus(fileId, { status: 'error', progress: 0, error: error.message });
        
        // 异常情况下清理文件
        try {
            logger('ERROR_CLEANUP', `开始异常情况下的文件清理`);
            if (localFilePath && fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
                logger('ERROR_CLEANUP_SUCCESS', `异常情况下清理本地文件: ${localFilePath}`);
            }
            
            // 清理可能存在的临时切片文件
            const splitDirFiles = fs.readdirSync(splitDir);
            const relatedFiles = splitDirFiles.filter(file => file.includes(fileId));
            if (relatedFiles.length > 0) {
                relatedFiles.forEach(file => {
                    const filePath = path.join(splitDir, file);
                    fs.unlinkSync(filePath);
                    logger('ERROR_CLEANUP_SUCCESS', `清理临时切片文件: ${filePath}`);
                });
            }
            
            logger('ERROR_CLEANUP_COMPLETE', `异常清理完成`);
        } catch (cleanupError) {
            logger('ERROR_CLEANUP_FAILED', `异常清理失败: ${cleanupError.message}`);
        }
    }
}

module.exports = router;
