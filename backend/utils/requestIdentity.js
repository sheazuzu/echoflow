const crypto = require('crypto');
const config = require('../config');

const CLIENT_ID_COOKIE_NAME = 'echoflow_client_id';
const CLIENT_ID_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function parseCookies(cookieHeader = '') {
    return cookieHeader
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const separatorIndex = part.indexOf('=');
            if (separatorIndex === -1) {
                return acc;
            }

            const key = part.slice(0, separatorIndex).trim();
            const value = part.slice(separatorIndex + 1).trim();
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {});
}

function createClientId() {
    return crypto.randomUUID().replace(/-/g, '');
}

function isSecureRequest(req) {
    return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function getClientCookieSameSite() {
    return config.auth.cookieSameSite || 'lax';
}

function shouldUseSecureClientCookie(req) {
    const secureMode = config.auth.cookieSecure || 'auto';

    if (secureMode === 'always') {
        return true;
    }

    if (secureMode === 'never') {
        return false;
    }

    if (getClientCookieSameSite() === 'none') {
        return true;
    }

    return isSecureRequest(req);
}

function sanitizeLabel(label) {
    if (!label) {
        return null;
    }

    return String(label)
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80);
}

function resolveClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        return String(forwardedFor).split(',')[0].trim();
    }

    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getClientIdentityFromRequest(req) {
    if (req.clientIdentity) {
        return req.clientIdentity;
    }

    const cookies = parseCookies(req.headers.cookie || '');
    const headerClientId = sanitizeLabel(req.headers['x-client-id']);
    const cookieClientId = sanitizeLabel(cookies[CLIENT_ID_COOKIE_NAME]);
    const clientId = headerClientId || cookieClientId || createClientId();
    const preferredLabel = sanitizeLabel(req.headers['x-client-label']);
    const clientLabel = preferredLabel || `访客-${clientId.slice(-6)}`;

    req.clientIdentity = {
        clientId,
        clientLabel,
        ip: resolveClientIp(req),
        userAgent: req.headers['user-agent'] || 'unknown',
        origin: req.headers.origin || null,
        referer: req.headers.referer || null,
    };

    return req.clientIdentity;
}

function buildRequesterMetadata(req) {
    const identity = getClientIdentityFromRequest(req);

    return {
        clientId: identity.clientId,
        clientLabel: identity.clientLabel,
        ip: identity.ip,
        userAgent: identity.userAgent,
        origin: identity.origin,
        referer: identity.referer,
    };
}

function attachClientIdentity(req, res, next) {
    const cookies = parseCookies(req.headers.cookie || '');
    const identity = getClientIdentityFromRequest(req);

    if (!cookies[CLIENT_ID_COOKIE_NAME] || cookies[CLIENT_ID_COOKIE_NAME] !== identity.clientId) {
        res.cookie(CLIENT_ID_COOKIE_NAME, identity.clientId, {
            httpOnly: true,
            sameSite: getClientCookieSameSite(),
            secure: shouldUseSecureClientCookie(req),
            maxAge: CLIENT_ID_MAX_AGE_MS,
            path: '/',
        });
    }

    next();
}

module.exports = {
    CLIENT_ID_COOKIE_NAME,
    parseCookies,
    createClientId,
    isSecureRequest,
    getClientIdentityFromRequest,
    buildRequesterMetadata,
    attachClientIdentity,
};
