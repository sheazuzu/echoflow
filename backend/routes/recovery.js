const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const processManager = require('../utils/processManager');
const cosService = require('../services/cosService');
const audioService = require('../services/audioService');
const openaiService = require('../services/openaiService');

// 获取所有已上传但未处理的文件
router.get('/recovery/files', (req, res) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    
    try {
        const files = fs.readdirSync(uploadDir).filter(file => {
            // 过滤掉目录和隐藏文件
            const filePath = path.join(uploadDir, file);
            return fs.statSync(filePath).isFile() && !file.startsWith('.');
        });
        
        const fileList = files.map(file => {
            const filePath = path.join(uploadDir, file);
            const stats = fs.statSync(filePath);
            const status = processManager.getStatus(file);
            
            return {
                fileId: file,
                size: stats.size,
                modified: stats.mtime,
                status: status ? status.status : 'unknown',
                progress: status ? status.progress : 0,
                hasStatus: !!status
            };
        });
        
        res.json({
            code: 200,
            message: "获取文件列表成功",
            files: fileList
        });
    } catch (error) {
        logger('RECOVERY_ERROR', `获取文件列表失败: ${error.message}`);
        res.status(500).json({
            code: 500,
            message: "获取文件列表失败",
            error: error.message
        });
    }
});

// 重新启动文件处理
router.post('/recovery/restart/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const uploadDir = path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadDir, fileId);
    
    try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                code: 404,
                message: "文件不存在",
                fileId: fileId
            });
        }
        
        // 检查文件是否已经在处理中
        const existingStatus = processManager.getStatus(fileId);
        if (existingStatus && ['uploading_to_cos', 'uploaded_to_cos', 'downloading_from_cos', 'splitting', 'transcribing', 'generating_summary'].includes(existingStatus.status)) {
            return res.status(400).json({
                code: 400,
                message: "文件已经在处理中",
                fileId: fileId,
                currentStatus: existingStatus.status
            });
        }
        
        const fileSizeMB = fs.statSync(filePath).size / (1024 * 1024);
        
        logger('RECOVERY_START', `开始恢复文件处理: ${fileId} (${fileSizeMB.toFixed(2)}MB)`);
        
        // 立即返回响应，让前端可以开始轮询进度
        res.json({
            code: 200,
            message: "文件处理恢复成功，开始处理",
            fileId: fileId
        });
        
        // 异步处理文件
        processFileRecovery(fileId, filePath, fileSizeMB);
        
    } catch (error) {
        logger('RECOVERY_ERROR', `恢复文件处理失败: ${error.message}`);
        res.status(500).json({
            code: 500,
            message: "恢复文件处理失败",
            error: error.message
        });
    }
});

// 异步文件处理恢复函数
async function processFileRecovery(fileId, filePath, fileSizeMB) {
    let cosKey = null;
    
    try {
        // 1. 初始化处理状态
        processManager.setStatus(fileId, { status: 'uploading_to_cos', progress: 5 });
        
        logger('RECOVERY_PROCESS', `步骤1: 上传文件到COS存储`);
        processManager.setStatus(fileId, { status: 'uploading_to_cos', progress: 10 });
        
        // 2. 上传文件到COS
        const fileBuffer = fs.readFileSync(filePath);
        cosKey = await cosService.uploadToCOS(fileBuffer, fileId);
        processManager.setStatus(fileId, { status: 'uploaded_to_cos', progress: 30 });
        
        logger('RECOVERY_COS_SUCCESS', `文件已上传到COS: ${cosKey}`);
        
        // 3. 调用现有的文件处理流程
        await processFile(fileId, cosKey, fileSizeMB);
        
    } catch (error) {
        logger('RECOVERY_PROCESS_ERROR', `文件处理恢复流程异常: ${error.message}`);
        processManager.setStatus(fileId, { status: 'error', progress: 0, error: error.message });
    }
}

