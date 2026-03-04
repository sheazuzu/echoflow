/**
 * Multer 文件上传中间件配置
 * 使用磁盘存储，避免大文件导致内存溢出
 */

const multer = require('multer');
const path = require('path');
const { getUploadDir } = require('../utils/fileHelper');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, getUploadDir());
    },
    filename: function (req, file, cb) {
        // 使用时间戳 + 随机数 + 原始扩展名，避免文件名冲突
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E6);
        const ext = path.extname(file.originalname);
        cb(null, `tmp_${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024,  // 500MB 上传大小限制
    }
});

module.exports = upload;
