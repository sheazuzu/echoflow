const express = require('express');
const router = express.Router();
const config = require('../config');
const userStore = require('../utils/userStore');
const {
    createPasswordHash,
    verifyPassword,
    createUserSessionToken,
    createSessionCookieOptions,
    clearSessionCookie,
    toPublicUser,
    maskEmail,
} = require('../utils/userAuth');
const { requireAuth, buildAuthenticatedRequester, createHttpError } = require('../middleware/auth');

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validatePassword(password) {
    const value = String(password || '');
    if (value.length < 8) {
        return '密码长度至少为 8 位';
    }

    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
        return '密码需同时包含字母和数字';
    }

    return '';
}

function issueSession(res, req, user) {
    const token = createUserSessionToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        clientId: req.clientIdentity?.clientId || null,
    });

    res.cookie(config.auth.cookieName, token, createSessionCookieOptions(req));
    return token;
}

router.post('/auth/register', async (req, res, next) => {
    try {
        const email = userStore.normalizeEmail(req.body?.email);
        const displayName = userStore.normalizeDisplayName(req.body?.displayName, email);
        const password = String(req.body?.password || '');

        if (!email || !password) {
            throw createHttpError(400, '邮箱和密码均为必填项', 'INVALID_REGISTER_PAYLOAD');
        }

        if (!isValidEmail(email)) {
            throw createHttpError(400, '邮箱格式不正确', 'INVALID_EMAIL');
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            throw createHttpError(400, passwordError, 'INVALID_PASSWORD');
        }

        const user = await userStore.createUser({
            email,
            displayName,
            passwordHash: createPasswordHash(password),
        });

        await userStore.recordAuditLog({
            action: 'register',
            success: true,
            userId: user.id,
            account: email,
            requester: buildAuthenticatedRequester(req),
        });

        await userStore.markUserLoginSuccess(user.id);
        const loggedInUser = await userStore.findUserById(user.id);
        issueSession(res, req, loggedInUser);

        res.status(201).json({
            success: true,
            authenticated: true,
            user: toPublicUser(loggedInUser),
            message: '注册成功，已自动登录',
        });
    } catch (error) {
        if (error.code === 'EMAIL_ALREADY_EXISTS') {
            next(createHttpError(409, '该邮箱已被注册', error.code));
            return;
        }
        next(error);
    }
});

router.post('/auth/login', async (req, res, next) => {
    try {
        const email = userStore.normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');
        const requester = buildAuthenticatedRequester(req);
        const ipAddress = requester.ip || 'unknown';

        if (!email || !password) {
            throw createHttpError(400, '邮箱和密码均为必填项', 'INVALID_LOGIN_PAYLOAD');
        }

        const lockStatus = await userStore.getFailedLoginStatus(email, ipAddress);
        if (lockStatus.locked) {
            await userStore.recordAuditLog({
                action: 'login',
                success: false,
                account: email,
                requester,
                reason: 'locked',
                metadata: {
                    lockedUntil: lockStatus.lockedUntil,
                },
            });
            throw createHttpError(429, '登录失败次数过多，请稍后再试', 'LOGIN_RATE_LIMITED');
        }

        const user = await userStore.findUserByEmail(email);
        if (!user || !verifyPassword(password, user.passwordHash)) {
            const failed = await userStore.recordFailedLoginAttempt(email, ipAddress);
            await userStore.recordAuditLog({
                action: 'login',
                success: false,
                account: email,
                requester,
                reason: 'invalid_credentials',
                metadata: {
                    failedCount: failed.count,
                    lockedUntil: failed.lockedUntil,
                },
            });
            throw createHttpError(401, '邮箱或密码错误', 'INVALID_CREDENTIALS');
        }

        await userStore.clearFailedLoginAttempts(email, ipAddress);
        const loggedInUser = await userStore.markUserLoginSuccess(user.id);
        issueSession(res, req, loggedInUser);

        await userStore.recordAuditLog({
            action: 'login',
            success: true,
            userId: user.id,
            account: email,
            requester,
        });

        res.json({
            success: true,
            authenticated: true,
            user: toPublicUser(loggedInUser),
            message: '登录成功',
        });
    } catch (error) {
        next(error);
    }
});

router.get('/auth/session', (req, res) => {
    if (!req.auth?.authenticated || !req.auth?.user) {
        res.json({
            success: true,
            authenticated: false,
            user: null,
        });
        return;
    }

    res.json({
        success: true,
        authenticated: true,
        user: toPublicUser(req.auth.user),
    });
});

router.post('/auth/logout', requireAuth, async (req, res, next) => {
    try {
        await userStore.recordAuditLog({
            action: 'logout',
            success: true,
            userId: req.auth.user.id,
            account: req.auth.user.email,
            requester: buildAuthenticatedRequester(req),
        });

        clearSessionCookie(res, req);
        res.json({
            success: true,
            message: '已退出登录',
        });
    } catch (error) {
        next(error);
    }
});

