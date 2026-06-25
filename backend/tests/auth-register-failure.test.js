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

const ENV_KEYS = [
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'AUTH_SESSION_SECRET',
  'AUTH_COOKIE_NAME',
  'AUTH_EXPOSE_RESET_TOKEN',
  'OPENAI_API_KEY',
  'NODE_ENV',
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

async function withFailingUserStore(envOverrides, failureFactory, callback) {
  const originalEnv = {};
  ENV_KEYS.forEach((key) => { originalEnv[key] = process.env[key]; });

  Object.assign(process.env, {
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: '3306',
    MYSQL_USER: 'test',
    MYSQL_PASSWORD: '',
    MYSQL_DATABASE: 'echoflow_test',
    AUTH_SESSION_SECRET: 'register-failure-secret',
    AUTH_EXPOSE_RESET_TOKEN: 'true',
    OPENAI_API_KEY: 'test-key',
    NODE_ENV: 'test',
    ...envOverrides,
  });

  MODULES_TO_CLEAR.forEach(clearModule);

  const mockDb = createMockDb();
  setModuleExports('../utils/db', mockDb);

  // 先加载真实 userStore，再覆盖 createUser 让其抛出指定异常
  const userStore = require('../utils/userStore');
  await userStore.initializeUserStore();
  const originalCreateUser = userStore.createUser;
  userStore.createUser = async (...args) => failureFactory(args);

  const { app } = require('../app');

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await callback({ baseUrl });
  } finally {
    userStore.createUser = originalCreateUser;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    Object.entries(originalEnv).forEach(([key, value]) => restoreEnvValue(key, value));
    MODULES_TO_CLEAR.forEach(clearModule);
  }
}

test('register returns 500 REGISTER_FAILED when createUser throws an unknown error', async () => {
  await withFailingUserStore(
    {},
    () => {
      const error = new Error('unexpected db failure');
      throw error;
    },
    async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'fail-500@example.com',
          displayName: 'Fail 500',
          password: 'Password123',
        }),
      });
      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.errorCode, 'REGISTER_FAILED');
    },
  );
});

test('register returns 503 SERVICE_UNAVAILABLE when auth store reports not ready', async () => {
  await withFailingUserStore(
    {},
    () => {
      const error = new Error('auth store not ready');
      error.code = 'AUTH_STORE_NOT_READY';
      throw error;
    },
    async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'fail-503@example.com',
          displayName: 'Fail 503',
          password: 'Password123',
        }),
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.errorCode, 'SERVICE_UNAVAILABLE');
    },
  );
});

test('register returns 503 SERVICE_UNAVAILABLE when MySQL config is missing at runtime', async () => {
  await withFailingUserStore(
    {},
    () => {
      const error = new Error('MySQL not configured');
      error.code = 'MYSQL_CONFIG_MISSING';
      throw error;
    },
    async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'fail-503-cfg@example.com',
          displayName: 'Fail Cfg',
          password: 'Password123',
        }),
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.errorCode, 'SERVICE_UNAVAILABLE');
    },
  );
});

test('register still returns 409 EMAIL_ALREADY_EXISTS for duplicate emails', async () => {
  await withFailingUserStore(
    {},
    () => {
      const error = new Error('duplicate');
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    },
    async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@example.com',
          displayName: 'Dup',
          password: 'Password123',
        }),
      });
      assert.equal(response.status, 409);
      const body = await response.json();
      assert.equal(body.errorCode, 'EMAIL_ALREADY_EXISTS');
    },
  );
});
