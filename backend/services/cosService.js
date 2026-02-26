/**
 * 腾讯云 COS 服务模块
 * 封装所有 COS 相关操作：上传、下载、降级到本地存储
 */

const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
const logger = require('../utils/logger');
const config = require('../config');
const { getUploadDir } = require('../utils/fileHelper');

// 初始化COS客户端
const cos = new COS({
    SecretId: config.cosConfig.SecretId,
    SecretKey: config.cosConfig.SecretKey,
    Region: config.cosConfig.Region
});

/**
 * 上传文件到COS桶
 * COS配置不完整时自动降级到本地存储
 * @param {Buffer} fileBuffer - 文件内容
 * @param {string} fileName - 文件名
 * @returns {Promise<string>} COS对象键或本地文件路径
 */
const uploadToCOS = (fileBuffer, fileName) => {
    return new Promise((resolve, reject) => {
        const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
        const uploadDir = getUploadDir();
        
        if (!config.isCosConfigured) {
            // COS配置不完整，使用本地存储模式
            logger('COS_INFO', `COS配置不完整，使用本地存储模式: ${fileName} (${fileSizeMB}MB)`);
            const localFilePath = path.join(uploadDir, fileName);
            fs.writeFileSync(localFilePath, fileBuffer);
            logger('COS_SUCCESS', `文件已保存到本地: ${localFilePath}`);
            resolve(localFilePath);
            return;
        }
        
        // 录音文件存储在单独的 audio-recordings 文件夹
        const cosKey = `audio-recordings/${fileName}`;
        
        logger('COS_UPLOAD', `开始上传文件到COS: ${fileName} (${fileSizeMB}MB) -> ${cosKey}`);
        
        cos.putObject({
            Bucket: config.cosConfig.Bucket,
            Region: config.cosConfig.Region,
            Key: cosKey,
            Body: fileBuffer,
            ContentLength: fileBuffer.length
        }, (err, data) => {
            if (err) {
                logger('COS_ERROR', `上传到COS失败: ${err.message}，文件: ${fileName}`);
                logger('COS_INFO', `回退到本地存储模式`);
                // 上传失败时回退到本地存储
                const localFilePath = path.join(uploadDir, fileName);
                fs.writeFileSync(localFilePath, fileBuffer);
                logger('COS_SUCCESS', `文件已保存到本地: ${localFilePath}`);
                resolve(localFilePath);
            } else {
                logger('COS_SUCCESS', `文件已成功上传到COS: ${cosKey}，ETag: ${data.ETag}`);
                resolve(cosKey); // 返回COS对象键
            }
        });
    });
};

/**
 * 上传转录结果到COS桶
 * @param {string} transcriptText - 转录文本内容
 * @param {string} fileName - 文件名
 * @returns {Promise<string>} COS对象键或本地文件路径
 */
const uploadTranscriptToCOS = (transcriptText, fileName) => {
    return new Promise((resolve, reject) => {
        const uploadDir = getUploadDir();
        
        if (!config.isCosConfigured) {
            // COS配置不完整，使用本地存储模式
            const localFilePath = path.join(uploadDir, fileName + '_transcript.txt');
            fs.writeFileSync(localFilePath, transcriptText);
            resolve(localFilePath);
            return;
        }
        
        const cosKey = `transcripts/${fileName}_transcript.txt`;
        
        cos.putObject({
            Bucket: config.cosConfig.Bucket,
            Region: config.cosConfig.Region,
            Key: cosKey,
            Body: transcriptText,
            ContentLength: transcriptText.length
        }, (err, data) => {
            if (err) {
                logger('COS_ERROR', `转录结果上传到COS失败: ${err.message}`);
                // 上传失败时回退到本地存储
                const localFilePath = path.join(uploadDir, fileName + '_transcript.txt');
                fs.writeFileSync(localFilePath, transcriptText);
                resolve(localFilePath);
            } else {
                logger('COS_SUCCESS', `转录结果已上传到COS: ${cosKey}`);
                resolve(cosKey); // 返回COS对象键
            }
        });
    });
};

/**
 * 从COS下载文件到本地临时文件
 * @param {string} cosKey - COS对象键或本地文件路径
 * @returns {Promise<string>} 本地文件路径
 */
const downloadFromCOS = (cosKey) => {
    return new Promise((resolve, reject) => {
        const uploadDir = getUploadDir();
        
        // 判断是否为COS路径（audio-recordings/ 或 uploads/ 或 transcripts/）
        if (!cosKey.startsWith('audio-recordings/') && !cosKey.startsWith('uploads/') && !cosKey.startsWith('transcripts/')) {
            // 如果是本地文件路径，直接返回
            logger('COS_INFO', `检测到本地文件路径，直接返回: ${cosKey}`);
            resolve(cosKey);
            return;
        }
        
        const fileName = path.basename(cosKey);
        const localFilePath = path.join(uploadDir, fileName);
        
        logger('COS_DOWNLOAD', `开始从COS下载文件: ${cosKey} -> ${localFilePath}`);
        
        cos.getObject({
            Bucket: config.cosConfig.Bucket,
            Region: config.cosConfig.Region,
            Key: cosKey
        }, (err, data) => {
            if (err) {
                logger('COS_ERROR', `从COS下载失败: ${err.message}，文件: ${cosKey}`);
                logger('COS_ERROR', `错误详情: ${JSON.stringify(err)}`);
                reject(err);
            } else {
                const fileSizeMB = (data.Body.length / (1024 * 1024)).toFixed(2);
                fs.writeFileSync(localFilePath, data.Body);
                logger('COS_SUCCESS', `文件已从COS下载完成: ${localFilePath} (${fileSizeMB}MB)`);
                logger('COS_DEBUG', `下载详情: ETag=${data.ETag}, ContentLength=${data.ContentLength}`);
                resolve(localFilePath);
            }
        });
    });
};

module.exports = {
    uploadToCOS,
    uploadTranscriptToCOS,
    downloadFromCOS
};
