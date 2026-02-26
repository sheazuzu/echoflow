/**
 * 集中化配置管理模块
 * 从 .env 文件和环境变量中加载所有配置项
 */

const logger = require('../utils/logger');

// OpenAI 配置
const apiKey = process.env.OPENAI_API_KEY || "";

if (!apiKey) {
    console.error("【启动警告】未检测到 OpenAI API Key！");
    console.error("请在项目根目录下创建 .env 文件，内容为: OPENAI_API_KEY=sk-...");
    console.error("或者直接在 server.js 代码中填入 Key。");
}

// 腾讯云COS配置
const cosConfig = {
    SecretId: process.env.COS_SECRET_ID || "",
    SecretKey: process.env.COS_SECRET_KEY || "",
    Region: process.env.COS_REGION || "ap-guangzhou",
    Bucket: process.env.COS_BUCKET || "",
    Endpoint: process.env.COS_ENDPOINT || ""
};

// 检查COS配置
const isCosConfigured = !!(cosConfig.SecretId && cosConfig.SecretKey && cosConfig.Bucket && cosConfig.Endpoint);
if (!isCosConfigured) {
    console.warn("【COS配置警告】腾讯云COS配置不完整，将使用本地文件存储模式");
    console.warn("请在.env文件中配置以下环境变量：");
    console.warn("COS_SECRET_ID=您的SecretId");
    console.warn("COS_SECRET_KEY=您的SecretKey");
    console.warn("COS_BUCKET=您的存储桶名称");
    console.warn("COS_ENDPOINT=您的COS Endpoint");
    console.warn("COS_REGION=您的存储桶区域（可选，默认ap-guangzhou）");
}

// CORS 配置 - 支持多个来源
const allowedOrigins = [
    'http://localhost:5173',  // 开发环境
    'https://localhost',       // 生产环境（Traefik 反向代理）
    'http://localhost',         // 生产环境（HTTP）
    'https://echoflow.zhenyuxie.com',  // 生产域名
    'https://meetandnote.com'  // 生产域名
];

const corsOptions = {
    origin: function (origin, callback) {
        // 允许没有 origin 的请求（如 Postman、服务器到服务器的请求）
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS 阻止了来自 ${origin} 的请求`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,  // 允许携带凭证
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// 服务端口
const PORT = process.env.PORT || 3000;

module.exports = {
    PORT,
    apiKey,
    cosConfig,
    isCosConfigured,
    allowedOrigins,
    corsOptions
};
