const express = require('express');
const router = express.Router();
const adminActivityStore = require('../utils/adminActivityStore');
const logger = require('../utils/logger');
const {
    buildRequesterMetadata,
    getClientIdentityFromRequest,
} = require('../utils/requestIdentity');

router.get('/admin/session', (req, res) => {
    const identity = getClientIdentityFromRequest(req);

    res.json({
        success: true,
        configured: true,
        authenticated: true,
        actor: {
            clientId: identity.clientId,
            clientLabel: identity.clientLabel,
        },
    });
});

router.post('/admin/login', express.json(), (req, res) => {
    const requester = buildRequesterMetadata(req);

    adminActivityStore.recordAccessActivity({
        action: 'login',
        route: '/api/admin/login',
        success: true,
        reason: 'password_disabled',
        requester,
    });

    res.json({
        success: true,
        configured: true,
        authenticated: true,
        message: '管理员页面已改为免登录访问',
    });
});

router.post('/admin/logout', (req, res) => {
    const requester = buildRequesterMetadata(req);

    adminActivityStore.recordAccessActivity({
        action: 'logout',
        route: '/api/admin/logout',
        success: true,
        requester,
    });

    res.json({
        success: true,
        message: '管理员页面无需退出登录',
    });
});

router.get('/admin/dashboard', (req, res) => {
    const requester = buildRequesterMetadata(req);
    const identity = getClientIdentityFromRequest(req);

    logger('ADMIN_DASHBOARD', `开始加载管理页数据: client=${requester.clientLabel} ip=${requester.ip}`);

    try {
        const dashboardData = adminActivityStore.getDashboardData();

        adminActivityStore.recordAccessActivity({
            action: 'dashboard_view',
            route: '/api/admin/dashboard',
            success: true,
            requester,
        });

        logger(
            'ADMIN_DASHBOARD',
            `管理页数据加载成功: client=${requester.clientLabel} summaries=${dashboardData.summaryRecords?.length || 0} accesses=${dashboardData.accessRecords?.length || 0}`
        );

        res.json({
            success: true,
            configured: true,
            authenticated: true,
            actor: {
                clientId: identity.clientId,
                clientLabel: identity.clientLabel,
            },
            ...dashboardData,
        });
    } catch (error) {
        logger(
            'ADMIN_DASHBOARD_ERROR',
            `管理页数据加载失败: client=${requester.clientLabel} ip=${requester.ip} error=${error.stack || error.message}`
        );

        res.status(500).json({
            success: false,
            message: '管理页数据加载失败，请查看后端日志',
            details: error.message,
        });
    }
});

module.exports = router;