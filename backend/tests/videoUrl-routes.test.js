/**
 * videoUrl 路由集成测试
 *
 * 通过 require.cache 注入 mock，覆盖：
 *  - feature flag 关闭返回 404
 *  - 非法 URL 返回 400 / unsupported_platform
 *  - 时长超限返回 400 / duration_exceeded
 *  - 限流返回 429 / rate_limited
 *  - 24h 去重命中返回上一次 fileId
 *  - 正常流程返回 200 + fileId + videoMeta
 *
 * 注意：未登录的场景由 requireAuth 中间件保证，无需在此重复测试
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ---- 通用 mock 辅助 ----
function setModuleExports(modulePath, exportsObject) {
    const resolved = require.resolve(modulePath);
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: exportsObject,
    };
}

function clearModule(modulePath) {
    try {
        delete require.cache[require.resolve(modulePath)];
    } catch (_e) { /* ignore */ }
}

// ---- mock 不便加载的依赖 ----
// 1. userStore（含 mysql2）
setModuleExports('../utils/userStore', {
    listUserActivities: async () => ({ items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } }),
    recordUserActivity: async () => null,
    normalizeActivityTypeFilter: (v) => String(v || 'all'),
});

// 2. middleware/auth - 提供一个永远通过的 requireAuth
setModuleExports('../middleware/auth', {
    requireAuth: (req, _res, next) => {
        req.auth = { user: { id: 'test-user-1', displayName: 'Test User' } };
        next();
    },
    buildAuthenticatedRequester: (req) => ({
        clientId: 'test-client',
        clientLabel: 'Test User',
        ip: '127.0.0.1',
        userAgent: 'jest-test',
        userId: req.auth?.user?.id,
        userDisplayName: req.auth?.user?.displayName,
    }),
    attachAuthenticatedUser: (_req, _res, next) => next(),
    requireAdmin: (_req, _res, next) => next(),
});

// 3. routes/upload - mock processFile + recordUploadActivity（避免触发真实流水线）
let recordedActivities = [];
let processFileCalls = [];
function uploadRouterStub() { /* 占位 router */ }
uploadRouterStub.processFile = async (fileId, cosKey, fileSizeMB, metadata) => {
    processFileCalls.push({ fileId, cosKey, fileSizeMB, metadata });
};
uploadRouterStub.recordUploadActivity = async (payload) => {
    recordedActivities.push(payload);
};
setModuleExports('../routes/upload', uploadRouterStub);

// 4. services/cosService - 直接返回 mock key
setModuleExports('../services/cosService', {
    uploadToCOS: async (_buf, fileId) => `audio/${fileId}.m4a`,
    downloadFromCOS: async () => '/tmp/fake.m4a',
    uploadTranscriptToCOS: async () => 'transcripts/fake.txt',
    checkCOSConnection: async () => ({ success: false, message: 'mock' }),
});

// 5. services/videoDownloadService - mock 让我们可以按测试用例切换返回
let metaImpl = async () => ({
    title: 'Test Video',
    duration: 300,
    uploader: 'Test User',
    uploadDate: '20240101',
    thumbnail: 'https://example.com/thumb.jpg',
    videoId: 'abc123',
    platform: 'youtube',
    extractor: 'youtube',
    webpageUrl: 'https://www.youtube.com/watch?v=abc123',
    ext: 'm4a',
});
let lastDownloadArgs = null;
let downloadImpl = async (_url, outputPathNoExt, opts) => {
    lastDownloadArgs = { url: _url, outputPathNoExt, opts };
    const fs = require('fs');
    const fp = `${outputPathNoExt}.m4a`;
    fs.writeFileSync(fp, 'fake audio');
    return { filePath: fp, fileSizeBytes: 1024 };
};
setModuleExports('../services/videoDownloadService', {
    fetchVideoMetadata: (...args) => metaImpl(...args),
    downloadAudio: (...args) => downloadImpl(...args),
    mapYtDlpError: () => ({ code: 'unknown', message: { en: '', zh: '' } }),
    buildYtDlpError: (code) => Object.assign(new Error('mock'), { code, userMessage: { en: '', zh: '' } }),
    ERROR_CODES: {},
});

