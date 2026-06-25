const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockDb } = require('./helpers/mockAuthDb');

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function setModuleExports(modulePath, exportsObject) {
  require.cache[require.resolve(modulePath)] = {
    id: require.resolve(modulePath),
    filename: require.resolve(modulePath),
    loaded: true,
    exports: exportsObject,
  };
}

function restoreEnvValue(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function createCookieHeader(setCookieHeaders = []) {
  return setCookieHeaders.map((value) => value.split(';')[0]).join('; ');
}

const ENV_KEYS = [
  'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE',
  'AUTH_SESSION_SECRET', 'AUTH_COOKIE_NAME', 'AUTH_EXPOSE_RESET_TOKEN',
  'OPENAI_API_KEY', 'NODE_ENV',
];

const MODULES_TO_CLEAR = [
  '../config',
  '../utils/requestIdentity',
  '../utils/db',
  '../utils/userStore',
  '../utils/userAuth',
  '../middleware/auth',
  '../utils/processManager',
  '../routes/auth',
  '../routes/progress',
  '../routes/history',
  '../routes/admin',
  '../app',
];

async function withDiagnosticsServer({ envOverrides = {}, dbOverrides = {} }, callback) {
  const originalEnv = {};
  ENV_KEYS.forEach((key) => { originalEnv[key] = process.env[key]; });

  Object.assign(process.env, {
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: '3306',
    MYSQL_USER: 'test',
    MYSQL_PASSWORD: '',
    MYSQL_DATABASE: 'echoflow_test',
    AUTH_SESSION_SECRET: 'diagnostics-secret',
    AUTH_EXPOSE_RESET_TOKEN: 'true',
    OPENAI_API_KEY: 'test-key',
    NODE_ENV: 'test',
    ...envOverrides,
  });

  MODULES_TO_CLEAR.forEach(clearModule);

  const mockDb = createMockDb();
  const dbModule = { ...mockDb, ...dbOverrides };
  setModuleExports('../utils/db', dbModule);

  const userStore = require('../utils/userStore');
  await userStore.initializeUserStore();

  const { app } = require('../app');
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await callback({ baseUrl, userStore });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    Object.entries(originalEnv).forEach(([key, value]) => restoreEnvValue(key, value));
    MODULES_TO_CLEAR.forEach(clearModule);
  }
}

async function registerAndPromote(baseUrl, userStore, email, role) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      displayName: email.split('@')[0],
      password: 'Password123',
    }),
  });
  assert.equal(response.status, 201);
  const cookies = createCookieHeader(response.headers.getSetCookie());
  if (role) {
    const user = await userStore.findUserByEmail(email);
    await userStore.updateUser(user.id, { ...user, role });
  }
  return cookies;
}

test('GET /api/admin/diagnostics/db returns 200 with metadata for admin user', async () => {
  await withDiagnosticsServer({}, async ({ baseUrl, userStore }) => {
    const adminCookies = await registerAndPromote(baseUrl, userStore, 'diag-admin@example.com', 'admin');
    // admin role 是新会话才生效，这里需要 admin 重新登录
    const loginResp = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'diag-admin@example.com', password: 'Password123' }),
    });
    assert.equal(loginResp.status, 200);
    const adminCookies2 = createCookieHeader(loginResp.headers.getSetCookie());

    const response = await fetch(`${baseUrl}/api/admin/diagnostics/db`, {
      headers: { Cookie: adminCookies2 || adminCookies },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.host, '127.0.0.1');
    assert.equal(body.database, 'echoflow_test');
    assert.equal(body.user, 'test');
    assert.equal(body.hasPassword, false);
    assert.equal(body.ping, 'ok');
    assert.equal(body.currentSchema, 'echoflow_test');
    assert.ok(body.serverVersion);
  });
});

test('GET /api/admin/diagnostics/db returns 403 for non-admin user', async () => {
  await withDiagnosticsServer({}, async ({ baseUrl, userStore }) => {
    const memberCookies = await registerAndPromote(baseUrl, userStore, 'diag-member@example.com', null);
    const response = await fetch(`${baseUrl}/api/admin/diagnostics/db`, {
      headers: { Cookie: memberCookies },
    });
    assert.equal(response.status, 403);
  });
});

test('GET /api/admin/diagnostics/db returns ping=fail when MySQL is unreachable', async () => {
  const failingPing = async () => ({
    ok: false,
    durationMs: 5,
    error: 'ECONNREFUSED',
    code: 'ECONNREFUSED',
    serverVersion: null,
    currentSchema: null,
  });

  await withDiagnosticsServer(
    { dbOverrides: { pingPool: failingPing } },
    async ({ baseUrl, userStore }) => {
      await registerAndPromote(baseUrl, userStore, 'diag-admin2@example.com', 'admin');
      const loginResp = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'diag-admin2@example.com', password: 'Password123' }),
      });
      const adminCookies = createCookieHeader(loginResp.headers.getSetCookie());

      const response = await fetch(`${baseUrl}/api/admin/diagnostics/db`, {
        headers: { Cookie: adminCookies },
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.ping, 'fail');
      assert.equal(body.pingError, 'ECONNREFUSED');
      assert.equal(body.serverVersion, null);
    },
  );
});
