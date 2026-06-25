const crypto = require('crypto');
const config = require('../config');
const { testConnection, query, queryOne, withTransaction } = require('./db');

const MAX_AUDIT_LOGS = 2000;
const MAX_ACTIVITY_PAGE_SIZE = 100;
const BUSINESS_ACTIVITY_TYPES = Object.freeze({
    PROCESSING_JOB: 'upload_task',
});
const BUSINESS_ACTIVITY_TYPE_SET = new Set(Object.values(BUSINESS_ACTIVITY_TYPES));
const UNSUPPORTED_ACTIVITY_FILTER = '__unsupported_activity_type__';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeDisplayName(displayName, fallbackEmail) {
    const cleaned = String(displayName || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (cleaned) {
        return cleaned;
    }

    const email = normalizeEmail(fallbackEmail);
    return email ? email.split('@')[0].slice(0, 60) : '未命名用户';
}

function serializeJson(value, fallback = {}) {
    return JSON.stringify(value || fallback);
}

function parseJson(value, fallback = {}) {
    const base = fallback && typeof fallback === 'object' ? { ...fallback } : fallback ?? null;

    if (!value) {
        return base;
    }

    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            if (base && typeof base === 'object' && !Array.isArray(base)) {
                return { ...base, ...parsed };
            }
            return parsed;
        }

        return base;
    } catch (error) {
        return base;
    }
}

function mapUserRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        email: normalizeEmail(row.email),
        displayName: normalizeDisplayName(row.display_name, row.email),
        passwordHash: row.password_hash,
        role: row.role || config.auth.defaultRole,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
        profile: parseJson(row.profile_json, {
            timezone: '',
            bio: '',
        }),
    };
}

function mapPasswordResetTokenRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        userId: row.user_id,
        tokenHash: row.token_hash,
        createdAt: new Date(row.created_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
        usedAt: row.used_at ? new Date(row.used_at).toISOString() : null,
    };
}

function mapAuditLogRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        createdAt: new Date(row.created_at).toISOString(),
        action: row.action || 'unknown',
        success: Boolean(row.success),
        reason: row.reason || '',
        userId: row.user_id || null,
        account: normalizeEmail(row.account),
        requester: parseJson(row.requester_json, null),
        metadata: parseJson(row.metadata_json, {}),
    };
}

function mapActivityRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        dedupeKey: row.dedupe_key || '',
        userId: row.user_id || null,
        userEmail: normalizeEmail(row.user_email),
        userDisplayName: normalizeDisplayName(row.user_display_name, row.user_email),
        fileId: row.file_id || '',
        activityType: row.activity_type || 'unknown',
        status: row.status || 'unknown',
        title: row.title || '',
        summary: row.summary || '',
        detail: parseJson(row.detail_json, {}),
        metadata: parseJson(row.metadata_json, {}),
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
    };
}

function sanitizePageSize(pageSize) {
    const parsed = Number.parseInt(pageSize, 10);
    const normalized = Number.isFinite(parsed) ? parsed : 20;
    return Math.max(1, Math.min(MAX_ACTIVITY_PAGE_SIZE, normalized));
}

function sanitizePage(page) {
    const parsed = Number.parseInt(page, 10);
    const normalized = Number.isFinite(parsed) ? parsed : 1;
    return Math.max(1, normalized);
}

function buildActivitySearchableText(payload = {}) {
    const detail = payload.detail && typeof payload.detail === 'object'
        ? JSON.stringify(payload.detail)
        : String(payload.detail || '');
    const metadata = payload.metadata && typeof payload.metadata === 'object'
        ? JSON.stringify(payload.metadata)
        : String(payload.metadata || '');

    return [
        payload.fileId,
        payload.activityType,
        payload.status,
        payload.title,
        payload.summary,
        detail,
        metadata,
    ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 8000);
}

function isBusinessActivityType(activityType) {
    return BUSINESS_ACTIVITY_TYPE_SET.has(String(activityType || '').trim());
}