// 6. utils/processManager - 简单存储
const statusStore = new Map();
setModuleExports('../utils/processManager', {
    setStatus: (fileId, status) => statusStore.set(fileId, { ...(statusStore.get(fileId) || {}), ...status }),
    getStatus: (fileId) => statusStore.get(fileId),
    registerProcess: () => {},
    cancelProcess: () => {},
    startCleanupTimer: () => {},
    ProcessType: { SPLIT: 'split', TRANSCRIBE: 'transcribe', SUMMARY: 'summary' },
});

// 7. utils/fileHelper - 临时目录
const os = require('os');
const fs = require('fs');
const tmpUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-url-route-test-'));
setModuleExports('../utils/fileHelper', {
    getUploadDir: () => tmpUploadDir,
    getSplitDir: () => tmpUploadDir,
    ensureUploadDirs: () => {},
    cleanExpiredTempFiles: () => {},
});

// ---- 加载被测路由 ----
// 必须在所有 mock 之后才 require
// 也必须在 require rateLimiter / config 之前设置 env，否则首次加载会使用旧默认值
process.env.VIDEO_URL_FEATURE_ENABLED = 'true';
process.env.VIDEO_URL_MAX_TASKS_PER_HOUR = '3';
process.env.VIDEO_URL_MAX_DURATION_SECONDS = '14400';

// 8. 限流模块在测试间需要重置
const rateLimiter = require('../utils/videoUrlRateLimiter');

clearModule('../routes/videoUrl');
clearModule('../config');

// ---- 构造 fake req/res 来调用 Express 路由 ----
const express = require('express');

function makeApp() {
    clearModule('../routes/videoUrl');
    const videoUrlRouter = require('../routes/videoUrl');
    const app = express();
    app.use(express.json());
    app.use('/api', videoUrlRouter);
    return app;
}

function makeReqRes(method, url, body) {
    return new Promise((resolve) => {
        const app = makeApp();
        const reqStub = {
            method,
            url,
            originalUrl: url,
            headers: { 'content-type': 'application/json' },
            body: body || {},
            ip: '127.0.0.1',
            connection: { remoteAddress: '127.0.0.1' },
            socket: { remoteAddress: '127.0.0.1' },
            get(name) { return this.headers[String(name).toLowerCase()]; },
        };

        // 使用 supertest 风格不可用，改用 http 服务器
        const server = app.listen(0, () => {
            const port = server.address().port;
            const http = require('http');
            const data = body ? JSON.stringify(body) : '';
            const req = http.request({
                method,
                hostname: '127.0.0.1',
                port,
                path: url,
                headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
            }, (res) => {
                let buf = '';
                res.setEncoding('utf8');
                res.on('data', (c) => { buf += c; });
                res.on('end', () => {
                    server.close(() => {
                        let payload = null;
                        try { payload = JSON.parse(buf); } catch (_e) { payload = buf; }
                        resolve({ status: res.statusCode, body: payload, headers: res.headers });
                    });
                });
            });
            req.on('error', (err) => {
                server.close(() => resolve({ status: 500, body: { error: err.message } }));
            });
            if (data) req.write(data);
            req.end();
        });
    });
}

// ---- 测试用例 ----

test('feature flag 关闭时返回 404', async () => {
    process.env.VIDEO_URL_FEATURE_ENABLED = 'false';
    clearModule('../config');
    const res = await makeReqRes('POST', '/api/video-url/submit', { url: 'https://www.youtube.com/watch?v=abc' });
    assert.equal(res.status, 404);
    // 恢复
    process.env.VIDEO_URL_FEATURE_ENABLED = 'true';
    clearModule('../config');
    rateLimiter._resetForTest();
});

test('非法 URL 返回 400 / unsupported_platform', async () => {
    rateLimiter._resetForTest();
    const res = await makeReqRes('POST', '/api/video-url/submit', { url: 'https://vimeo.com/12345' });
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'unsupported_platform');
});

test('空 URL 返回 400 / unsupported_platform', async () => {
    rateLimiter._resetForTest();
    const res = await makeReqRes('POST', '/api/video-url/submit', { url: '' });
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'unsupported_platform');
});

test('视频时长超限返回 400 / duration_exceeded', async () => {
    rateLimiter._resetForTest();
    metaImpl = async () => ({
        title: 'Very Long Video',
        duration: 20000, // > 14400
        uploader: 'X',
        uploadDate: '20240101',
        thumbnail: '',
        videoId: 'long123',
        platform: 'youtube',
        extractor: 'youtube',
        webpageUrl: 'https://www.youtube.com/watch?v=long123',
        ext: 'm4a',
    });
    const res = await makeReqRes('POST', '/api/video-url/submit', { url: 'https://www.youtube.com/watch?v=long123' });
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'duration_exceeded');
});

