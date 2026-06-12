const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const WINDOW_DAYS = 7;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;
const MAX_SUMMARY_RECORDS = 1000;
const MAX_ACCESS_RECORDS = 2000;
const STORE_FILE = process.env.ADMIN_ACTIVITY_STORE_FILE || path.join(__dirname, '..', 'data', 'admin-activity.json');

let loaded = false;
let state = {
    summaries: [],
    accesses: [],
};

function ensureStoreLoaded() {
    if (loaded) {
        return;
    }

    const directory = path.dirname(STORE_FILE);

    try {
        fs.mkdirSync(directory, { recursive: true });
    } catch (error) {
        logger('ADMIN_STORE_WARN', `管理页活动目录创建失败，将继续使用内存态: ${directory}, error=${error.message}`);
    }

    if (fs.existsSync(STORE_FILE)) {
        try {
            const content = fs.readFileSync(STORE_FILE, 'utf8');
            const parsed = JSON.parse(content || '{}');
            state = {
                summaries: Array.isArray(parsed.summaries) ? parsed.summaries : [],
                accesses: Array.isArray(parsed.accesses) ? parsed.accesses : [],
            };
        } catch (error) {
            logger('ADMIN_STORE_WARN', `管理页活动存储读取失败，将重建存储: ${error.message}`);
            state = { summaries: [], accesses: [] };
        }
    }

    pruneExpiredRecords();
    persistState();
    loaded = true;
}

function persistState() {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger('ADMIN_STORE_WARN', `管理页活动存储写入失败，将仅保留内存态: ${STORE_FILE}, error=${error.message}`);
        return false;
    }
}

function getTimestamp(value) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function pruneExpiredRecords() {
    const threshold = Date.now() - WINDOW_MS;

    state.summaries = state.summaries
        .filter(item => getTimestamp(item.createdAt) >= threshold)
        .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt))
        .slice(0, MAX_SUMMARY_RECORDS);

    state.accesses = state.accesses
        .filter(item => getTimestamp(item.createdAt) >= threshold)
        .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt))
        .slice(0, MAX_ACCESS_RECORDS);
}

function buildSummarySnapshot(summary = {}) {
    return {
        chinese: summary.chinese ? {
            title: summary.chinese.title || '',
            date: summary.chinese.date || '',
            attendees: Array.isArray(summary.chinese.attendees) ? summary.chinese.attendees : [],
            summary: summary.chinese.summary || '',
        } : null,
        english: summary.english ? {
            title: summary.english.title || '',
            date: summary.english.date || '',
            attendees: Array.isArray(summary.english.attendees) ? summary.english.attendees : [],
            summary: summary.english.summary || '',
        } : null,
        keyDiscussionCount: Array.isArray(summary.chinese?.key_discussion_points)
            ? summary.chinese.key_discussion_points.length
            : Array.isArray(summary.english?.key_discussion_points)
                ? summary.english.key_discussion_points.length
                : 0,
        decisionsCount: Array.isArray(summary.chinese?.decisions_made)
            ? summary.chinese.decisions_made.length
            : Array.isArray(summary.english?.decisions_made)
                ? summary.english.decisions_made.length
                : 0,
        actionItemCount: Array.isArray(summary.chinese?.action_items)
            ? summary.chinese.action_items.length
            : Array.isArray(summary.english?.action_items)
                ? summary.english.action_items.length
                : 0,
    };
}

function extractSummaryExcerpt(summary = {}) {
    const text = summary.chinese?.summary || summary.english?.summary || '';
    return text.length > 400 ? `${text.slice(0, 400)}...` : text;
}

function normalizeRequester(requester = {}) {
    return {
        clientId: requester.clientId || 'unknown-client',
        clientLabel: requester.clientLabel || '未知访客',
        ip: requester.ip || 'unknown',
        userAgent: requester.userAgent || 'unknown',
        origin: requester.origin || null,
        referer: requester.referer || null,
    };
}

function recordSummaryActivity(payload = {}) {
    ensureStoreLoaded();

    const createdAt = payload.createdAt || new Date().toISOString();
    const requester = normalizeRequester(payload.requester);
    const summarySnapshot = buildSummarySnapshot(payload.summary || {});

    const record = {
        id: payload.id || crypto.randomUUID(),
        createdAt,
        source: payload.source || 'upload',
        fileId: payload.fileId || null,
        meetingTopic: payload.meetingTopic || '',
        originalFilename: payload.originalFilename || '',
        normalizedFilename: payload.normalizedFilename || '',
        meetingTitle: payload.meetingTitle || summarySnapshot.chinese?.title || summarySnapshot.english?.title || payload.fileId || '未命名会议',
        meetingDate: payload.meetingDate || summarySnapshot.chinese?.date || summarySnapshot.english?.date || '',
        summaryExcerpt: payload.summaryExcerpt || extractSummaryExcerpt(payload.summary || {}),
        summarySnapshot,
        requester,
        userDisplayName: payload.userDisplayName || requester.clientLabel,
    };

    state.summaries.unshift(record);
    pruneExpiredRecords();
    persistState();
    return record;
}

function recordAccessActivity(payload = {}) {
    ensureStoreLoaded();

    const createdAt = payload.createdAt || new Date().toISOString();
    const requester = normalizeRequester(payload.requester);

    const record = {
        id: payload.id || crypto.randomUUID(),
        createdAt,
        action: payload.action || 'dashboard_view',
        route: payload.route || '/api/admin',
        success: payload.success !== false,
        reason: payload.reason || '',
        requester,
        userDisplayName: payload.userDisplayName || requester.clientLabel,
    };

    state.accesses.unshift(record);
    pruneExpiredRecords();
    persistState();
    return record;
}

function getDashboardData() {
    ensureStoreLoaded();
    pruneExpiredRecords();
    persistState();

    const summaryRecords = [...state.summaries].sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
    const accessRecords = [...state.accesses].sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));

    const summaryUsers = new Set(summaryRecords.map(item => item.requester.clientId));
    const accessUsers = new Set(accessRecords.map(item => item.requester.clientId));
    const failedLogins = accessRecords.filter(item => item.action === 'login' && !item.success).length;

    return {
        overview: {
            windowDays: WINDOW_DAYS,
            summaryCount: summaryRecords.length,
            accessCount: accessRecords.length,
            uniqueSummaryUsers: summaryUsers.size,
            uniqueAdminVisitors: accessUsers.size,
            failedLoginCount: failedLogins,
        },
        summaryRecords,
        accessRecords,
    };
}

function initializeAdminActivityStore() {
    ensureStoreLoaded();
    return STORE_FILE;
}

module.exports = {
    WINDOW_DAYS,
    STORE_FILE,
    initializeAdminActivityStore,
    recordSummaryActivity,
    recordAccessActivity,
    getDashboardData,
};
