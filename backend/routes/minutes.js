/**
 * 会议纪要和转录结果路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const logger = require('../utils/logger');
const processManager = require('../utils/processManager');
const cosService = require('../services/cosService');

// 获取会议纪要数据接口
router.get('/minutes/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const status = processManager.getStatus(fileId);
    
    logger('MINUTES_QUERY', `收到会议纪要获取请求: ${fileId}`);
    
    if (!status) {
        logger('MINUTES_ERROR', `会议纪要获取失败: 文件处理状态未找到: ${fileId}`);
        return res.status(404).json({ message: "文件处理状态未找到" });
    }
    
    if (status.status !== 'completed') {
        logger('MINUTES_WARN', `会议纪要获取失败: 文件处理尚未完成: ${fileId}, 当前状态: ${status.status}`);
        return res.status(400).json({ message: "文件处理尚未完成" });
    }
    
    if (!status.minutesData) {
        logger('MINUTES_ERROR', `会议纪要获取失败: 纪要数据未找到: ${fileId}`);
        return res.status(404).json({ message: "会议纪要数据未找到" });
    }
    
    logger('MINUTES_SUCCESS', `会议纪要获取成功: ${fileId}`);
    res.json({
        fileId,
        status: status.status,
        minutesData: status.minutesData,
        transcript: status.transcript
    });
});

// 获取转录结果接口
router.get('/transcript/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const status = processManager.getStatus(fileId);
    
    logger('TRANSCRIPT_QUERY', `收到转录结果获取请求: ${fileId}`);
    
    if (!status) {
        logger('TRANSCRIPT_ERROR', `转录结果获取失败: 文件处理状态未找到: ${fileId}`);
        return res.status(404).json({ message: "文件处理状态未找到" });
    }
    
    if (status.status !== 'completed') {
        logger('TRANSCRIPT_WARN', `转录结果获取失败: 文件处理尚未完成: ${fileId}, 当前状态: ${status.status}`);
        return res.status(400).json({ message: "文件处理尚未完成" });
    }
    
    if (!status.transcriptCosKey) {
        logger('TRANSCRIPT_ERROR', `转录结果获取失败: COS键未找到: ${fileId}`);
        return res.status(404).json({ message: "转录结果未找到" });
    }
    
    try {
        // 如果转录结果存储在COS中，从COS下载
        if (status.transcriptCosKey.startsWith('transcripts/')) {
            const localFilePath = await cosService.downloadFromCOS(status.transcriptCosKey);
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
        logger('TRANSCRIPT_ERROR', `获取转录结果失败: ${fileId}, 错误: ${error.message}`);
        logger('TRANSCRIPT_ERROR', `错误堆栈: ${error.stack}`);
        res.status(500).json({ message: "获取转录结果失败", error: error.message });
    }
});

module.exports = router;
