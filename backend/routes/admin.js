const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getPoolStatus, pingPool } = require('../utils/db');

router.get('/admin/session', requireAdmin, (req, res) => {
    res.json({
        success: true,
        configured: true,
        authenticated: true,
        actor: {
            id: req.auth.user.id,
            email: req.auth.user.email,
            displayName: req.auth.user.displayName,
            role: req.auth.user.role,
        },
    });
});

router.post('/admin/login', (req, res) => {
    res.status(410).json({
        success: false,
        message: '管理员页面已切换为账号权限控制，请使用管理员账号登录',
    });
});

router.post('/admin/logout', (req, res) => {
    res.status(410).json({
        success: false,
        message: '管理员页面已切换为账号权限控制，请直接退出当前账号',
    });
});

/**
 * GET /api/admin/diagnostics/db
 * admin 专用：返回当前 MySQL 连接池元信息与 ping 探针结果
 * 设计目标：让运维快速确认后端真正连接的数据库实例与库名，避免再去 docker exec 翻 env
 */
router.get('/admin/diagnostics/db', requireAdmin, async (req, res) => {
    const status = getPoolStatus();
    const ping = await pingPool(5000);

    if (!ping.ok) {
        logger.warn('DB_DIAGNOSTICS_PING_FAILED', {
            message: 'admin 诊断接口探测 MySQL 失败',
            host: status.host,
            port: status.port,
            database: status.database,
            error: ping.error,
            code: ping.code,
        });
    }

    res.json({
        success: true,
        host: status.host,
        port: status.port,
        database: status.database,
        user: status.user,
        hasPassword: status.hasPassword,
        poolSize: status.poolSize,
        configured: status.configured,
        initialized: status.initialized,
        ping: ping.ok ? 'ok' : 'fail',
        pingDurationMs: ping.durationMs,
        pingError: ping.ok ? null : ping.error,
        serverVersion: ping.serverVersion,
        currentSchema: ping.currentSchema,
    });
});

module.exports = router;