/**
 * 文件操作辅助模块
 * 提供目录管理、临时文件清理等功能
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// 上传目录路径
const uploadDir = path.join(__dirname, '..', 'uploads');
// 切片目录路径
const splitDir = path.join(uploadDir, 'splits');

/**
 * 确保指定目录存在，如果不存在则创建
 * @param {string} dir - 目录路径
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * 确保上传和切片目录存在
 */
function ensureUploadDirs() {
    ensureDir(uploadDir);
    ensureDir(splitDir);
}

/**
 * 获取上传目录路径
 * @returns {string}
 */
function getUploadDir() {
    return uploadDir;
}

/**
 * 获取切片目录路径
 * @returns {string}
 */
function getSplitDir() {
    return splitDir;
}

/**
 * 清理过期的临时文件
 * @param {string} dir - 要清理的目录
 * @param {string} prefix - 文件名前缀（如 'temp_'）
 * @param {number} maxAgeMs - 最大保留时间（毫秒），默认 30 分钟
 */
function cleanExpiredTempFiles(dir, prefix = 'temp_', maxAgeMs = 30 * 60 * 1000) {
    try {
        const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix));
        const now = Date.now();
        files.forEach(f => {
            const filePath = path.join(dir, f);
            try {
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    logger('CLEANUP', `已清理过期临时文件: ${f}`);
                }
            } catch (err) {
                // 忽略单个文件清理错误
            }
        });
    } catch (err) {
        // 忽略目录读取错误
    }
}

module.exports = {
    ensureDir,
    ensureUploadDirs,
    getUploadDir,
    getSplitDir,
    cleanExpiredTempFiles
};
