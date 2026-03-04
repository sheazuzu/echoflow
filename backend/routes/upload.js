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
    const cleanFileName = req.file.originalname
        .replace(/[\\/:*?"<>|,&()#%!@$^~`{}\[\]+=;']/g, '_')  // 替换特殊字符
        .replace(/\s+/g, '_')            // 空格替换为下划线
        .replace(/_+/g, '_')             // 多个连续下划线合并为一个
        .replace(/^_+|_+$/g, '');        // 去除首尾下划线
    
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
        const systemPrompt = `You are a senior executive assistant with extensive experience in creating high-quality, actionable meeting minutes. You produce bilingual (English + Chinese) meeting documentation.

## Core Principles
1. **Accuracy First**: Only include information explicitly discussed in the transcript. Never fabricate or assume details not present.
2. **Actionable & Specific**: Every point should be concrete and useful. Avoid vague, generic statements.
3. **Logical Structure**: Organize discussion points by topic/theme, not chronologically.
4. **Professional Tone**: Use clear, professional language. Chinese output should follow standard business writing conventions (简洁专业，避免口语化).

## Quality Standards
- **Summary**: Write 4-8 sentences for short meetings, 6-12 sentences for longer ones. Capture the meeting's purpose, main conclusions, and overall direction. A reader should understand the meeting's value from the summary alone.
- **Key Discussion Points**: Each point should be 1-3 sentences, including: what was discussed, why it matters, and what conclusion was reached (if any). Group related topics together. Short meetings: 3-5 points. Long meetings: 5-10 points.
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

        const userPrompt = `Here is the transcript of a ${Math.round(fileSizeMB/2.5)}-minute meeting (${fileSizeMB.toFixed(1)}MB audio file).

Please analyze this transcript and create detailed, high-quality meeting minutes. Output your response as a valid JSON object.

Focus on:
1. Identifying the core topics and organizing them logically
2. Extracting concrete decisions and commitments
3. Capturing specific action items with clear ownership
4. Noting any risks, concerns, or unresolved issues

Transcript:
${fullTranscript}`;

        const completion = await openaiService.openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-4-turbo",
            temperature: 0.3,
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
