const crypto = require('crypto');
const config = require('../config');

const AUTH_COOKIE_NAME = 'echoflow_session';
const SESSION_TTL_MS = Number(process.env.AUTH_SESSION_TTL_HOURS || 24 * 7) * 60 * 60 * 1000;

function base64url(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function decodeBase64url(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized, 'base64').toString('utf8');
}

function getSecret() {
    return process.env.AUTH_SESSION_SECRET
        || config.admin.sessionSecret
        || config.apiKey
        || 'echoflow-development-auth-secret';
}

function sign(value) {
    return base64url(crypto.createHmac('sha256', getSecret()).update(value).digest());
}

function createSessionToken(user) {
    const now = Date.now();
    const payload = {
        sub: user.id,
        email: user.email,
        iat: now,
        exp: now + SESSION_TTL_MS,
        sid: crypto.randomUUID(),
    };
    const encodedPayload = base64url(JSON.stringify(payload));
    return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySessionToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return { valid: false, reason: 'missing_token' };
    }

    const [encodedPayload, signature] = token.split('.');
    const expectedSignature = sign(encodedPayload);
    const signatureBuffer = Buffer.from(signature || '');
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return { valid: false, reason: 'invalid_signature' };
    }

    try {
        const payload = JSON.parse(decodeBase64url(encodedPayload));
        if (!payload.exp || Date.now() > payload.exp) {
            return { valid: false, reason: 'expired_token' };
        }
        return { valid: true, payload };
    } catch {
        return { valid: false, reason: 'invalid_payload' };
    }
}

module.exports = {
    AUTH_COOKIE_NAME,
    SESSION_TTL_MS,
    createSessionToken,
    verifySessionToken,
};
