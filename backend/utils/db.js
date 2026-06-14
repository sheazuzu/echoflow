const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('./logger');

let pool = null;

function getMysqlLogMeta() {
    return {
        host: config.mysql.host,
        port: config.mysql.port,
        database: config.mysql.database,
        user: config.mysql.user,
        connectionLimit: config.mysql.connectionLimit,
        queueLimit: config.mysql.queueLimit,
        charset: config.mysql.charset,
        timezone: config.mysql.timezone,
        hasPassword: Boolean(config.mysql.password),
    };
}

function summarizeSql(sql) {
    return String(sql || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function ensureMysqlConfigured() {
    if (!config.isMysqlConfigured) {
        logger.error('MYSQL_CONFIG_MISSING', {
            message: 'MySQL 配置不完整，无法初始化数据库连接',
            ...getMysqlLogMeta(),
        });

        const error = new Error('MySQL 配置不完整，无法初始化数据库连接');
        error.code = 'MYSQL_CONFIG_MISSING';
        throw error;
    }
}

function getPool() {
    if (pool) {
        return pool;
    }

    ensureMysqlConfigured();

    logger.info('MYSQL_POOL_CREATING', {
        message: '正在创建 MySQL 连接池',
        ...getMysqlLogMeta(),
    });

    pool = mysql.createPool({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        waitForConnections: true,
        connectionLimit: config.mysql.connectionLimit,
        queueLimit: config.mysql.queueLimit,
        charset: config.mysql.charset,
        timezone: config.mysql.timezone,
        namedPlaceholders: true,
        decimalNumbers: true,
    });

    logger.info('MYSQL_POOL_READY', {
        message: 'MySQL 连接池创建完成',
        ...getMysqlLogMeta(),
    });

    return pool;
}

async function testConnection() {
    const activePool = getPool();

    logger.info('MYSQL_CONNECTION_CHECK_START', {
        message: '正在检查 MySQL 连接状态',
        ...getMysqlLogMeta(),
    });

    let connection = null;

    try {
        connection = await activePool.getConnection();
        await connection.ping();

        logger.info('MYSQL_CONNECTION_CHECK_OK', {
            message: 'MySQL 连接正常',
            ...getMysqlLogMeta(),
            threadId: connection.threadId,
        });
    } catch (error) {
        logger.error('MYSQL_CONNECTION_CHECK_FAILED', {
            message: 'MySQL 连接检查失败',
            ...getMysqlLogMeta(),
            error: error && error.message,
            code: error && error.code,
            errno: error && error.errno,
            sqlState: error && error.sqlState,
            stack: error && error.stack,
        });
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function query(sql, params) {
    const activePool = getPool();

    try {
        const [rows] = await activePool.execute(sql, params);
        return rows;
    } catch (error) {
        logger.error('MYSQL_QUERY_FAILED', {
            message: 'MySQL 查询执行失败',
            ...getMysqlLogMeta(),
            code: error && error.code,
            errno: error && error.errno,
            sqlState: error && error.sqlState,
            error: error && error.message,
            sql: summarizeSql(sql),
            parameterCount: Array.isArray(params) ? params.length : 0,
            stack: error && error.stack,
        });
        throw error;
    }
}

async function queryOne(sql, params) {
    const rows = await query(sql, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function withTransaction(handler) {
    const activePool = getPool();
    const connection = await activePool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await handler(connection);
        await connection.commit();
        return result;
    } catch (error) {
        logger.error('MYSQL_TRANSACTION_FAILED', {
            message: 'MySQL 事务执行失败，准备回滚',
            ...getMysqlLogMeta(),
            code: error && error.code,
            errno: error && error.errno,
            sqlState: error && error.sqlState,
            error: error && error.message,
            stack: error && error.stack,
        });
        await connection.rollback();
        return Promise.reject(error);
    } finally {
        connection.release();
    }
}

async function closePool() {
    if (!pool) {
        return;
    }

    try {
        await pool.end();
        logger.info('MYSQL_POOL_CLOSED', {
            message: 'MySQL 连接池已关闭',
            ...getMysqlLogMeta(),
        });
    } catch (error) {
        logger.warn('MYSQL_POOL_CLOSE_FAILED', {
            message: 'MySQL 连接池关闭失败',
            ...getMysqlLogMeta(),
            error: error && error.message,
            code: error && error.code,
            stack: error && error.stack,
        });
        throw error;
    } finally {
        pool = null;
    }
}

module.exports = {
    getPool,
    testConnection,
    query,
    queryOne,
    withTransaction,
    closePool,
    ensureMysqlConfigured,
};