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

function loadAuthModules(envOverrides = {}) {
  const originalEnv = {
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_PORT: process.env.MYSQL_PORT,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_DATABASE: process.env.MYSQL_DATABASE,
    AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
    AUTH_RESET_TOKEN_TTL_MINUTES: process.env.AUTH_RESET_TOKEN_TTL_MINUTES,
    AUTH_MAX_FAILED_ATTEMPTS: process.env.AUTH_MAX_FAILED_ATTEMPTS,
    AUTH_FAILED_LOGIN_WINDOW_MINUTES: process.env.AUTH_FAILED_LOGIN_WINDOW_MINUTES,
    AUTH_LOCKOUT_MINUTES: process.env.AUTH_LOCKOUT_MINUTES,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  Object.assign(process.env, {
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: '3306',
    MYSQL_USER: 'test',
    MYSQL_PASSWORD: '',
    MYSQL_DATABASE: 'echoflow_test',
    OPENAI_API_KEY: 'test-key',
    NODE_ENV: 'test',
    ...envOverrides,
  });

  clearModule('../config');
  clearModule('../utils/requestIdentity');
  clearModule('../utils/db');
  clearModule('../utils/userAuth');
  clearModule('../utils/userStore');

  const mockDb = createMockDb();
  setModuleExports('../utils/db', mockDb);

  const userAuth = require('../utils/userAuth');
  const userStore = require('../utils/userStore');

  return {
    userAuth,
    userStore,
    mockDb,
    restore: () => {
      Object.entries(originalEnv).forEach(([key, value]) => restoreEnvValue(key, value));
      clearModule('../config');
      clearModule('../utils/requestIdentity');
      clearModule('../utils/db');
      clearModule('../utils/userAuth');
      clearModule('../utils/userStore');
    },
  };
}

test('userAuth hashes password and verifies session token', () => {
  const { userAuth, restore } = loadAuthModules({
    AUTH_SESSION_SECRET: 'user-session-secret',
  });

  try {
    const passwordHash = userAuth.createPasswordHash('Password123');
    assert.equal(userAuth.verifyPassword('Password123', passwordHash), true);
    assert.equal(userAuth.verifyPassword('wrong', passwordHash), false);

    const token = userAuth.createUserSessionToken({ userId: 'user-1', email: 'demo@example.com', role: 'user', clientId: 'client-1' });
    const validResult = userAuth.verifyUserSessionToken(token, { clientId: 'client-1' });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.payload.userId, 'user-1');

    const mismatchResult = userAuth.verifyUserSessionToken(token, { clientId: 'client-2' });
    assert.equal(mismatchResult.valid, false);
    assert.equal(mismatchResult.reason, 'client_mismatch');
  } finally {
    restore();
  }
});

test('userStore supports user lifecycle, rate limit tracking and password reset', async () => {
  const { userAuth, userStore, restore } = loadAuthModules({
    AUTH_MAX_FAILED_ATTEMPTS: '3',
    AUTH_FAILED_LOGIN_WINDOW_MINUTES: '30',
    AUTH_LOCKOUT_MINUTES: '20',
    AUTH_RESET_TOKEN_TTL_MINUTES: '60',
  });

  try {
    await userStore.initializeUserStore();

    const createdUser = await userStore.createUser({
      email: 'User@example.com',
      displayName: '测试用户',
      passwordHash: userAuth.createPasswordHash('Password123'),
    });

    assert.equal(createdUser.email, 'user@example.com');
    assert.equal((await userStore.findUserByEmail('USER@example.com')).id, createdUser.id);

    const updatedUser = await userStore.updateUser(createdUser.id, {
      ...createdUser,
      displayName: '新的名称',
      profile: {
        timezone: 'Asia/Shanghai',
        bio: '测试简介',
      },
    });

    assert.equal(updatedUser.displayName, '新的名称');
    assert.equal(updatedUser.profile.timezone, 'Asia/Shanghai');

    const failed1 = await userStore.recordFailedLoginAttempt(createdUser.email, '127.0.0.1');
    const failed2 = await userStore.recordFailedLoginAttempt(createdUser.email, '127.0.0.1');
    const failed3 = await userStore.recordFailedLoginAttempt(createdUser.email, '127.0.0.1');
    assert.equal(failed1.locked, false);
    assert.equal(failed2.locked, false);
    assert.equal(failed3.locked, true);

    const lockStatus = await userStore.getFailedLoginStatus(createdUser.email, '127.0.0.1');
    assert.equal(lockStatus.locked, true);
    assert.equal(lockStatus.count, 3);

    await userStore.clearFailedLoginAttempts(createdUser.email, '127.0.0.1');
    const clearedStatus = await userStore.getFailedLoginStatus(createdUser.email, '127.0.0.1');
    assert.equal(clearedStatus.locked, false);
    assert.equal(clearedStatus.count, 0);

    const resetIssued = await userStore.createPasswordResetToken(createdUser.id);
    assert.ok(resetIssued.token);
    assert.ok(resetIssued.expiresAt);

    const resetStored = await userStore.findPasswordResetToken(resetIssued.token);
    assert.equal(resetStored.userId, createdUser.id);

    const consumed = await userStore.consumePasswordResetToken(resetIssued.token);
    assert.equal(consumed.user.id, createdUser.id);
    assert.equal(await userStore.findPasswordResetToken(resetIssued.token), null);

    await userStore.recordAuditLog({
      action: 'login',
      success: true,
      userId: createdUser.id,
      account: createdUser.email,
      requester: { clientId: 'client-1', ip: '127.0.0.1' },
    });

    assert.equal((await userStore.getAuditLogs()).length > 0, true);
  } finally {
    restore();
  }
});