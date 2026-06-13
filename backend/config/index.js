/**
 * 集中化配置管理模块
 * 从 .env 文件和环境变量中加载所有配置项
 */

const logger = require('../utils/logger');

// OpenAI 配置
const apiKey = process.env.OPENAI_API_KEY || "";

if (!apiKey) {
    logger.error('CONFIG_MISSING_OPENAI_KEY', {
        message: '未检测到 OpenAI API Key',
        hint: '请在项目根目录下创建 .env 文件，内容为: OPENAI_API_KEY=sk-...，或者直接在配置中填入 Key。',
    });
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
    logger.warn('CONFIG_COS_INCOMPLETE', {
        message: '腾讯云COS配置不完整，将使用本地文件存储模式',
        required_env: [
            'COS_SECRET_ID',
            'COS_SECRET_KEY',
            'COS_BUCKET',
            'COS_ENDPOINT',
            'COS_REGION (可选，默认 ap-guangzhou)',
        ],
    });
}

// CORS 配置 - 支持多个来源
const allowedOrigins = [
    'http://localhost:5173',  // 开发环境
    'http://127.0.0.1:5173',  // 开发环境（Vite 本地预览）
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
            logger.warn('CORS_BLOCKED', {
                origin,
                message: 'CORS 阻止了非白名单来源的请求',
            });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,  // 允许携带凭证
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id', 'X-Client-Label']
};

// 服务端口
const PORT = process.env.PORT || 3000;

const adminConfig = {
    password: process.env.ADMIN_PASSWORD || '',
    sessionSecret: process.env.ADMIN_SESSION_SECRET || '',
    sessionTtlHours: Number(process.env.ADMIN_SESSION_TTL_HOURS || 12),
    cookieName: process.env.ADMIN_COOKIE_NAME || 'echoflow_admin_session'
};

module.exports = {
    PORT,
    apiKey,
    cosConfig,
    isCosConfigured,
    allowedOrigins,
    corsOptions,
    admin: adminConfig
};
