/**
 * Express 应用配置
 * 注册中间件、路由和错误处理
 */

const express = require('express');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { attachAuthenticatedUser } = require('./middleware/auth');
const { ensureUploadDirs } = require('./utils/fileHelper');
const { attachClientIdentity } = require('./utils/requestIdentity');

// 路由模块
const healthRoutes = require('./routes/health');
const transcribeRoutes = require('./routes/transcribe');
const uploadRoutes = require('./routes/upload');
const progressRoutes = require('./routes/progress');
const minutesRoutes = require('./routes/minutes');
const audioRoutes = require('./routes/audio');
const emailRoutes = require('./routes/email');
const feedbackRoutes = require('./routes/feedback');
const recoveryRoutes = require('./routes/recovery');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const videoUrlRoutes = require('./routes/videoUrl');

// 创建 Express 应用
const app = express();

// 确保上传目录存在
ensureUploadDirs();

// 注册中间件
app.use(cors(config.corsOptions));
app.use(express.json());
app.use(requestLogger);
app.use(attachClientIdentity);
app.use(attachAuthenticatedUser);

// 注册路由
app.use('/api', healthRoutes);
app.use('/api', transcribeRoutes);
app.use('/api', uploadRoutes);
app.use('/api', progressRoutes);
app.use('/api', minutesRoutes);
app.use('/api', audioRoutes);
app.use('/api', emailRoutes.router);
app.use('/api', feedbackRoutes.router);
app.use('/api', recoveryRoutes);
app.use('/api', adminRoutes);
app.use('/api', authRoutes);
app.use('/api', historyRoutes);
app.use('/api', videoUrlRoutes);

// 注册错误处理中间件（必须在路由之后）
app.use(errorHandler);

/**
 * 注入邮件传输器到需要的路由模块
 * @param {object} transporter - nodemailer 传输器
 */
function setEmailTransporter(transporter) {
    emailRoutes.setTransporter(transporter);
    feedbackRoutes.setTransporter(transporter);
}

module.exports = { app, setEmailTransporter };