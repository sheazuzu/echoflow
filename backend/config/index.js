/**
 * 集中化配置管理模块
 * 从 .env 文件和环境变量中加载所有配置项
 */

const logger = require('../utils/logger');

function normalizeAuthCookieSameSite(value) {
    const normalized = String(value || 'lax').trim().toLowerCase();
    if (['lax', 'strict', 'none'].includes(normalized)) {
        return normalized;
    }

    logger.warn('CONFIG_INVALID_AUTH_COOKIE_SAME_SITE', {
        message: 'AUTH_COOKIE_SAME_SITE 配置无效，已回退到 lax',
        provided: value,
        supported: ['lax', 'strict', 'none'],
    });
    return 'lax';
}

function normalizeAuthCookieSecure(value) {
    const normalized = String(value || 'auto').trim().toLowerCase();
    if (['auto', 'always', 'never'].includes(normalized)) {
        return normalized;
    }

    logger.warn('CONFIG_INVALID_AUTH_COOKIE_SECURE', {
        message: 'AUTH_COOKIE_SECURE 配置无效，已回退到 auto',
        provided: value,
        supported: ['auto', 'always', 'never'],
    });
    return 'auto';
}

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
    'http://localhost:5173',
    'https://localhost',
    'http://localhost',
    'https://echoflow.zhenyuxie.com',
    'https://meetandnote.com'
];

const corsOptions = {
    origin: function (origin, callback) {
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
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id', 'X-Client-Label']
};

// 服务端口
const PORT = process.env.PORT || 3000;

// 视频 URL 转录功能配置（YouTube / Bilibili）
function normalizeBoolean(value, defaultValue) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const v = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    return defaultValue;
}

const videoUrlConfig = {
    featureEnabled: normalizeBoolean(process.env.VIDEO_URL_FEATURE_ENABLED, true),
    maxDurationSeconds: Number(process.env.VIDEO_URL_MAX_DURATION_SECONDS || 14400),
    maxTasksPerHour: Number(process.env.VIDEO_URL_MAX_TASKS_PER_HOUR || 5),
    maxFileSizeMB: Number(process.env.VIDEO_URL_MAX_FILE_SIZE_MB || 500),
    ytDlpTimeoutMs: Number(process.env.YT_DLP_TIMEOUT_MS || 600000),
    cookiesFile: process.env.YT_DLP_COOKIES_FILE || '',
    ytDlpBinary: process.env.YT_DLP_BINARY || 'yt-dlp',
};

const adminConfig = {
    password: process.env.ADMIN_PASSWORD || '',
    sessionSecret: process.env.ADMIN_SESSION_SECRET || '',
    sessionTtlHours: Number(process.env.ADMIN_SESSION_TTL_HOURS || 12),
    cookieName: process.env.ADMIN_COOKIE_NAME || 'echoflow_admin_session'
};

const mysqlConfig = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || '',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || '',
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    queueLimit: Number(process.env.MYSQL_QUEUE_LIMIT || 0),
    charset: process.env.MYSQL_CHARSET || 'utf8mb4',
    timezone: process.env.MYSQL_TIMEZONE || 'Z',
};

const isMysqlConfigured = !!(mysqlConfig.host && mysqlConfig.user && mysqlConfig.database);
if (!isMysqlConfigured) {
    logger.warn('CONFIG_MYSQL_INCOMPLETE', {
        message: 'MySQL 配置不完整，认证存储初始化时将失败',
        required_env: [
            'MYSQL_HOST (可选，默认 127.0.0.1)',
            'MYSQL_PORT (可选，默认 3306)',
            'MYSQL_USER',
            'MYSQL_PASSWORD (可选)',
            'MYSQL_DATABASE',
        ],
    });
}

const authConfig = {
    cookieName: process.env.AUTH_COOKIE_NAME || 'echoflow_user_session',
    cookieSameSite: normalizeAuthCookieSameSite(process.env.AUTH_COOKIE_SAME_SITE),
    cookieSecure: normalizeAuthCookieSecure(process.env.AUTH_COOKIE_SECURE),
    sessionSecret: process.env.AUTH_SESSION_SECRET || '',
    sessionTtlHours: Number(process.env.AUTH_SESSION_TTL_HOURS || 168),
    resetTokenTtlMinutes: Number(process.env.AUTH_RESET_TOKEN_TTL_MINUTES || 30),
    exposeResetToken: process.env.AUTH_EXPOSE_RESET_TOKEN === 'true' || process.env.NODE_ENV !== 'production',
    maxFailedAttempts: Number(process.env.AUTH_MAX_FAILED_ATTEMPTS || 5),
    failedLoginWindowMinutes: Number(process.env.AUTH_FAILED_LOGIN_WINDOW_MINUTES || 15),
    lockoutMinutes: Number(process.env.AUTH_LOCKOUT_MINUTES || 15),
    defaultRole: process.env.AUTH_DEFAULT_ROLE || 'user',
    passwordSaltLength: Number(process.env.AUTH_PASSWORD_SALT_LENGTH || 16),
    passwordKeyLength: Number(process.env.AUTH_PASSWORD_KEY_LENGTH || 64),
};

module.exports = {
    PORT,
    apiKey,
    cosConfig,
    isCosConfigured,
    allowedOrigins,
    corsOptions,
    admin: adminConfig,
    auth: authConfig,
    mysql: mysqlConfig,
    isMysqlConfigured,
    videoUrl: videoUrlConfig,
};
