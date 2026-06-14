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

async function withTestServer(envOverrides, callback) {
  const originalEnv = {
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_PORT: process.env.MYSQL_PORT,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_DATABASE: process.env.MYSQL_DATABASE,
    AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
    AUTH_EXPOSE_RESET_TOKEN: process.env.AUTH_EXPOSE_RESET_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  Object.assign(process.env, {
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: '3306',
    MYSQL_USER: 'test',
    MYSQL_PASSWORD: '',
    MYSQL_DATABASE: 'echoflow_test',
    AUTH_SESSION_SECRET: 'route-test-secret',
    AUTH_EXPOSE_RESET_TOKEN: 'true',
    OPENAI_API_KEY: 'test-key',
    NODE_ENV: 'test',
    ...envOverrides,
  });

  clearModule('../config');
  clearModule('../utils/requestIdentity');
  clearModule('../utils/db');
  clearModule('../utils/userStore');
  clearModule('../utils/userAuth');
  clearModule('../middleware/auth');
  clearModule('../utils/processManager');
  clearModule('../routes/auth');
  clearModule('../routes/progress');
  clearModule('../routes/history');
  clearModule('../routes/admin');
  clearModule('../app');

  const mockDb = createMockDb();
  setModuleExports('../utils/db', mockDb);

  const { app } = require('../app');
  const processManager = require('../utils/processManager');
  const userStore = require('../utils/userStore');

  await userStore.initializeUserStore();

  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await callback({ baseUrl, processManager, userStore, mockDb });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    Object.entries(originalEnv).forEach(([key, value]) => restoreEnvValue(key, value));
    clearModule('../config');
    clearModule('../utils/requestIdentity');
    clearModule('../utils/db');
    clearModule('../utils/userStore');
    clearModule('../utils/userAuth');
    clearModule('../middleware/auth');
    clearModule('../utils/processManager');
    clearModule('../routes/auth');
    clearModule('../routes/progress');
    clearModule('../routes/history');
    clearModule('../routes/admin');
    clearModule('../app');
  }
}

test('auth routes support register, session restore, protected resources and logout', async () => {
  await withTestServer({}, async ({ baseUrl, processManager, userStore }) => {
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@example.com',
        displayName: 'Owner',
        password: 'Password123',
      }),
    });

    assert.equal(registerResponse.status, 201);
    const registerBody = await registerResponse.json();
    assert.equal(registerBody.success, true);
    assert.equal(registerBody.authenticated, true);
    assert.equal(registerBody.user.email, 'owner@example.com');

    const ownerCookies = createCookieHeader(registerResponse.headers.getSetCookie());
    assert.match(ownerCookies, /echoflow_user_session/);

    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: ownerCookies },
    });
    const sessionBody = await sessionResponse.json();
    assert.equal(sessionBody.authenticated, true);
    assert.equal(sessionBody.user.email, 'owner@example.com');

    const profileUnauthed = await fetch(`${baseUrl}/api/auth/profile`);
    assert.equal(profileUnauthed.status, 401);

    const ownerUser = await userStore.findUserByEmail('owner@example.com');
    processManager.setStatus('file-owner', {
      status: 'completed',
      progress: 100,
      ownerUserId: ownerUser.id,
      minutesData: { chinese: { title: '测试纪要' } },
      transcript: 'hello world',
      transcriptCosKey: 'local-transcript',
      cosKey: 'audio-key',
    });

    const ownerProgress = await fetch(`${baseUrl}/api/progress/file-owner`, {
      headers: { Cookie: ownerCookies },
    });
    assert.equal(ownerProgress.status, 200);

    const otherRegister = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'other@example.com',
        displayName: 'Other',
        password: 'Password123',
      }),
    });
    const otherCookies = createCookieHeader(otherRegister.headers.getSetCookie());

    const otherProgress = await fetch(`${baseUrl}/api/progress/file-owner`, {
      headers: { Cookie: otherCookies },
    });
    assert.equal(otherProgress.status, 403);

    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: ownerCookies },
    });
    assert.equal(logoutResponse.status, 200);
  });
});

test('password reset flow issues token and allows login with new password', async () => {
  await withTestServer({}, async ({ baseUrl }) => {
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reset@example.com',
        displayName: 'Reset User',
        password: 'Password123',
      }),
    });
    assert.equal(registerResponse.status, 201);

    const forgotResponse = await fetch(`${baseUrl}/api/auth/password/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'reset@example.com' }),
    });
    assert.equal(forgotResponse.status, 200);

    const forgotBody = await forgotResponse.json();
    assert.equal(forgotBody.success, true);
    assert.ok(forgotBody.resetToken.token);

    const resetResponse = await fetch(`${baseUrl}/api/auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: forgotBody.resetToken.token,
        newPassword: 'Password456',
      }),
    });
    assert.equal(resetResponse.status, 200);

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reset@example.com',
        password: 'Password456',
      }),
    });
    assert.equal(loginResponse.status, 200);
    const loginBody = await loginResponse.json();
    assert.equal(loginBody.success, true);
    assert.equal(loginBody.authenticated, true);
  });
});

