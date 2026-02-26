/**
 * 音频下载路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const logger = require('../utils/logger');
const processManager = require('../utils/processManager');
const cosService = require('../services/cosService');

// 下载音频文件接口
router.get('/audio/:fileId/download', async (req, res) => {
    const fileId = req.params.fileId;
    const status = processManager.getStatus(fileId);
    
    logger('DOWNLOAD_REQUEST', `收到音频文件下载请求: ${fileId}`);
    
    if (!status) {
        logger('DOWNLOAD_ERROR', `下载失败: 文件处理状态未找到: ${fileId}`);
        return res.status(404).json({ message: "文件未找到" });
    }
    
    if (!status.cosKey) {
        logger('DOWNLOAD_ERROR', `下载失败: COS键未找到: ${fileId}`);
        return res.status(404).json({ message: "音频文件未找到" });
    }
    
    try {
        logger('DOWNLOAD_COS', `开始从COS下载音频文件: ${status.cosKey}`);
        
        // 从COS下载文件到本地临时文件
        const localFilePath = await cosService.downloadFromCOS(status.cosKey);
        
        const downloadFileSize = (fs.statSync(localFilePath).size / (1024 * 1024)).toFixed(2);
        logger('DOWNLOAD_READY', `文件下载成功(${downloadFileSize}MB)，准备发送给客户端: ${localFilePath}`);
        
        // 设置响应头
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${fileId}"`);
        
        // 创建读取流并发送文件
        const fileStream = fs.createReadStream(localFilePath);
        
        fileStream.on('error', (error) => {
            logger('DOWNLOAD_ERROR', `文件流读取错误: ${fileId}, 错误: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({ message: "文件读取失败" });
            }
        });
        
        fileStream.on('end', () => {
            logger('DOWNLOAD_SUCCESS', `音频文件发送完成: ${fileId}`);
            // 清理本地临时文件
            try {
                fs.unlinkSync(localFilePath);
                logger('DOWNLOAD_CLEANUP', `下载临时文件已清理: ${localFilePath}`);
            } catch (cleanupError) {
                logger('DOWNLOAD_CLEANUP_ERROR', `清理下载临时文件失败: ${cleanupError.message}`);
            }
        });
        
        // 发送文件流
        fileStream.pipe(res);
        
    } catch (error) {
        logger('DOWNLOAD_ERROR', `下载音频文件失败: ${fileId}, 错误: ${error.message}`);
        logger('DOWNLOAD_ERROR', `错误堆栈: ${error.stack}`);
        if (!res.headersSent) {
            res.status(500).json({ message: "下载失败", error: error.message });
        }
    }
});

module.exports = router;
