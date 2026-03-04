/**
 * 进度查询和取消处理路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const processManager = require('../utils/processManager');

// 进度查询接口
router.get('/progress/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const status = processManager.getStatus(fileId);
    
    if (!status) {
        logger('PROGRESS_QUERY', `进度查询失败: 文件ID ${fileId} 的状态未找到`);
        return res.status(404).json({ message: "文件处理状态未找到" });
    }
    
    // 只在状态或进度发生变化时才打印日志，避免每秒轮询刷屏
    const currentKey = `${status.status}_${status.progress}_${status.currentChunk || 0}_${status.error || ''}`;
    const lastKey = processManager.getLastProgressLog(fileId);
    if (currentKey !== lastKey) {
        processManager.setLastProgressLog(fileId, currentKey);
        logger('PROGRESS_QUERY', `${fileId} -> 状态: ${status.status}, 进度: ${status.progress}%`);
        
        if (status.currentChunk && status.totalChunks) {
            logger('PROGRESS_DETAIL', `转录进度: ${status.currentChunk}/${status.totalChunks} 个切片`);
        }
        
        if (status.error) {
            logger('PROGRESS_ERROR', `文件处理错误: ${status.error}`);
        }
    }
    
    // 处理完成或失败时清理缓存
    if (status.status === 'completed' || status.status === 'error' || status.status === 'cancelled') {
        processManager.setLastProgressLog(fileId, undefined);
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
router.post('/cancel/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    
    logger('CANCEL_REQUEST', `收到取消处理请求，文件ID: ${fileId}`);
    
    const status = processManager.getStatus(fileId);
    
    if (!status) {
        logger('CANCEL_ERROR', `取消失败: 文件处理状态未找到: ${fileId}`);
        return res.status(404).json({ 
            code: 404,
            message: "文件处理状态未找到",
            fileId: fileId
        });
    }
    
    logger('CANCEL_INFO', `当前处理状态: ${status.status}, 进度: ${status.progress}%`);
    
    // 检查是否已经完成或已取消
    if (status.status === 'completed') {
        logger('CANCEL_ERROR', `取消失败: 文件处理已完成，无法取消: ${fileId}`);
        return res.status(400).json({
            code: 400,
            message: "文件处理已完成，无法取消",
            fileId: fileId
        });
    }
    
    if (status.status === 'cancelled') {
        logger('CANCEL_INFO', `文件处理已经被取消: ${fileId}`);
        return res.json({
            code: 200,
            message: "文件处理已经被取消",
            fileId: fileId
        });
    }
    
    // 标记为已取消
    processManager.setStatus(fileId, { 
        status: 'cancelled', 
        progress: 0, 
        error: '用户取消了处理',
        cancelledAt: new Date().toISOString()
    });
    
    logger('CANCEL_PROCESS', `已标记文件处理状态为取消: ${fileId}`);
    
    // 强制终止正在运行的进程
    const activeProcess = processManager.getProcess(fileId);
    if (activeProcess) {
        logger('CANCEL_PROCESS_DETAIL', `发现活动进程需要终止: ${fileId}，进程类型: ${activeProcess.type}`);
        logger('CANCEL_PROCESS_INFO', `进程启动时间: ${activeProcess.startTime}`);
        
        if (activeProcess.process && activeProcess.process.kill) {
            try {
                logger('PROCESS_TERMINATE', `开始终止进程: ${fileId}, 进程类型: ${activeProcess.type}`);
                
                // 终止进程（FFmpeg等）
                activeProcess.process.kill('SIGTERM');
                logger('PROCESS_TERMINATE_SUCCESS', `已发送 SIGTERM 信号给进程: ${fileId}`);
                
                // 如果进程在2秒内没有终止，强制杀死
                setTimeout(() => {
                    if (activeProcess.process && !activeProcess.process.killed) {
                        activeProcess.process.kill('SIGKILL');
                        logger('PROCESS_TERMINATE_FORCE', `已发送 SIGKILL 信号强制终止进程: ${fileId}`);
                    }
                }, 2000);
            } catch (killError) {
                logger('PROCESS_TERMINATE_ERROR', `终止进程失败: ${fileId}, 错误: ${killError.message}`);
                logger('PROCESS_TERMINATE_ERROR_DETAIL', `错误堆栈: ${killError.stack}`);
            }
        }
        
        // 清理进程跟踪
        processManager.removeProcess(fileId);
        logger('PROCESS_CLEANUP', `已清理进程跟踪: ${fileId}`);
    } else {
        logger('PROCESS_INFO', `没有找到活动进程: ${fileId}`);
    }
    
    // 清理临时文件（可选，根据需要）
    try {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        const chunksDir = path.join(uploadDir, `${fileId}_chunks`);
        
        // 异步清理，不阻塞响应
        if (fs.existsSync(chunksDir)) {
            fs.rm(chunksDir, { recursive: true, force: true }, (err) => {
                if (err) {
                logger('CANCEL_CLEANUP_ERROR', `清理临时文件失败: ${fileId}, 错误: ${err.message}`);
                } else {
                    logger('CANCEL_CLEANUP_SUCCESS', `已清理临时文件: ${fileId}`);
                }
            });
        }
    } catch (cleanupError) {
        logger('CANCEL_CLEANUP_ERROR', `清理文件时出错: ${fileId}, 错误: ${cleanupError.message}`);
    }
    
    logger('CANCEL_COMPLETE', `用户成功取消了文件处理: ${fileId}`);
    
    res.json({
        code: 200,
        message: "处理已成功取消，正在终止相关进程",
        fileId: fileId,
        cancelledAt: new Date().toISOString()
    });
});

module.exports = router;
