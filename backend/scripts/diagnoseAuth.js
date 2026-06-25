#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 注册链路诊断脚本（独立运行，不依赖 Express）
 *
 * 用法：
 *   node scripts/diagnoseAuth.js
 *   node scripts/diagnoseAuth.js --email=foo@bar.com
 *
 * 该脚本依次执行：
 *   1) 打印当前 MYSQL_* 环境变量（密码脱敏）
 *   2) SELECT 1 健康检查
 *   3) SELECT COUNT(*) FROM auth_users
 *   4) （可选）尝试用临时密码 INSERT 一行 -> SELECT 校验 -> DELETE 回滚
 *   5) 全部步骤打印 PASS/FAIL，任一失败以非零退出
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const crypto = require('crypto');
const mysql = require('mysql2/promise');

function parseArgs(argv) {
    const args = { email: '' };
    for (const raw of argv.slice(2)) {
        const match = /^--([^=]+)=(.*)$/.exec(raw);
        if (match) {
            args[match[1]] = match[2];
        } else if (raw.startsWith('--')) {
            args[raw.slice(2)] = true;
        }
    }
    return args;
}

function maskPassword(value) {
    if (!value) return '';
    if (value.length <= 4) return '*'.repeat(value.length);
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function step(name, ok, detail) {
    const tag = ok ? 'PASS' : 'FAIL';
    const symbol = ok ? '✅' : '❌';
    console.log(`${symbol} [${tag}] ${name}${detail ? ' -> ' + detail : ''}`);
}

async function main() {
    const args = parseArgs(process.argv);
    const failures = [];

    const env = {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || '',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || '',
    };

    // Step 1: 打印环境变量（密码脱敏）
    console.log('========== Step 1: MYSQL_* 环境变量 ==========');
    console.log(`MYSQL_HOST     = ${env.host}`);
    console.log(`MYSQL_PORT     = ${env.port}`);
    console.log(`MYSQL_USER     = ${env.user || '(empty)'}`);
    console.log(`MYSQL_PASSWORD = ${env.password ? maskPassword(env.password) : '(empty)'}`);
    console.log(`MYSQL_DATABASE = ${env.database || '(empty)'}`);

    if (!env.host || !env.user || !env.database) {
        step('环境变量完整性', false, '缺失必填项 (MYSQL_HOST / MYSQL_USER / MYSQL_DATABASE)');
        console.log('\n👉 next-step：检查容器是否注入了 .env，或 docker-compose 是否覆盖了对应变量');
        process.exit(1);
    }
    step('环境变量完整性', true);

    // Step 2: 建立连接 + SELECT 1
    console.log('\n========== Step 2: 建立连接并 SELECT 1 ==========');
    let connection = null;
    try {
        connection = await mysql.createConnection({
            host: env.host,
            port: env.port,
            user: env.user,
            password: env.password,
            database: env.database,
            connectTimeout: 5000,
        });
        const [rows] = await connection.query('SELECT 1 AS ok');
        const ok = Array.isArray(rows) && rows[0] && (rows[0].ok === 1 || rows[0].ok === '1');
        if (!ok) throw new Error('SELECT 1 返回值异常');
        step('SELECT 1', true);
    } catch (error) {
        step('SELECT 1', false, `${error.code || ''} ${error.message}`);
        console.log('\n👉 next-step：');
        console.log('   - 网络不通：在容器内 telnet 数据库 host port 验证');
        console.log('   - 鉴权失败：核对 MYSQL_USER / MYSQL_PASSWORD');
        console.log('   - 库不存在：核对 MYSQL_DATABASE 是否拼写错误');
        if (connection) await connection.end().catch(() => {});
        process.exit(1);
    }

    // Step 3: SELECT COUNT(*) FROM auth_users
    console.log('\n========== Step 3: SELECT COUNT(*) FROM auth_users ==========');
    let userCount = 0;
    try {
        const [rows] = await connection.query('SELECT COUNT(*) AS c FROM auth_users');
        userCount = Number(rows[0].c || 0);
        step('auth_users 表读取', true, `当前共 ${userCount} 条记录`);
    } catch (error) {
        step('auth_users 表读取', false, `${error.code || ''} ${error.message}`);
        console.log('\n👉 next-step：');
        console.log('   - 表不存在：执行项目内 schema 初始化脚本');
        console.log('   - 用户无 SELECT 权限：GRANT SELECT ON `<db>`.* TO `<user>`@`%`');
        await connection.end().catch(() => {});
        process.exit(1);
    }

    // Step 4: 可选写入探针（仅当传入 --email 时）
    if (args.email) {
        console.log('\n========== Step 4: 写入探针 INSERT -> SELECT -> DELETE ==========');
        const probeId = `diag-${crypto.randomBytes(6).toString('hex')}`;
        const probeEmail = String(args.email).trim().toLowerCase();
        try {
            const [existing] = await connection.query(
                'SELECT id FROM auth_users WHERE email = ?',
                [probeEmail],
            );
            if (Array.isArray(existing) && existing.length > 0) {
                step('指定 email 不冲突', false, `${probeEmail} 已存在，请换一个 --email 再跑`);
                failures.push('email_conflict');
            } else {
                await connection.query(
                    `INSERT INTO auth_users (
                        id, email, display_name, password_hash, role, profile_json,
                        created_at, updated_at, last_login_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)`,
                    [probeId, probeEmail, 'diagnose-probe', 'diag-not-a-real-hash', 'user', '{}'],
                );
                step('INSERT 一行测试数据', true, `id=${probeId}`);

                const [verify] = await connection.query(
                    'SELECT id, email FROM auth_users WHERE id = ?',
                    [probeId],
                );
                if (Array.isArray(verify) && verify.length === 1 && verify[0].email === probeEmail) {
                    step('SELECT 校验写入', true);
                } else {
                    step('SELECT 校验写入', false, '写入后立即 SELECT 不到，疑似主从延迟或库不一致');
                    failures.push('select_after_insert_failed');
                }

                const [del] = await connection.query(
                    'DELETE FROM auth_users WHERE id = ?',
                    [probeId],
                );
                if (del && del.affectedRows === 1) {
                    step('DELETE 清理测试数据', true);
                } else {
                    step('DELETE 清理测试数据', false, `affectedRows=${del && del.affectedRows}`);
                    failures.push('delete_failed');
                }
            }
        } catch (error) {
            step('写入探针', false, `${error.code || ''} ${error.message}`);
            console.log('\n👉 next-step：');
            console.log('   - 用户无 INSERT/DELETE 权限：GRANT INSERT, DELETE ON `<db>`.`auth_users` TO `<user>`@`%`');
            console.log('   - 字段不匹配：检查 auth_users 表结构是否与 createUser SQL 对应');
            failures.push('write_probe_exception');
            // 兜底清理
            try { await connection.query('DELETE FROM auth_users WHERE id = ?', [probeId]); } catch (_) { /* ignore */ }
        }
    } else {
        console.log('\n========== Step 4: 写入探针 (skipped, 未传 --email) ==========');
    }

    await connection.end().catch(() => {});

    console.log('\n========== Summary ==========');
    if (failures.length === 0) {
        console.log('✅ 全部检查通过');
        process.exit(0);
    } else {
        console.log(`❌ 发现 ${failures.length} 项失败：${failures.join(', ')}`);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('💥 诊断脚本异常退出:', error && error.stack ? error.stack : error);
    process.exit(1);
});
