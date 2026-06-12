const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)];
}

function restoreEnvValue(key, value) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    process.env[key] = value;
}

function loadAdminAuthWithEnv(envOverrides = {}) {
    const originalEnv = {
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
        ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
        ADMIN_SESSION_TTL_HOURS: process.env.ADMIN_SESSION_TTL_HOURS,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    };

    Object.assign(process.env, envOverrides);

    clearModule('../config');
    clearModule('../utils/adminAuth');

    const adminAuth = require('../utils/adminAuth');

    return {
        adminAuth,
        restore: () => {
            restoreEnvValue('ADMIN_PASSWORD', originalEnv.ADMIN_PASSWORD);
            restoreEnvValue('ADMIN_SESSION_SECRET', originalEnv.ADMIN_SESSION_SECRET);
            restoreEnvValue('ADMIN_SESSION_TTL_HOURS', originalEnv.ADMIN_SESSION_TTL_HOURS);
            restoreEnvValue('OPENAI_API_KEY', originalEnv.OPENAI_API_KEY);
            clearModule('../config');
            clearModule('../utils/adminAuth');
        },
    };
}

function loadAdminStoreWithFile(storeFile) {
    const originalStoreFile = process.env.ADMIN_ACTIVITY_STORE_FILE;
    process.env.ADMIN_ACTIVITY_STORE_FILE = storeFile;

    clearModule('../utils/adminActivityStore');
    const store = require('../utils/adminActivityStore');

    return {
        store,
        restore: () => {
            if (originalStoreFile === undefined) {
                delete process.env.ADMIN_ACTIVITY_STORE_FILE;
            } else {
                process.env.ADMIN_ACTIVITY_STORE_FILE = originalStoreFile;
            }
            clearModule('../utils/adminActivityStore');
        },
    };
}

test('adminAuth verifies password and session token', () => {
    const { adminAuth, restore } = loadAdminAuthWithEnv({
        OPENAI_API_KEY: 'test-key',
        ADMIN_PASSWORD: 'super-secret-password',
        ADMIN_SESSION_SECRET: 'session-secret-for-test',
        ADMIN_SESSION_TTL_HOURS: '6',
    });

    try {
        assert.equal(adminAuth.isAdminPasswordConfigured(), true);
        assert.equal(adminAuth.verifyAdminPassword('super-secret-password'), true);
        assert.equal(adminAuth.verifyAdminPassword('wrong-password'), false);

        const token = adminAuth.createAdminSessionToken({ clientId: 'client_123' });
        const validResult = adminAuth.verifyAdminSessionToken(token, { clientId: 'client_123' });
        assert.equal(validResult.valid, true);
        assert.equal(validResult.payload.clientId, 'client_123');

        const mismatchResult = adminAuth.verifyAdminSessionToken(token, { clientId: 'other_client' });
        assert.equal(mismatchResult.valid, false);
        assert.equal(mismatchResult.reason, 'client_mismatch');
    } finally {
        restore();
    }
});

test('adminActivityStore aggregates weekly summary and access records', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echoflow-admin-store-'));
    const storeFile = path.join(tempDir, 'admin-activity.json');
    const { store, restore } = loadAdminStoreWithFile(storeFile);

    try {
        store.initializeAdminActivityStore();

        store.recordSummaryActivity({
            createdAt: new Date().toISOString(),
            source: 'upload',
            fileId: 'file-1',
            meetingTitle: '产品周会',
            summary: {
                chinese: {
                    title: '产品周会',
                    date: '2026-06-12',
                    attendees: ['Alice', 'Bob'],
                    summary: '讨论了版本发布计划与风险。',
                    key_discussion_points: [{ topic: '版本计划', detail: '确定发布日期。' }],
                    decisions_made: ['按原定计划发布'],
                    action_items: [{ task: '准备发布说明', assignee: 'Alice', deadline: '2026-06-13' }],
                },
            },
            requester: {
                clientId: 'client-a',
                clientLabel: '网页访客-a',
                ip: '127.0.0.1',
            },
        });

        store.recordAccessActivity({
            createdAt: new Date().toISOString(),
            action: 'login',
            success: false,
            reason: 'invalid_password',
            requester: {
                clientId: 'client-a',
                clientLabel: '网页访客-a',
                ip: '127.0.0.1',
            },
        });

        store.recordAccessActivity({
            createdAt: new Date().toISOString(),
            action: 'dashboard_view',
            success: true,
            requester: {
                clientId: 'client-b',
                clientLabel: '网页访客-b',
                ip: '127.0.0.2',
            },
        });

        const dashboard = store.getDashboardData();
        assert.equal(dashboard.overview.summaryCount, 1);
        assert.equal(dashboard.overview.uniqueSummaryUsers, 1);
        assert.equal(dashboard.overview.accessCount, 2);
        assert.equal(dashboard.overview.uniqueAdminVisitors, 2);
        assert.equal(dashboard.overview.failedLoginCount, 1);
        assert.equal(dashboard.summaryRecords[0].meetingTitle, '产品周会');
        assert.match(dashboard.summaryRecords[0].summaryExcerpt, /讨论了版本发布计划与风险/);
    } finally {
        restore();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});