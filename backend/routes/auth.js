const express = require('express');
const router = express.Router();
const userStore = require('../utils/userStore');
const { createSessionToken } = require('../utils/authToken');
const { requireAuth, setAuthCookie, clearAuthCookie } = require('../middleware/auth');

function sendAuthenticatedResponse(req, res, user, statusCode = 200) {
    const token = createSessionToken(user);
    setAuthCookie(req, res, token);

    res.status(statusCode).json({
        success: true,
        user,
        token,
    });
}

router.post('/auth/register', express.json(), async (req, res, next) => {
    try {
        const user = await userStore.createUser({
            email: req.body?.email,
            password: req.body?.password,
            name: req.body?.name,
        });

        sendAuthenticatedResponse(req, res, user, 201);
    } catch (error) {
        next(error);
    }
});

router.post('/auth/login', express.json(), async (req, res, next) => {
    try {
        const user = await userStore.authenticateUser(req.body?.email, req.body?.password);
        sendAuthenticatedResponse(req, res, user);
    } catch (error) {
        next(error);
    }
});

router.post('/auth/logout', (req, res) => {
    clearAuthCookie(req, res);
    res.json({
        success: true,
        message: '已退出登录',
    });
});

router.get('/auth/me', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: req.auth.user,
    });
});

module.exports = router;