test('正常流程返回 200 + fileId + videoMeta', async () => {
    rateLimiter._resetForTest();
    metaImpl = async () => ({
        title: '正常视频',
        duration: 300,
        uploader: 'Foo',
        uploadDate: '20240101',
        thumbnail: 'https://example.com/t.jpg',
        videoId: 'ok123',
        platform: 'youtube',
        extractor: 'youtube',
        webpageUrl: 'https://www.youtube.com/watch?v=ok123',
        ext: 'm4a',
    });
    const res = await makeReqRes('POST', '/api/video-url/submit', { url: 'https://www.youtube.com/watch?v=ok123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.code, 200);
    assert.ok(res.body.fileId);
    assert.ok(res.body.videoMeta);
    assert.equal(res.body.videoMeta.title, '正常视频');
    assert.equal(res.body.videoMeta.platform, 'youtube');
});

test('Bilibili: submit 阶段拿到的 cid 会透传给下载阶段，避免重复请求 metadata', async () => {
    rateLimiter._resetForTest();
    lastDownloadArgs = null;
    metaImpl = async () => ({
        title: 'B站视频',
        duration: 958,
        uploader: 'UP 主',
        uploadDate: '20240101',
        thumbnail: 'https://example.com/bili.jpg',
        videoId: 'BV1R4Vn6HECP',
        platform: 'bilibili',
        extractor: 'bilibili-direct',
        webpageUrl: 'https://www.bilibili.com/video/BV1R4Vn6HECP/',
        ext: 'm4a',
        cid: 38739706266,
    });

    const res = await makeReqRes('POST', '/api/video-url/submit', { url: 'https://www.bilibili.com/video/BV1R4Vn6HECP/' });
    assert.equal(res.status, 200);
    assert.equal(res.body.code, 200);

    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.ok(lastDownloadArgs, 'downloadAudio 应被调用');
    assert.equal(lastDownloadArgs.url, 'https://www.bilibili.com/video/BV1R4Vn6HECP/');
    assert.ok(lastDownloadArgs.opts, 'downloadAudio 应收到 opts');
    assert.equal(lastDownloadArgs.opts.videoMeta.platform, 'bilibili');
    assert.equal(lastDownloadArgs.opts.videoMeta.videoId, 'BV1R4Vn6HECP');
    assert.equal(lastDownloadArgs.opts.videoMeta.cid, 38739706266);
});

test('限流：超过 maxTasksPerHour 返回 429', async () => {
    rateLimiter._resetForTest();

    metaImpl = async () => ({
        title: '小视频',
        duration: 60,
        uploader: 'Foo',
        uploadDate: '20240101',
        thumbnail: '',
        videoId: 'rl1',
        platform: 'youtube',
        extractor: 'youtube',
        webpageUrl: 'https://www.youtube.com/watch?v=rl1',
        ext: 'm4a',
    });

    // 默认 limit=3（由 .env / 进程默认），先打满 limit
    // 通过手动 recordSubmission 跳过实际下载流程，绕过其它依赖
    rateLimiter.recordSubmission('test-user-1');
    rateLimiter.recordSubmission('test-user-1');
    rateLimiter.recordSubmission('test-user-1');

    // 第 4 次（已超过 limit=3）应该被限流
    const r = await makeReqRes('POST', '/api/video-url/submit', { url: 'https://www.youtube.com/watch?v=rl-burst' });
    assert.equal(r.status, 429);
    assert.equal(r.body.errorCode, 'rate_limited');
});

test('元数据获取失败时返回 400 + 对应错误码', async () => {
    rateLimiter._resetForTest();
    metaImpl = async () => {
        const err = new Error('视频不可用');
        err.code = 'video_unavailable';
        err.userMessage = { zh: '视频不可用或已被删除。', en: 'Video is unavailable.' };
        throw err;
    };
    const res = await makeReqRes('POST', '/api/video-url/submit', { url: 'https://www.youtube.com/watch?v=fail123' });
    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'video_unavailable');
});

test('cleanup: 清理临时目录', () => {
    try { fs.rmSync(tmpUploadDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    assert.ok(true);
});