const crypto = require('crypto');
const config = require('../config');
const { parseCookies, isSecureRequest } = require('./requestIdentity');

function getSessionCookieSameSite() {
    return config.auth.cookieSameSite || 'lax';
}

function shouldUseSecureSessionCookie(req) {
    const secureMode = config.auth.cookieSecure || 'auto';

    if (secureMode === 'always') {
        return true;
    }

    if (secureMode === 'never') {
        return false;
    }

    if (getSessionCookieSameSite() === 'none') {
        return true;
    }

    return isSecureRequest(req);
}

function createPasswordHash(password) {
    const salt = crypto.randomBytes(config.auth.passwordSaltLength).toString('hex');
    const derivedKey = crypto.scryptSync(String(password || ''), salt, config.auth.passwordKeyLength).toString('hex');
    return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== 'string') {
        return false;
    }

    const [algorithm, salt, hash] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !salt || !hash) {
        return false;
    }

    const candidate = crypto.scryptSync(String(password || ''), salt, config.auth.passwordKeyLength).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

function getSessionSecret() {
    return config.auth.sessionSecret || `${config.apiKey || 'echoflow'}:${config.auth.cookieName}`;
}

function signPayload(payload) {
    return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
}

function createUserSessionToken(payload = {}) {
    const expiresAt = Date.now() + (config.auth.sessionTtlHours * 60 * 60 * 1000);
    const encodedPayload = Buffer.from(JSON.stringify({
        exp: expiresAt,
        userId: payload.userId || null,
        email: payload.email || null,
        role: payload.role || config.auth.defaultRole,
        clientId: payload.clientId || null,
    })).toString('base64url');

    return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function verifyUserSessionToken(token, identity = {}) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return { valid: false, reason: 'missing_token' };
    }

    const [payload, signature] = token.split('.');
    const expectedSignature = signPayload(payload);

    if (signature !== expectedSignature) {
        return { valid: false, reason: 'invalid_signature' };
    }

    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

        if (!decoded.exp || decoded.exp < Date.now()) {
            return { valid: false, reason: 'expired' };
        }

        if (decoded.clientId && identity.clientId && decoded.clientId !== identity.clientId) {
            return { valid: false, reason: 'client_mismatch' };
        }

        return {
            valid: true,
            payload: decoded,
        };
    } catch (error) {
        return { valid: false, reason: 'invalid_payload', error };
    }
}

function extractSessionToken(req) {
    const authorization = req.headers.authorization || '';
    if (authorization.startsWith('Bearer ')) {
        return authorization.slice('Bearer '.length).trim();
    }

    const cookies = parseCookies(req.headers.cookie || '');
    return cookies[config.auth.cookieName] || '';
}

function createSessionCookieOptions(req) {
    return {
        httpOnly: true,
        sameSite: getSessionCookieSameSite(),
        secure: shouldUseSecureSessionCookie(req),
        maxAge: config.auth.sessionTtlHours * 60 * 60 * 1000,
        path: '/',
    };
}

function clearSessionCookie(res, req) {
    res.clearCookie(config.auth.cookieName, {
        httpOnly: true,
        sameSite: getSessionCookieSameSite(),
        secure: shouldUseSecureSessionCookie(req),
        path: '/',
    });
}

function toPublicUser(user) {
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        profile: {
            timezone: user.profile?.timezone || '',
            bio: user.profile?.bio || '',
        },
    };
}

function maskEmail(email) {
    const normalized = String(email || '').trim();
    const [name, domain] = normalized.split('@');
    if (!name || !domain) {
        return normalized;
    }

    const prefix = name.length <= 2 ? name[0] : name.slice(0, 2);
    return `${prefix}***@${domain}`;
}

module.exports = {
    createPasswordHash,
    verifyPassword,
    createUserSessionToken,
    verifyUserSessionToken,
    extractSessionToken,
    createSessionCookieOptions,
    clearSessionCookie,
    toPublicUser,
    maskEmail,
};