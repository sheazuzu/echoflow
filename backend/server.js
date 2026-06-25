/**
 * EchoFlow 后端服务入口
 * 负责加载配置、启动服务器、初始化邮件服务和状态清理
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { execFile } = require('child_process');
const { app, setEmailTransporter } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const emailService = require('./emailService');
const cosService = require('./services/cosService');
const processManager = require('./utils/processManager');
const { initializeAdminActivityStore } = require('./utils/adminActivityStore');
const { initializeUserStore } = require('./utils/userStore');
const { getPool, closePool } = require('./utils/db');

// 全局错误处理器，防止进程崩溃
process.on('uncaughtException', (error) => {
    logger.error('UNCAUGHT_EXCEPTION', {
        error: error && error.message,
        code: error && error.code,
        stack: error && error.stack,
    });

    if (error && error.code === 'EPIPE') {
        logger.warn('NETWORK_ERROR', {
            reason: 'EPIPE',
            message: '网络连接错误(EPIPE)，继续运行服务',
        });
    } else {
        logger.warn('UNCAUGHT_ERROR_HANDLED', {
            message: '其他未捕获错误，继续运行服务',
        });
    }
});

process.on('unhandledRejection', (reason, promise) => {
    const isError = reason instanceof Error;
    logger.error('UNHANDLED_REJECTION', {
        reason: isError ? reason.message : String(reason),
        stack: isError ? reason.stack : undefined,
    });
    logger.warn('REJECTION_HANDLED', {
        message: 'Promise拒绝已处理，继续运行服务',
    });
});

async function startServer() {
    logger.info('APPLICATION_STARTED', {
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        port: config.PORT,
    });

    // [FAIL-FAST] MySQL 配置缺失则直接退出，避免带病运行
    if (config.mysql && config.mysql.incomplete) {
        logger.error('DB_CONFIG_FATAL', {
            message: 'MySQL 配置不完整，进程立即退出（fail-fast）',
            missingEnvVars: config.mysql.missingEnvVars || [],
            host: config.mysql.host,
            database: config.mysql.database,
            user: config.mysql.user,
            hasPassword: Boolean(config.mysql.password),
        });
        process.exit(1);
    }

    // [FAIL-FAST] 启动期主动建立连接并执行 SELECT 1 健康检查
    try {
        const pool = getPool();
        const [rows] = await pool.query('SELECT 1 AS ok');
        const ok = Array.isArray(rows) && rows[0] && (rows[0].ok === 1 || rows[0].ok === '1');
        if (!ok) {
            throw new Error('SELECT 1 返回异常');
        }
        logger.info('DB_CONNECTED', {
            message: 'MySQL 连接已建立并通过健康检查',
            host: config.mysql.host,
            port: config.mysql.port,
            database: config.mysql.database,
            user: config.mysql.user,
        });
    } catch (error) {
        logger.error('DB_CONNECT_FAILED', {
            message: 'MySQL 启动期健康检查失败，进程立即退出',
            host: config.mysql.host,
            port: config.mysql.port,
            database: config.mysql.database,
            user: config.mysql.user,
            error: error && error.message,
            code: error && error.code,
            errno: error && error.errno,
            stack: error && error.stack,
        });
        try {
            await closePool();
        } catch (_) {
            // ignore close error during fatal exit
        }
        process.exit(1);
    }

    // 检测 yt-dlp 可用性（视频链接转录功能依赖）
    if (config.videoUrl && config.videoUrl.featureEnabled) {
        execFile(config.videoUrl.ytDlpBinary || 'yt-dlp', ['--version'], { timeout: 5000 }, (err, stdout) => {
            if (err) {
                logger.warn('YT_DLP_CHECK_FAILED', {
                    message: 'yt-dlp 不可用，视频链接转录功能将无法正常工作',
                    error: err.message,
                    binary: config.videoUrl.ytDlpBinary || 'yt-dlp',
                    hint: '请确保已安装 yt-dlp（pip install yt-dlp 或 apk add yt-dlp）',
                });
            } else {
                logger.info('YT_DLP_CHECK_OK', {
                    message: 'yt-dlp 已就绪',
                    version: String(stdout).trim(),
                });
            }
        });
    } else {
        logger.info('YT_DLP_CHECK_SKIPPED', {
            message: '视频链接转录功能未启用，跳过 yt-dlp 检查',
        });
    }

    const emailTransporter = emailService.createTransporter();
    setEmailTransporter(emailTransporter);

    processManager.startCleanupTimer();

    const adminStoreFile = initializeAdminActivityStore();
    logger.info('ADMIN_ACTIVITY_STORE_READY', {
        file: adminStoreFile,
    });

    const authStoreState = await initializeUserStore();
    logger.info('AUTH_USER_STORE_READY', authStoreState);

    app.listen(config.PORT, async () => {
        logger.info('SERVER_LISTENING', {
            message: 'EchoFlow 后端服务已启动',
            url: `http://localhost:${config.PORT}`,
            port: config.PORT,
        });

        logger.info('SMTP_CHECK_START', { message: '正在测试SMTP服务器连通性...' });
        const smtpTestResult = await emailService.testSMTPConnection(emailTransporter);

        if (smtpTestResult.success) {
            logger.info('SMTP_CHECK_OK', { message: smtpTestResult.message });
        } else {
            logger.error('SMTP_CHECK_FAILED', {
                message: smtpTestResult.message,
                hint: '邮件发送功能将不可用，请检查.env文件中的SMTP配置',
            });
        }

        logger.info('COS_CHECK_START', { message: '正在测试COS连接连通性...' });
        const cosTestResult = await cosService.checkCOSConnection();

        if (cosTestResult.success) {
            logger.info('COS_CHECK_OK', { message: cosTestResult.message });
        } else {
            logger.error('COS_CHECK_FAILED', {
                message: cosTestResult.message,
                hint: 'COS上传功能将不可用，将回退到本地文件存储模式',
            });
        }
    });
}

startServer().catch((error) => {
    logger.error('SERVER_START_FAILED', error);
    process.exit(1);
});