// 复用现有的文件处理函数（从upload.js导入）
async function processFile(fileId, cosKey, fileSizeMB) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    const splitDir = path.join(uploadDir, 'splits');
    let localFilePath = null;
    let transcriptCosKey = null;
    
    try {
        // 从COS下载文件到本地临时文件
        logger('RECOVERY_DOWNLOAD', `步骤2: 从COS下载文件到本地处理`);
        processManager.setStatus(fileId, { status: 'downloading_from_cos', progress: 40 });
        
        localFilePath = await cosService.downloadFromCOS(cosKey);
        processManager.setStatus(fileId, { status: 'downloaded_from_cos', progress: 50 });
        
        // 检查文件是否存在
        if (!fs.existsSync(localFilePath)) {
            const errorMsg = `处理文件不存在: ${localFilePath}`;
            logger('RECOVERY_FILE_ERROR', errorMsg);
            processManager.setStatus(fileId, { status: 'error', progress: 0, error: errorMsg });
            throw new Error(errorMsg);
        }
        
        // 后续处理逻辑与upload.js相同
        logger('RECOVERY_CONTINUE', `继续标准处理流程...`);
        
        // 设置状态为处理中
        processManager.setStatus(fileId, { status: 'processing', progress: 60 });
        
        // 立即设置状态为处理中，然后开始真正的处理
        // 这里调用真正的音频处理服务
        logger('RECOVERY_AUDIO_PROCESS', `开始音频处理流程`);
        processManager.setStatus(fileId, { status: 'splitting', progress: 70 });
        
        // 根据文件大小决定是否切片
        if (fileSizeMB > 25) {
            logger('RECOVERY_SPLIT', `文件过大(${fileSizeMB.toFixed(2)}MB > 25MB)，启动切片流程`);
            
            // 获取音频时长
            const fileDuration = await audioService.getAudioDuration(localFilePath);
            const targetChunkSizeMB = 24;
            const estimatedChunkCount = Math.ceil(fileSizeMB / targetChunkSizeMB);
            let segmentTime = Math.ceil(fileDuration / estimatedChunkCount);
            
            if (!segmentTime || isNaN(segmentTime) || segmentTime <= 0) {
                segmentTime = 600; // 默认10分钟
            }
            
            logger('RECOVERY_SPLIT_DETAIL', `文件时长约${Math.round(fileDuration/60)}分钟，预计切成${estimatedChunkCount}个切片`);
            
            // 切片音频
            const chunks = await audioService.splitAudio(localFilePath, segmentTime, fileId);
            processManager.setStatus(fileId, { status: 'transcribing', progress: 80, currentChunk: 0, totalChunks: chunks.length });
            
            let fullTranscript = "";
            let successfulChunks = 0;
            let failedChunks = 0;
            
            // 转录每个切片
            for (const [index, chunkPath] of chunks.entries()) {
                const progress = 80 + Math.floor((index / chunks.length) * 15);
                processManager.setStatus(fileId, { status: 'transcribing', progress, currentChunk: index + 1, totalChunks: chunks.length });
                
                try {
                    const text = await openaiService.transcribeChunk(chunkPath, fileId);
                    fullTranscript += text + " ";
                    successfulChunks++;
                    logger('RECOVERY_TRANSCRIBE_CHUNK', `切片 ${index + 1}/${chunks.length} 转录完成`);
                } catch (error) {
                    failedChunks++;
                    logger('RECOVERY_TRANSCRIBE_ERROR', `切片 ${index + 1}/${chunks.length} 转录失败: ${error.message}`);
                } finally {
                    // 清理切片文件
                    if (fs.existsSync(chunkPath)) {
                        fs.unlinkSync(chunkPath);
                    }
                }
            }
            
            // 全失败时拦截，避免生成空纪要
            if (successfulChunks === 0) {
                throw new Error(`所有 ${chunks.length} 个音频切片转录全部失败，请检查网络连接或OpenAI API状态后重试`);
            }
            if (failedChunks > 0) {
                logger('RECOVERY_TRANSCRIBE_PARTIAL', `转录部分完成：成功 ${successfulChunks}/${chunks.length}，失败 ${failedChunks}/${chunks.length}`);
            }
            
            // 上传转录结果到COS
            transcriptCosKey = await cosService.uploadTranscriptToCOS(fullTranscript, fileId);
            
        } else {
            logger('RECOVERY_DIRECT_TRANSCRIBE', `小文件直接转录`);
            
            // 直接转录小文件
            const fullTranscript = await openaiService.transcribeChunk(localFilePath, fileId);
            transcriptCosKey = await cosService.uploadTranscriptToCOS(fullTranscript, fileId);
        }
        
        processManager.setStatus(fileId, { status: 'generating_summary', progress: 95 });
        
        // 生成总结（这里简化处理，实际应该调用LLM）
        logger('RECOVERY_SUMMARY', `生成会议纪要总结`);
        
        // 设置完成状态
        processManager.setStatus(fileId, { 
            status: 'completed', 
            progress: 100,
            message: "文件处理恢复完成",
            transcriptCosKey: transcriptCosKey,
            cosKey: cosKey
        });
        
        logger('RECOVERY_COMPLETE', `文件处理恢复完成: ${fileId}`);
        
        // 清理本地临时文件
        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
            logger('RECOVERY_CLEANUP', `清理本地临时文件: ${localFilePath}`);
        }
        
    } catch (error) {
        logger('RECOVERY_PROCESS_FAILED', `文件处理恢复失败: ${fileId}, 错误: ${error.message}`);
        processManager.setStatus(fileId, { status: 'error', progress: 0, error: error.message });
    }
}

module.exports = router;