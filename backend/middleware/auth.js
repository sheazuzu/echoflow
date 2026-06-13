const { parseCookies, isSecureRequest } = require('../utils/requestIdentity');
const { AUTH_COOKIE_NAME, SESSION_TTL_MS, verifySessionToken } = require('../utils/authToken');
const userStore = require('../utils/userStore');

function extractToken(req) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    const cookies = parseCookies(req.headers.cookie || '');
    return cookies[AUTH_COOKIE_NAME] || null;
}

function setAuthCookie(req, res, token) {
    res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        maxAge: SESSION_TTL_MS,
        path: '/',
    });
}

function clearAuthCookie(req, res) {
    res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        path: '/',
    });
}

async function attachAuthenticatedUser(req, res, next) {
    try {
        const token = extractToken(req);
        const result = verifySessionToken(token);

        if (result.valid) {
            const user = await userStore.findUserById(result.payload.sub);
            if (user) {
                req.auth = { user, tokenPayload: result.payload };
            }
        }

        next();
    } catch (error) {
        next(error);
    }
}

function requireAuth(req, res, next) {
    if (!req.auth?.user) {
        return res.status(401).json({
            success: false,
            message: '请先登录后再继续',
            errorCode: 'AUTH_REQUIRED',
        });
    }

    next();
}

function requireAdmin(req, res, next) {
    if (!req.auth?.user) {
        return res.status(401).json({
            success: false,
            message: '请先登录后再继续',
            errorCode: 'AUTH_REQUIRED',
        });
    }

    if (!req.auth.user.isSystemAdmin) {
        return res.status(403).json({
            success: false,
            message: '当前账号没有管理员权限',
            errorCode: 'ADMIN_REQUIRED',
        });
    }

    next();
}

module.exports = {
    attachAuthenticatedUser,
    requireAuth,
    requireAdmin,
    setAuthCookie,
    clearAuthCookie,
};