function normalizeActivityTypeFilter(activityType) {
    const normalized = String(activityType || '').trim();
    if (!normalized || normalized === 'all') {
        return 'all';
    }

    return isBusinessActivityType(normalized) ? normalized : UNSUPPORTED_ACTIVITY_FILTER;
}

function normalizeActivityPayload(payload = {}) {
    const activityType = String(payload.activityType || '').trim() || BUSINESS_ACTIVITY_TYPES.PROCESSING_JOB;
    if (!isBusinessActivityType(activityType)) {
        return null;
    }

    return {
        ...payload,
        activityType,
    };
}

function buildActivityQueryContext(filters = {}, options = {}) {
    const normalizedFilters = {
        ...filters,
        activityType: normalizeActivityTypeFilter(filters.activityType),
    };
    const { whereSql, params } = buildActivityFilterClause(normalizedFilters, options);
    return {
        filters: normalizedFilters,
        whereSql,
        params,
    };
}

function buildPaginationClause(pageSize, offset) {
    const safePageSize = sanitizePageSize(pageSize);
    const safeOffset = Math.max(0, Number.parseInt(offset, 10) || 0);
    return `LIMIT ${safePageSize} OFFSET ${safeOffset}`;
}

function buildActivityFilterClause(filters = {}, options = {}) {
    const clauses = [];
    const params = [];

    if (!options.includeAllUsers) {
        clauses.push('a.user_id = ?');
        params.push(options.userId || '');
    } else if (filters.userId) {
        clauses.push('a.user_id = ?');
        params.push(filters.userId);
    }

    const allowedActivityTypes = Array.from(BUSINESS_ACTIVITY_TYPE_SET);
    if (allowedActivityTypes.length === 1) {
        clauses.push('a.activity_type = ?');
        params.push(allowedActivityTypes[0]);
    } else if (allowedActivityTypes.length > 1) {
        clauses.push(`a.activity_type IN (${allowedActivityTypes.map(() => '?').join(', ')})`);
        params.push(...allowedActivityTypes);
    }

    const activityType = normalizeActivityTypeFilter(filters.activityType);
    if (activityType === UNSUPPORTED_ACTIVITY_FILTER) {
        clauses.push('1 = 0');
    } else if (activityType !== 'all') {
        clauses.push('a.activity_type = ?');
        params.push(activityType);
    }

    const status = String(filters.status || '').trim();
    if (status && status !== 'all') {
        clauses.push('a.status = ?');
        params.push(status);
    }

    const dateFrom = String(filters.dateFrom || '').trim();
    if (dateFrom) {
        clauses.push('a.created_at >= ?');
        params.push(new Date(dateFrom));
    }

    const dateTo = String(filters.dateTo || '').trim();
    if (dateTo) {
        clauses.push('a.created_at <= ?');
        params.push(new Date(dateTo));
    }

    const keyword = String(filters.keyword || '').trim();
    if (keyword) {
        const like = `%${keyword}%`;
        clauses.push(`(
            a.title LIKE ?
            OR a.summary LIKE ?
            OR a.searchable_text LIKE ?
            OR a.file_id LIKE ?
            OR u.email LIKE ?
            OR u.display_name LIKE ?
        )`);
        params.push(like, like, like, like, like, like);
    }

    return {
        whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        params,
    };
}

async function pruneState(referenceTime = Date.now()) {
    const failedLoginThreshold = new Date(referenceTime - config.auth.failedLoginWindowMinutes * 60 * 1000);
    const auditLogLimit = Math.max(0, Number(MAX_AUDIT_LOGS) || 0);

    await query(
        `DELETE FROM auth_failed_login_attempts
         WHERE created_at < ?`,
        [failedLoginThreshold],
    );

    await query(
        `DELETE FROM auth_password_reset_tokens
         WHERE used_at IS NOT NULL OR expires_at <= ?`,
        [new Date(referenceTime)],
    );

    await query(
        `DELETE FROM auth_audit_logs
         WHERE id NOT IN (
            SELECT id FROM (
                SELECT id FROM auth_audit_logs
                ORDER BY created_at DESC
                LIMIT ${auditLogLimit}
            ) AS recent_logs
         )`,
    );
}