router.get('/auth/profile', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: toPublicUser(req.auth.user),
    });
});

router.put('/auth/profile', requireAuth, async (req, res, next) => {
    try {
        const displayName = userStore.normalizeDisplayName(req.body?.displayName, req.auth.user.email);
        const timezone = String(req.body?.timezone || '').trim().slice(0, 60);
        const bio = String(req.body?.bio || '').trim().slice(0, 240);

        if (!displayName) {
            throw createHttpError(400, '显示名称不能为空', 'INVALID_DISPLAY_NAME');
        }

        const updatedUser = await userStore.updateUser(req.auth.user.id, {
            ...req.auth.user,
            displayName,
            profile: {
                ...(req.auth.user.profile || {}),
                timezone,
                bio,
            },
        });

        await userStore.recordAuditLog({
            action: 'profile_update',
            success: true,
            userId: updatedUser.id,
            account: updatedUser.email,
            requester: buildAuthenticatedRequester(req),
        });

        res.json({
            success: true,
            user: toPublicUser(updatedUser),
            message: '账号资料已更新',
        });
    } catch (error) {
        next(error);
    }
});

router.post('/auth/password/change', requireAuth, async (req, res, next) => {
    try {
        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');

        if (!currentPassword || !newPassword) {
            throw createHttpError(400, '当前密码和新密码均为必填项', 'INVALID_PASSWORD_CHANGE_PAYLOAD');
        }

        if (!verifyPassword(currentPassword, req.auth.user.passwordHash)) {
            await userStore.recordAuditLog({
                action: 'password_change',
                success: false,
                userId: req.auth.user.id,
                account: req.auth.user.email,
                requester: buildAuthenticatedRequester(req),
                reason: 'invalid_current_password',
            });
            throw createHttpError(401, '当前密码不正确', 'INVALID_CURRENT_PASSWORD');
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            throw createHttpError(400, passwordError, 'INVALID_NEW_PASSWORD');
        }

        const updatedUser = await userStore.updateUserPassword(req.auth.user.id, createPasswordHash(newPassword));
        issueSession(res, req, updatedUser);

        await userStore.recordAuditLog({
            action: 'password_change',
            success: true,
            userId: req.auth.user.id,
            account: req.auth.user.email,
            requester: buildAuthenticatedRequester(req),
        });

        res.json({
            success: true,
            message: '密码修改成功',
        });
    } catch (error) {
        next(error);
    }
});

router.post('/auth/password/forgot', async (req, res, next) => {
    try {
        const email = userStore.normalizeEmail(req.body?.email);
        const requester = buildAuthenticatedRequester(req);
        const user = await userStore.findUserByEmail(email);

        let resetTokenPayload = null;

        if (user) {
            const issued = await userStore.createPasswordResetToken(user.id);
            await userStore.recordAuditLog({
                action: 'password_reset_requested',
                success: true,
                userId: user.id,
                account: user.email,
                requester,
                metadata: {
                    expiresAt: issued.expiresAt,
                },
            });

            if (config.auth.exposeResetToken) {
                resetTokenPayload = {
                    token: issued.token,
                    expiresAt: issued.expiresAt,
                };
            }
        } else {
            await userStore.recordAuditLog({
                action: 'password_reset_requested',
                success: false,
                account: email,
                requester,
                reason: 'user_not_found',
            });
        }

        res.json({
            success: true,
            message: '如果该邮箱已注册，系统已生成密码重置流程',
            maskedAccount: user ? maskEmail(user.email) : maskEmail(email),
            resetToken: resetTokenPayload,
        });
    } catch (error) {
        next(error);
    }
});

router.post('/auth/password/reset', async (req, res, next) => {
    try {
        const token = String(req.body?.token || '');
        const newPassword = String(req.body?.newPassword || '');

        if (!token || !newPassword) {
            throw createHttpError(400, '重置令牌和新密码均为必填项', 'INVALID_PASSWORD_RESET_PAYLOAD');
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            throw createHttpError(400, passwordError, 'INVALID_NEW_PASSWORD');
        }

        const consumed = await userStore.consumePasswordResetToken(token);
        if (!consumed?.user) {
            throw createHttpError(400, '重置令牌无效或已过期', 'INVALID_RESET_TOKEN');
        }

        await userStore.updateUserPassword(consumed.user.id, createPasswordHash(newPassword));
        await userStore.recordAuditLog({
            action: 'password_reset_completed',
            success: true,
            userId: consumed.user.id,
            account: consumed.user.email,
            requester: buildAuthenticatedRequester(req),
        });

        res.json({
            success: true,
            message: '密码重置成功，请使用新密码重新登录',
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;