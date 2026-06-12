const crypto = require('crypto');
const config = require('../config');

function isAdminPasswordConfigured() {
    return Boolean(config.admin.password);
}

function hashValue(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest();
}

function verifyAdminPassword(inputPassword) {
    if (!isAdminPasswordConfigured()) {
        return false;
    }

    return crypto.timingSafeEqual(
        hashValue(inputPassword),
        hashValue(config.admin.password)
    );
}

function getSessionSecret() {
    return config.admin.sessionSecret || `${config.apiKey || 'echoflow'}:${config.admin.password || 'admin'}`;
}

function signPayload(payload) {
    return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
}

function createAdminSessionToken(identity = {}) {
    const expiresAt = Date.now() + (config.admin.sessionTtlHours * 60 * 60 * 1000);
    const payload = Buffer.from(JSON.stringify({
        exp: expiresAt,
        clientId: identity.clientId || null,
    })).toString('base64url');

    return `${payload}.${signPayload(payload)}`;
}

function verifyAdminSessionToken(token, identity = {}) {
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

module.exports = {
    isAdminPasswordConfigured,
    verifyAdminPassword,
    createAdminSessionToken,
    verifyAdminSessionToken,
};