async function initializeUserStore() {
    await testConnection();

    await query(
        `CREATE TABLE IF NOT EXISTS auth_users (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            display_name VARCHAR(60) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(32) NOT NULL,
            profile_json JSON NOT NULL,
            created_at DATETIME(3) NOT NULL,
            updated_at DATETIME(3) NOT NULL,
            last_login_at DATETIME(3) NULL,
            UNIQUE KEY uniq_auth_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await query(
        `CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            created_at DATETIME(3) NOT NULL,
            expires_at DATETIME(3) NOT NULL,
            used_at DATETIME(3) NULL,
            UNIQUE KEY uniq_auth_password_reset_tokens_token_hash (token_hash),
            KEY idx_auth_password_reset_tokens_user_id (user_id),
            KEY idx_auth_password_reset_tokens_expires_at (expires_at),
            CONSTRAINT fk_auth_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await query(
        `CREATE TABLE IF NOT EXISTS auth_failed_login_attempts (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            attempt_key VARCHAR(320) NOT NULL,
            account VARCHAR(255) NOT NULL,
            ip_address VARCHAR(64) NOT NULL,
            created_at DATETIME(3) NOT NULL,
            locked_until DATETIME(3) NULL,
            KEY idx_auth_failed_login_attempts_key (attempt_key),
            KEY idx_auth_failed_login_attempts_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await query(
        `CREATE TABLE IF NOT EXISTS auth_audit_logs (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            created_at DATETIME(3) NOT NULL,
            action VARCHAR(64) NOT NULL,
            success TINYINT(1) NOT NULL,
            reason VARCHAR(255) NOT NULL,
            user_id VARCHAR(36) NULL,
            account VARCHAR(255) NULL,
            requester_json JSON NULL,
            metadata_json JSON NOT NULL,
            KEY idx_auth_audit_logs_created_at (created_at),
            KEY idx_auth_audit_logs_user_id (user_id),
            CONSTRAINT fk_auth_audit_logs_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await query(
        `CREATE TABLE IF NOT EXISTS auth_activity_logs (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            dedupe_key VARCHAR(191) NULL,
            user_id VARCHAR(36) NOT NULL,
            file_id VARCHAR(255) NULL,
            activity_type VARCHAR(64) NOT NULL,
            status VARCHAR(32) NOT NULL,
            title VARCHAR(255) NOT NULL,
            summary TEXT NOT NULL,
            detail_json JSON NOT NULL,
            metadata_json JSON NOT NULL,
            searchable_text TEXT NOT NULL,
            created_at DATETIME(3) NOT NULL,
            updated_at DATETIME(3) NOT NULL,
            UNIQUE KEY uniq_auth_activity_logs_dedupe_key (dedupe_key),
            KEY idx_auth_activity_logs_user_id (user_id),
            KEY idx_auth_activity_logs_created_at (created_at),
            KEY idx_auth_activity_logs_activity_type (activity_type),
            KEY idx_auth_activity_logs_status (status),
            KEY idx_auth_activity_logs_file_id (file_id),
            CONSTRAINT fk_auth_activity_logs_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await pruneState();

    return {
        provider: 'mysql',
        database: config.mysql.database,
        host: config.mysql.host,
        port: config.mysql.port,
        tables: [
            'auth_users',
            'auth_password_reset_tokens',
            'auth_failed_login_attempts',
            'auth_audit_logs',
            'auth_activity_logs',
        ],
    };
}

async function listUsers() {
    await pruneState();
    const rows = await query(
        `SELECT * FROM auth_users
         ORDER BY created_at DESC`,
    );
    return rows.map(mapUserRow);
}

async function findUserByEmail(email) {
    await pruneState();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return null;
    }

    const row = await queryOne(
        `SELECT * FROM auth_users
         WHERE email = ?
         LIMIT 1`,
        [normalizedEmail],
    );

    return mapUserRow(row);
}

async function findUserById(userId) {
    await pruneState();
    const row = await queryOne(
        `SELECT * FROM auth_users
         WHERE id = ?
         LIMIT 1`,
        [userId],
    );
    return mapUserRow(row);
}

async function createUser(payload = {}) {
    const email = normalizeEmail(payload.email);
    if (!email) {
        throw new Error('邮箱不能为空');
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        const error = new Error('该邮箱已被注册');
        error.code = 'EMAIL_ALREADY_EXISTS';
        throw error;
    }

    const user = {
        id: payload.id || crypto.randomUUID(),
        email,
        displayName: normalizeDisplayName(payload.displayName, email),
        passwordHash: payload.passwordHash,
        role: payload.role || config.auth.defaultRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: null,
        profile: {
            timezone: payload.timezone || '',
            bio: payload.bio || '',
        },
    };

    try {
        await query(
            `INSERT INTO auth_users (
                id, email, display_name, password_hash, role, profile_json, created_at, updated_at, last_login_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                user.email,
                user.displayName,
                user.passwordHash,
                user.role,
                serializeJson(user.profile),
                new Date(user.createdAt),
                new Date(user.updatedAt),
                null,
            ],
        );
    } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
            const duplicateError = new Error('该邮箱已被注册');
            duplicateError.code = 'EMAIL_ALREADY_EXISTS';
            throw duplicateError;
        }
        throw error;
    }

    return user;
}

