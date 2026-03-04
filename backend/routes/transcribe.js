/**
 * 实时转录和会议记录生成路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const upload = require('../middleware/upload');
const { getUploadDir, cleanExpiredTempFiles } = require('../utils/fileHelper');
const openaiService = require('../services/openaiService');

// 实时转录API端点
router.post('/transcribe/stream', upload.single('audio'), async (req, res) => {
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const uploadDir = getUploadDir();
    
    // 记录请求来源
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    logger('TRANSCRIBE', `[${requestId}] 收到转录请求，来源: ${origin}`);
    
    if (!req.file) {
        logger('TRANSCRIBE', `[${requestId}] ❌ 失败：未收到音频文件`);
        return res.status(400).json({ 
            success: false,
            message: "未上传音频文件",
            requestId
        });
    }

    // diskStorage模式下，文件已保存到磁盘，直接使用文件路径
    const tmpFilePath = req.file.path;
    const audioSize = (req.file.size / 1024).toFixed(2); // KB
    const language = req.body.language || 'auto'; // 支持语言参数
    
    logger('TRANSCRIBE', `[${requestId}] 📥 接收音频段: ${audioSize}KB, 语言: ${language}, MIME类型: ${req.file.mimetype}, 临时文件: ${req.file.filename}`);

    try {
        logger('TRANSCRIBE', `[${requestId}] 🔄 调用 Whisper API...`);
        
        const result = await openaiService.transcribeStream(null, language, tmpFilePath, true);
        
        const textPreview = result.text.length > 50 
            ? result.text.substring(0, 50) + '...' 
            : result.text;
        logger('TRANSCRIBE', `[${requestId}] ✅ 转录完成: "${textPreview}", 耗时: ${result.duration}s`);
        logger('TRANSCRIBE', `[${requestId}] 🗑️ 已清理临时文件`);
        
        // 构建响应对象
        const responseData = {
            success: true,
            text: result.text,
            language: language,
            duration: result.duration,
            requestId
        };
        
        logger('TRANSCRIBE', `[${requestId}] 📤 发送响应: ${JSON.stringify(responseData).substring(0, 100)}...`);
        res.json(responseData);
        
    } catch (error) {
        logger('REALTIME_TRANSCRIBE_ERROR', `[${requestId}] 实时转录失败: ${error.message}`);
        console.error(`[${requestId}] 详细错误信息:`, error);
        
        // 记录更详细的错误信息
        if (error.response) {
            logger('REALTIME_TRANSCRIBE_ERROR', `[${requestId}] API 响应错误: ${JSON.stringify(error.response.data)}`);
        }
        if (error.code) {
            logger('REALTIME_TRANSCRIBE_ERROR', `[${requestId}] 错误代码: ${error.code}`);
        }
        
        // 清理multer临时文件（不影响错误响应）
        try {
            if (tmpFilePath && fs.existsSync(tmpFilePath)) {
                fs.unlinkSync(tmpFilePath);
                logger('TRANSCRIBE', `[${requestId}] 🗑️ 清理临时文件: ${path.basename(tmpFilePath)}`);
            }
        } catch (cleanupError) {
            logger('REALTIME_TRANSCRIBE_WARN', `[${requestId}] 清理临时文件失败: ${cleanupError.message}`);
        }
        
        // 构建错误响应
        const errorResponse = {
            success: false,
            message: "转录失败",
            error: error.message || 'Unknown error',
            errorCode: error.code || 'UNKNOWN_ERROR',
            requestId
        };
        
        logger('REALTIME_TRANSCRIBE_ERROR', `[${requestId}] 发送错误响应: ${JSON.stringify(errorResponse)}`);
        
        // 确保返回JSON响应
        if (!res.headersSent) {
            res.status(500).json(errorResponse);
        }
    }
});

// 生成会议记录API端点
router.post('/generate-meeting-summary', express.json(), async (req, res) => {
    const { transcript } = req.body;

    if (!transcript) {
        logger('SUMMARY_ERROR', '会议记录生成失败：未提供转录文字');
        return res.status(400).json({
            success: false,
            message: "未提供转录文字"
        });
    }

    if (transcript.length < 100) {
        logger('SUMMARY_ERROR', `会议记录生成失败：转录文字太短(${transcript.length}字符，最少需要100字符)`);
        return res.status(400).json({
            success: false,
            message: "转录文字太短，无法生成有效的会议记录"
        });
    }

    logger('SUMMARY_API_START', `开始通过API生成会议记录，转录文字长度: ${transcript.length} 字符`);
    logger('SUMMARY_API_DETAIL', `转录文本预览: ${transcript.substring(0, 150)}${transcript.length > 150 ? '...' : ''}`);

    try {
        const result = await openaiService.generateMeetingSummary(transcript);

        logger('SUMMARY_API_SUCCESS', `会议记录生成完成，耗时: ${result.duration}s`);

        res.json({
            success: true,
            summary: result.summary,
            duration: result.duration
        });

    } catch (error) {
        logger('SUMMARY_API_ERROR', `生成会议记录失败: ${error.message}`);
        logger('SUMMARY_API_ERROR', `错误堆栈: ${error.stack}`);
        console.error(error);

        res.status(500).json({
            success: false,
            message: "生成会议记录失败",
            error: error.message
        });
    }
});

module.exports = router;
