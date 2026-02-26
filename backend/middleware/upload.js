/**
 * Multer 文件上传中间件配置
 * 使用内存存储，供需要文件上传的路由模块共享
 */

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = upload;