async function updateUser(userId, updater) {
    const currentUser = await findUserById(userId);
    if (!currentUser) {
        return null;
    }

    const nextUser = typeof updater === 'function'
        ? await updater({ ...currentUser })
        : { ...currentUser, ...updater };

    nextUser.email = normalizeEmail(nextUser.email || currentUser.email);
    nextUser.displayName = normalizeDisplayName(nextUser.displayName, nextUser.email);
    nextUser.updatedAt = new Date().toISOString();
    nextUser.profile = {
        timezone: '',
        bio: '',
        ...(currentUser.profile || {}),
        ...(nextUser.profile || {}),
    };

    await query(
        `UPDATE auth_users
         SET email = ?,
             display_name = ?,
             password_hash = ?,
             role = ?,
             profile_json = ?,
             updated_at = ?,
             last_login_at = ?
         WHERE id = ?`,
        [
            nextUser.email,
            nextUser.displayName,
            nextUser.passwordHash,
            nextUser.role || config.auth.defaultRole,
            serializeJson(nextUser.profile),
            new Date(nextUser.updatedAt),
            nextUser.lastLoginAt ? new Date(nextUser.lastLoginAt) : null,
            userId,
        ],
    );

    return findUserById(userId);
}

async function updateUserPassword(userId, passwordHash) {
    return updateUser(userId, (user) => ({
        ...user,
        passwordHash,
    }));
}

async function markUserLoginSuccess(userId) {
    return updateUser(userId, (user) => ({
        ...user,
        lastLoginAt: new Date().toISOString(),
    }));
}

function buildFailedLoginKey(account, ipAddress) {
    return `${normalizeEmail(account)}|${String(ipAddress || 'unknown')}`;
}

async function getFailedLoginStatus(account, ipAddress) {
    await pruneState();

    const key = buildFailedLoginKey(account, ipAddress);
    const attempts = await query(
        `SELECT * FROM auth_failed_login_attempts
         WHERE attempt_key = ?
         ORDER BY created_at ASC`,
        [key],
    );
    const latestAttempt = attempts[attempts.length - 1] || null;

    if (!latestAttempt) {
        return {
            locked: false,
            count: 0,
            remainingMs: 0,
        };
    }

    const lockedUntil = latestAttempt.locked_until ? new Date(latestAttempt.locked_until).getTime() : 0;
    const remainingMs = lockedUntil > Date.now() ? lockedUntil - Date.now() : 0;

    return {
        locked: remainingMs > 0,
        count: attempts.length,
        remainingMs,
        lockedUntil: latestAttempt.locked_until ? new Date(latestAttempt.locked_until).toISOString() : null,
    };
}

