const crypto = require('crypto');
const mysql = require('mysql2/promise');
const logger = require('./logger');

const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = 'sha256';
const STORE_DRIVER = process.env.USER_STORE_DRIVER || 'mysql';

let pool = null;
let initialized = false;

const memoryState = {
    users: [],
    workspaces: [],
    memberships: [],
};

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto
        .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
        .toString('hex');

    return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash = '') {
    const [algorithm, iterations, salt, hash] = storedHash.split('$');
    if (algorithm !== 'pbkdf2' || !iterations || !salt || !hash) {
        return false;
    }

    const candidate = crypto
        .pbkdf2Sync(password, salt, Number(iterations), PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
        .toString('hex');

    const expected = Buffer.from(hash, 'hex');
    const actual = Buffer.from(candidate, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function getMysqlConfig() {
    return {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || 'echoflow',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'echoflow',
        waitForConnections: true,
        connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
        queueLimit: 0,
        namedPlaceholders: true,
        timezone: 'Z',
    };
}

function rowToPublicUser(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        email: row.email,
        name: row.name,
        status: row.status,
        isSystemAdmin: Boolean(row.is_system_admin ?? row.isSystemAdmin),
        createdAt: row.created_at || row.createdAt,
        workspace: row.workspace_id ? {
            id: row.workspace_id,
            name: row.workspace_name,
            role: row.workspace_role,
            plan: row.workspace_plan,
        } : null,
    };
}

async function getPool() {
    if (!pool) {
        pool = mysql.createPool(getMysqlConfig());
    }
    return pool;
}

async function initializeMysqlStore() {
    const db = await getPool();

    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id CHAR(36) PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(120) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            is_system_admin TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME(3) NOT NULL,
            updated_at DATETIME(3) NOT NULL,
            last_login_at DATETIME(3) NULL,
            INDEX idx_users_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS workspaces (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            owner_user_id CHAR(36) NOT NULL,
            plan VARCHAR(32) NOT NULL DEFAULT 'free',
            created_at DATETIME(3) NOT NULL,
            updated_at DATETIME(3) NOT NULL,
            INDEX idx_workspaces_owner (owner_user_id),
            CONSTRAINT fk_workspaces_owner
                FOREIGN KEY (owner_user_id) REFERENCES users(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS workspace_memberships (
            workspace_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            role VARCHAR(32) NOT NULL DEFAULT 'member',
            joined_at DATETIME(3) NOT NULL,
            PRIMARY KEY (workspace_id, user_id),
            INDEX idx_workspace_memberships_user (user_id),
            CONSTRAINT fk_workspace_memberships_workspace
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_workspace_memberships_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    initialized = true;
    logger.info('USER_STORE_MYSQL_READY', {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        database: process.env.MYSQL_DATABASE || 'echoflow',
    });
}

async function initializeUserStore() {
    if (STORE_DRIVER === 'memory') {
        initialized = true;
        return 'memory';
    }

    if (!initialized) {
        await initializeMysqlStore();
    }

    return 'mysql';
}

async function ensureInitialized() {
    if (!initialized) {
        await initializeUserStore();
    }
}

function validateNewUser({ email, password, name }) {
    const normalizedEmail = normalizeEmail(email);
    const cleanName = String(name || '').trim().slice(0, 80) || normalizedEmail.split('@')[0];

    if (!isValidEmail(normalizedEmail)) {
        const error = new Error('请输入有效的邮箱地址');
        error.statusCode = 400;
        throw error;
    }

    if (!password || String(password).length < 8) {
        const error = new Error('密码至少需要 8 个字符');
        error.statusCode = 400;
        throw error;
    }

    return { normalizedEmail, cleanName };
}

function publicMemoryUser(user) {
    if (!user) {
        return null;
    }

    const membership = memoryState.memberships.find(item => item.userId === user.id);
    const workspace = membership
        ? memoryState.workspaces.find(item => item.id === membership.workspaceId)
        : null;

    return rowToPublicUser({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        is_system_admin: user.isSystemAdmin,
        created_at: user.createdAt,
        workspace_id: workspace?.id,
        workspace_name: workspace?.name,
        workspace_role: membership?.role,
        workspace_plan: workspace?.plan,
    });
}

async function createUserInMemory({ email, password, name }) {
    const { normalizedEmail, cleanName } = validateNewUser({ email, password, name });

    if (memoryState.users.some(user => user.email === normalizedEmail)) {
        const error = new Error('该邮箱已经注册');
        error.statusCode = 409;
        throw error;
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const firstUser = memoryState.users.length === 0;

    const user = {
        id: userId,
        email: normalizedEmail,
        name: cleanName,
        passwordHash: hashPassword(String(password)),
        status: 'active',
        isSystemAdmin: firstUser,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
    };

    memoryState.users.push(user);
    memoryState.workspaces.push({
        id: workspaceId,
        name: `${cleanName}'s Workspace`,
        ownerUserId: userId,
        plan: 'free',
        createdAt: now,
        updatedAt: now,
    });
    memoryState.memberships.push({
        workspaceId,
        userId,
        role: 'owner',
        joinedAt: now,
    });

    return publicMemoryUser(user);
}

async function createUserInMysql({ email, password, name }) {
    const { normalizedEmail, cleanName } = validateNewUser({ email, password, name });
    const db = await getPool();
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [existingRows] = await connection.query(
            'SELECT id FROM users WHERE email = :email LIMIT 1',
            { email: normalizedEmail }
        );

        if (existingRows.length > 0) {
            const error = new Error('该邮箱已经注册');
            error.statusCode = 409;
            throw error;
        }

        const [countRows] = await connection.query('SELECT COUNT(*) AS count FROM users');
        const firstUser = Number(countRows[0]?.count || 0) === 0;
        const now = new Date();
        const userId = crypto.randomUUID();
        const workspaceId = crypto.randomUUID();

        await connection.query(
            `INSERT INTO users
                (id, email, name, password_hash, status, is_system_admin, created_at, updated_at)
             VALUES
                (:id, :email, :name, :passwordHash, 'active', :isSystemAdmin, :createdAt, :updatedAt)`,
            {
                id: userId,
                email: normalizedEmail,
                name: cleanName,
                passwordHash: hashPassword(String(password)),
                isSystemAdmin: firstUser ? 1 : 0,
                createdAt: now,
                updatedAt: now,
            }
        );

        await connection.query(
            `INSERT INTO workspaces
                (id, name, owner_user_id, plan, created_at, updated_at)
             VALUES
                (:id, :name, :ownerUserId, 'free', :createdAt, :updatedAt)`,
            {
                id: workspaceId,
                name: `${cleanName}'s Workspace`,
                ownerUserId: userId,
                createdAt: now,
                updatedAt: now,
            }
        );

        await connection.query(
            `INSERT INTO workspace_memberships
                (workspace_id, user_id, role, joined_at)
             VALUES
                (:workspaceId, :userId, 'owner', :joinedAt)`,
            {
                workspaceId,
                userId,
                joinedAt: now,
            }
        );

        await connection.commit();
        return await findUserById(userId);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function createUser(payload) {
    await ensureInitialized();

    if (STORE_DRIVER === 'memory') {
        return createUserInMemory(payload);
    }

    return createUserInMysql(payload);
}

async function authenticateUser(email, password) {
    await ensureInitialized();

    const normalizedEmail = normalizeEmail(email);

    if (STORE_DRIVER === 'memory') {
        const user = memoryState.users.find(item => item.email === normalizedEmail && item.status === 'active');
        if (!user || !verifyPassword(String(password || ''), user.passwordHash)) {
            const error = new Error('邮箱或密码不正确');
            error.statusCode = 401;
            throw error;
        }

        user.lastLoginAt = new Date().toISOString();
        user.updatedAt = user.lastLoginAt;
        return publicMemoryUser(user);
    }

    const db = await getPool();
    const [rows] = await db.query(
        `SELECT id, email, name, password_hash
         FROM users
         WHERE email = :email AND status = 'active'
         LIMIT 1`,
        { email: normalizedEmail }
    );

    const user = rows[0];
    if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
        const error = new Error('邮箱或密码不正确');
        error.statusCode = 401;
        throw error;
    }

    await db.query(
        'UPDATE users SET last_login_at = :lastLoginAt, updated_at = :updatedAt WHERE id = :id',
        { id: user.id, lastLoginAt: new Date(), updatedAt: new Date() }
    );

    return findUserById(user.id);
}

async function findUserById(userId) {
    await ensureInitialized();

    if (STORE_DRIVER === 'memory') {
        return publicMemoryUser(memoryState.users.find(user => user.id === userId && user.status === 'active'));
    }

    const db = await getPool();
    const [rows] = await db.query(
        `SELECT
            u.id,
            u.email,
            u.name,
            u.status,
            u.is_system_admin,
            u.created_at,
            w.id AS workspace_id,
            w.name AS workspace_name,
            w.plan AS workspace_plan,
            wm.role AS workspace_role
         FROM users u
         LEFT JOIN workspace_memberships wm ON wm.user_id = u.id
         LEFT JOIN workspaces w ON w.id = wm.workspace_id
         WHERE u.id = :userId AND u.status = 'active'
         ORDER BY wm.joined_at ASC
         LIMIT 1`,
        { userId }
    );

    return rowToPublicUser(rows[0]);
}

function resetMemoryStoreForTests() {
    memoryState.users = [];
    memoryState.workspaces = [];
    memoryState.memberships = [];
    initialized = STORE_DRIVER === 'memory';
}

module.exports = {
    initializeUserStore,
    createUser,
    authenticateUser,
    findUserById,
    resetMemoryStoreForTests,
};
