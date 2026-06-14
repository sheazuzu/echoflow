const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');

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

module.exports = router;