async function recordFailedLoginAttempt(account, ipAddress) {
    await pruneState();

    const now = Date.now();
    const key = buildFailedLoginKey(account, ipAddress);
    const attempts = await query(
        `SELECT id FROM auth_failed_login_attempts
         WHERE attempt_key = ?`,
        [key],
    );
    const nextCount = attempts.length + 1;
    const lockedUntil = nextCount >= config.auth.maxFailedAttempts
        ? new Date(now + config.auth.lockoutMinutes * 60 * 1000).toISOString()
        : null;

    await query(
        `INSERT INTO auth_failed_login_attempts (
            id, attempt_key, account, ip_address, created_at, locked_until
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
            crypto.randomUUID(),
            key,
            normalizeEmail(account),
            ipAddress || 'unknown',
            new Date(now),
            lockedUntil ? new Date(lockedUntil) : null,
        ],
    );

    await pruneState(now);

    return {
        count: nextCount,
        locked: Boolean(lockedUntil),
        lockedUntil,
    };
}

async function clearFailedLoginAttempts(account, ipAddress) {
    const key = buildFailedLoginKey(account, ipAddress);
    await query(
        `DELETE FROM auth_failed_login_attempts
         WHERE attempt_key = ?`,
        [key],
    );
}

async function createPasswordResetToken(userId) {
    await pruneState();

    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const issuedAt = new Date();
    const expiresAt = new Date(Date.now() + config.auth.resetTokenTtlMinutes * 60 * 1000);

    await query(
        `DELETE FROM auth_password_reset_tokens
         WHERE user_id = ?`,
        [userId],
    );

    await query(
        `INSERT INTO auth_password_reset_tokens (
            id, user_id, token_hash, created_at, expires_at, used_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
            crypto.randomUUID(),
            userId,
            tokenHash,
            issuedAt,
            expiresAt,
            null,
        ],
    );

    return {
        token: rawToken,
        expiresAt: expiresAt.toISOString(),
    };
}

async function findPasswordResetToken(rawToken) {
    await pruneState();

    const tokenHash = crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
    const row = await queryOne(
        `SELECT * FROM auth_password_reset_tokens
         WHERE token_hash = ?
         LIMIT 1`,
        [tokenHash],
    );

    return mapPasswordResetTokenRow(row);
}

async function consumePasswordResetToken(rawToken) {
    await pruneState();

    const tokenHash = crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');

    return withTransaction(async (connection) => {
        const [rows] = await connection.execute(
            `SELECT * FROM auth_password_reset_tokens
             WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
             LIMIT 1`,
            [tokenHash, new Date()],
        );

        const row = rows[0] || null;
        if (!row) {
            return null;
        }

        const usedAt = new Date();
        await connection.execute(
            `UPDATE auth_password_reset_tokens
             SET used_at = ?
             WHERE id = ?`,
            [usedAt, row.id],
        );

        const [userRows] = await connection.execute(
            `SELECT * FROM auth_users
             WHERE id = ?
             LIMIT 1`,
            [row.user_id],
        );

        return {
            token: {
                ...mapPasswordResetTokenRow({
                    ...row,
                    used_at: usedAt,
                }),
            },
            user: mapUserRow(userRows[0] || null),
        };
    });
}

