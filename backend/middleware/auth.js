const { getClientIdentityFromRequest, buildRequesterMetadata } = require('../utils/requestIdentity');
const { extractSessionToken, verifyUserSessionToken } = require('../utils/userAuth');
const userStore = require('../utils/userStore');

function createHttpError(statusCode, message, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

async function attachAuthenticatedUser(req, res, next) {
    const identity = getClientIdentityFromRequest(req);
    const token = extractSessionToken(req);

    req.auth = {
        authenticated: false,
        token: token || '',
        user: null,
        session: null,
    };

    if (!token) {
        next();
        return;
    }

    const verification = verifyUserSessionToken(token, identity);
    if (!verification.valid) {
        req.auth.session = { valid: false, reason: verification.reason }; 
        next();
        return;
    }

    try {
        const user = await userStore.findUserById(verification.payload.userId);
        if (!user) {
            req.auth.session = { valid: false, reason: 'user_not_found' };
            next();
            return;
        }

        req.auth = {
            authenticated: true,
            token,
            user,
            session: verification.payload,
        };

        next();
    } catch (error) {
        next(error);
    }
}

function requireAuth(req, res, next) {
    if (!req.auth?.authenticated || !req.auth?.user) {
        next(createHttpError(401, '未授权，请先登录', 'AUTH_REQUIRED'));
        return;
    }

    next();
}

function isAdminUser(user) {
    return String(user?.role || '').toLowerCase() === 'admin';
}

function requireAdmin(req, res, next) {
    if (!req.auth?.authenticated || !req.auth?.user) {
        next(createHttpError(401, '未授权，请先登录', 'AUTH_REQUIRED'));
        return;
    }

    if (!isAdminUser(req.auth.user)) {
        next(createHttpError(403, '没有权限访问管理员页面', 'ADMIN_REQUIRED'));
        return;
    }

    next();
}

function assertResourceOwner(req, resource, options = {}) {
    const ownerUserId = resource?.ownerUserId || resource?.userId || null;
    if (!ownerUserId) {
        throw createHttpError(403, options.message || '该资源未绑定所属用户，无法访问', options.code || 'RESOURCE_OWNER_MISSING');
    }

    if (ownerUserId !== req.auth?.user?.id) {
        throw createHttpError(403, options.message || '没有权限访问该资源', options.code || 'RESOURCE_FORBIDDEN');
    }

    return true;
}

function buildAuthenticatedRequester(req) {
    const requester = buildRequesterMetadata(req);
    const user = req.auth?.user || null;

    return {
        ...requester,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userDisplayName: user?.displayName || requester.clientLabel,
    };
}

module.exports = {
    attachAuthenticatedUser,
    requireAuth,
    requireAdmin,
    isAdminUser,
    assertResourceOwner,
    buildAuthenticatedRequester,
    createHttpError,
};