test('history routes only return the current user business records and support analytics', async () => {
  await withTestServer({}, async ({ baseUrl, userStore }) => {
    const ownerRegister = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'history-owner@example.com',
        displayName: 'History Owner',
        password: 'Password123',
      }),
    });
    const ownerCookies = createCookieHeader(ownerRegister.headers.getSetCookie());
    const ownerUser = await userStore.findUserByEmail('history-owner@example.com');

    const otherRegister = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'history-other@example.com',
        displayName: 'History Other',
        password: 'Password123',
      }),
    });
    const otherUser = await userStore.findUserByEmail('history-other@example.com');

    await userStore.recordUserActivity({
      dedupeKey: `upload-task:${ownerUser.id}:file-owner-1`,
      userId: ownerUser.id,
      fileId: 'file-owner-1',
      activityType: 'upload_task',
      status: 'completed',
      title: 'Owner Meeting',
      summary: 'Owner summary',
      detail: { stage: 'completed' },
      metadata: { originalFilename: 'owner.mp3' },
    });

    await userStore.recordUserActivity({
      dedupeKey: `download-audio:${ownerUser.id}:file-owner-1`,
      userId: ownerUser.id,
      fileId: 'file-owner-1',
      activityType: 'download_audio',
      status: 'completed',
      title: 'Owner Download',
      summary: 'This should be ignored',
      detail: {},
      metadata: {},
    });

    await userStore.recordUserActivity({
      dedupeKey: `upload-task:${otherUser.id}:file-other-1`,
      userId: otherUser.id,
      fileId: 'file-other-1',
      activityType: 'upload_task',
      status: 'failed',
      title: 'Other Meeting',
      summary: 'Other summary',
      detail: { stage: 'error' },
      metadata: { originalFilename: 'other.mp3' },
    });

    const historyResponse = await fetch(`${baseUrl}/api/history?page=1&pageSize=12`, {
      headers: { Cookie: ownerCookies },
    });
    assert.equal(historyResponse.status, 200);
    const historyBody = await historyResponse.json();
    assert.equal(historyBody.success, true);
    assert.equal(historyBody.items.length, 1);
    assert.equal(historyBody.items[0].title, 'Owner Meeting');
    assert.equal(historyBody.pagination.page, 1);
    assert.equal(historyBody.pagination.pageSize, 12);

    const analyticsResponse = await fetch(`${baseUrl}/api/history/analytics`, {
      headers: { Cookie: ownerCookies },
    });
    assert.equal(analyticsResponse.status, 200);
    const analyticsBody = await analyticsResponse.json();
    assert.equal(analyticsBody.success, true);
    assert.equal(analyticsBody.analytics.totalRecords, 1);
    assert.equal(analyticsBody.analytics.uniqueUsers, 1);
    assert.deepEqual(analyticsBody.analytics.activityTypeCounts, [
      {
        activityType: 'upload_task',
        count: 1,
      },
    ]);
  });
});

test('admin dashboard requires admin role and returns cross-user business records for admins', async () => {
  await withTestServer({}, async ({ baseUrl, userStore }) => {
    const adminRegister = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        displayName: 'Admin User',
        password: 'Password123',
      }),
    });
    const adminCookies = createCookieHeader(adminRegister.headers.getSetCookie());
    const adminUser = await userStore.findUserByEmail('admin@example.com');
    await userStore.updateUser(adminUser.id, { ...adminUser, role: 'admin' });

    const memberRegister = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member@example.com',
        displayName: 'Member User',
        password: 'Password123',
      }),
    });
    const memberCookies = createCookieHeader(memberRegister.headers.getSetCookie());
    const memberUser = await userStore.findUserByEmail('member@example.com');

    await userStore.recordUserActivity({
      dedupeKey: `upload-task:${adminUser.id}:admin-file`,
      userId: adminUser.id,
      fileId: 'admin-file',
      activityType: 'upload_task',
      status: 'completed',
      title: 'Admin Activity',
      summary: 'Admin summary',
      detail: {},
      metadata: {},
    });

    await userStore.recordUserActivity({
      dedupeKey: `download-audio:${memberUser.id}:member-file`,
      userId: memberUser.id,
      fileId: 'member-file',
      activityType: 'download_audio',
      status: 'completed',
      title: 'Member Download',
      summary: 'This should be ignored',
      detail: {},
      metadata: {},
    });

    await userStore.recordUserActivity({
      dedupeKey: `upload-task:${memberUser.id}:member-file`,
      userId: memberUser.id,
      fileId: 'member-file',
      activityType: 'upload_task',
      status: 'failed',
      title: 'Member Activity',
      summary: 'Member summary',
      detail: {},
      metadata: {},
    });

    const forbiddenResponse = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Cookie: memberCookies },
    });
    assert.equal(forbiddenResponse.status, 403);

    const adminResponse = await fetch(`${baseUrl}/api/admin/dashboard?page=1&pageSize=20`, {
      headers: { Cookie: adminCookies },
    });
    assert.equal(adminResponse.status, 200);
    const adminBody = await adminResponse.json();
    assert.equal(adminBody.success, true);
    assert.equal(adminBody.actor.role, 'admin');
    assert.equal(adminBody.records.length, 2);
    assert.equal(adminBody.overview.totalRecords, 2);
    assert.equal(adminBody.overview.activeUsers, 2);
    assert.deepEqual(adminBody.overview.activityTypeCounts, [
      {
        activityType: 'upload_task',
        count: 2,
      },
    ]);
  });
});