async function recordAuditLog(payload = {}) {
    await query(
        `INSERT INTO auth_audit_logs (
            id, created_at, action, success, reason, user_id, account, requester_json, metadata_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.id || crypto.randomUUID(),
            payload.createdAt ? new Date(payload.createdAt) : new Date(),
            payload.action || 'unknown',
            payload.success === false ? 0 : 1,
            payload.reason || '',
            payload.userId || null,
            normalizeEmail(payload.account),
            payload.requester ? serializeJson(payload.requester, {}) : null,
            serializeJson(payload.metadata, {}),
        ],
    );

    await pruneState();
}

async function getAuditLogs() {
    await pruneState();

    const rows = await query(
        `SELECT * FROM auth_audit_logs
         ORDER BY created_at DESC`,
    );

    return rows.map(mapAuditLogRow);
}

async function recordUserActivity(payload = {}) {
    const normalizedPayload = normalizeActivityPayload(payload);
    if (!normalizedPayload) {
        return null;
    }

    const id = normalizedPayload.id || crypto.randomUUID();
    const createdAt = normalizedPayload.createdAt ? new Date(normalizedPayload.createdAt) : new Date();
    const updatedAt = normalizedPayload.updatedAt ? new Date(normalizedPayload.updatedAt) : new Date();
    const title = String(normalizedPayload.title || '').trim().slice(0, 255);
    const summary = String(normalizedPayload.summary || '').trim().slice(0, 4000);
    const detail = normalizedPayload.detail && typeof normalizedPayload.detail === 'object' ? normalizedPayload.detail : {};
    const metadata = normalizedPayload.metadata && typeof normalizedPayload.metadata === 'object' ? normalizedPayload.metadata : {};
    const searchableText = buildActivitySearchableText({
        ...normalizedPayload,
        title,
        summary,
        detail,
        metadata,
    });

    await query(
        `INSERT INTO auth_activity_logs (
            id, dedupe_key, user_id, file_id, activity_type, status, title, summary,
            detail_json, metadata_json, searchable_text, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            file_id = VALUES(file_id),
            activity_type = VALUES(activity_type),
            status = VALUES(status),
            title = VALUES(title),
            summary = VALUES(summary),
            detail_json = VALUES(detail_json),
            metadata_json = VALUES(metadata_json),
            searchable_text = VALUES(searchable_text),
            updated_at = VALUES(updated_at)`,
        [
            id,
            normalizedPayload.dedupeKey || null,
            normalizedPayload.userId,
            normalizedPayload.fileId || null,
            normalizedPayload.activityType,
            normalizedPayload.status || 'unknown',
            title,
            summary,
            serializeJson(detail, {}),
            serializeJson(metadata, {}),
            searchableText,
            createdAt,
            updatedAt,
        ],
    );

    if (normalizedPayload.dedupeKey) {
        const row = await queryOne(
            `SELECT a.*, u.email AS user_email, u.display_name AS user_display_name
             FROM auth_activity_logs a
             LEFT JOIN auth_users u ON u.id = a.user_id
             WHERE a.dedupe_key = ?
             LIMIT 1`,
            [normalizedPayload.dedupeKey],
        );
        return mapActivityRow(row);
    }

    const row = await queryOne(
        `SELECT a.*, u.email AS user_email, u.display_name AS user_display_name
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         WHERE a.id = ?
         LIMIT 1`,
        [id],
    );
    return mapActivityRow(row);
}

async function listUserActivities(options = {}) {
    const page = sanitizePage(options.page);
    const pageSize = sanitizePageSize(options.pageSize);
    const offset = Math.max(0, (page - 1) * pageSize);
    const { whereSql, params } = buildActivityQueryContext(options.filters || {}, {
        includeAllUsers: Boolean(options.includeAllUsers),
        userId: options.userId,
    });

    const countRow = await queryOne(
        `SELECT COUNT(*) AS total
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         ${whereSql}`,
        params,
    );

    const rows = await query(
        `SELECT a.*, u.email AS user_email, u.display_name AS user_display_name
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         ${whereSql}
         ORDER BY a.created_at DESC, a.updated_at DESC
         ${buildPaginationClause(pageSize, offset)}`,
        params,
    );

    return {
        items: rows.map(mapActivityRow),
        pagination: {
            page,
            pageSize,
            total: Number(countRow?.total || 0),
            totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / pageSize)),
        },
    };
}

async function getUserActivityAnalytics(options = {}) {
    const { whereSql, params } = buildActivityQueryContext(options.filters || {}, {
        includeAllUsers: Boolean(options.includeAllUsers),
        userId: options.userId,
    });

    const overviewRow = await queryOne(
        `SELECT COUNT(*) AS total_records, COUNT(DISTINCT a.user_id) AS unique_users
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         ${whereSql}`,
        params,
    );

    const statusRows = await query(
        `SELECT a.status AS bucket, COUNT(*) AS count
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         ${whereSql}
         GROUP BY a.status
         ORDER BY count DESC, bucket ASC`,
        params,
    );

    const activityTypeRows = await query(
        `SELECT a.activity_type AS bucket, COUNT(*) AS count
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         ${whereSql}
         GROUP BY a.activity_type
         ORDER BY count DESC, bucket ASC`,
        params,
    );

    const trendRows = await query(
        `SELECT DATE(a.created_at) AS bucket, COUNT(*) AS count
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         ${whereSql}
         GROUP BY DATE(a.created_at)
         ORDER BY bucket DESC
         LIMIT 14`,
        params,
    );

    return {
        totalRecords: Number(overviewRow?.total_records || 0),
        uniqueUsers: Number(overviewRow?.unique_users || 0),
        statusCounts: statusRows.map((row) => ({
            status: row.bucket || 'unknown',
            count: Number(row.count || 0),
        })),
        activityTypeCounts: activityTypeRows.map((row) => ({
            activityType: row.bucket || 'unknown',
            count: Number(row.count || 0),
        })),
        recentDays: trendRows
            .map((row) => ({
                date: row.bucket instanceof Date ? row.bucket.toISOString().slice(0, 10) : String(row.bucket || ''),
                count: Number(row.count || 0),
            }))
            .reverse(),
    };
}

async function listActivityUsers(filters = {}) {
    const { whereSql, params } = buildActivityQueryContext(filters, {
        includeAllUsers: true,
    });

    const rows = await query(
        `SELECT a.user_id, u.email AS user_email, u.display_name AS user_display_name, MAX(a.created_at) AS latest_created_at
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         ${whereSql}
         GROUP BY a.user_id, u.email, u.display_name
         ORDER BY latest_created_at DESC`,
        params,
    );

    return rows.map((row) => ({
        userId: row.user_id,
        email: normalizeEmail(row.user_email),
        displayName: normalizeDisplayName(row.user_display_name, row.user_email),
    }));
}

/**
 * 根据 fileId 查找用户的业务活动记录。
 * 用于 /api/minutes/:fileId 等场景在内存状态过期后从持久层兜底取回纪要数据。
 *
 * @param {object} options
 * @param {string} options.fileId 业务任务的 fileId
 * @param {string} [options.userId] 仅查询某个用户的记录；不传则忽略用户过滤（仅供管理员调用）
 * @returns {Promise<object|null>}
 */
async function findActivityByFileId(options = {}) {
    const fileId = String(options.fileId || '').trim();
    if (!fileId) {
        return null;
    }

    const userId = String(options.userId || '').trim();
    const conditions = ['a.file_id = ?'];
    const params = [fileId];

    if (userId) {
        conditions.push('a.user_id = ?');
        params.push(userId);
    }

    const row = await queryOne(
        `SELECT a.*, u.email AS user_email, u.display_name AS user_display_name
         FROM auth_activity_logs a
         LEFT JOIN auth_users u ON u.id = a.user_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.updated_at DESC, a.created_at DESC
         LIMIT 1`,
        params,
    );

    return mapActivityRow(row);
}

module.exports = {
    initializeUserStore,
    normalizeEmail,
    normalizeDisplayName,
    BUSINESS_ACTIVITY_TYPES,
    isBusinessActivityType,
    normalizeActivityTypeFilter,
    listUsers,
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    updateUserPassword,
    markUserLoginSuccess,
    getFailedLoginStatus,
    recordFailedLoginAttempt,
    clearFailedLoginAttempts,
    createPasswordResetToken,
    findPasswordResetToken,
    consumePasswordResetToken,
    recordAuditLog,
    getAuditLogs,
    recordUserActivity,
    listUserActivities,
    getUserActivityAnalytics,
    listActivityUsers,
    findActivityByFileId,
};