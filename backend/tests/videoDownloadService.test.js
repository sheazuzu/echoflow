/**
 * videoDownloadService 单元测试
 * 通过劫持 child_process 模块来 mock yt-dlp 调用
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { EventEmitter } = require('events');

// ---- 模块缓存清理工具 ----
function clearCachedModule(modulePath) {
    try {
        delete require.cache[require.resolve(modulePath)];
    } catch (_e) { /* ignore */ }
}

function clearAll() {
    clearCachedModule('../services/videoDownloadService');
    clearCachedModule('../config');
}

// ---- mock child_process ----
// 我们替换 require.cache 中 child_process 的导出
function installChildProcessMock(impl) {
    const cpPath = require.resolve('child_process');
    require.cache[cpPath] = {
        id: cpPath,
        filename: cpPath,
        loaded: true,
        exports: impl,
    };
}

function restoreChildProcess() {
    const cpPath = require.resolve('child_process');
    delete require.cache[cpPath];
}

test('mapYtDlpError: 识别各种错误类型', () => {
    clearAll();
    const svc = require('../services/videoDownloadService');
    assert.equal(svc.mapYtDlpError('ERROR: Video unavailable').code, 'video_unavailable');
    assert.equal(svc.mapYtDlpError('ERROR: This video is not available in your country').code, 'geo_restricted');
    assert.equal(svc.mapYtDlpError('ERROR: Private video. Sign in if you have access.').code, 'private_video');
    assert.equal(svc.mapYtDlpError('ERROR: Confirm your age').code, 'age_restricted');
    assert.equal(svc.mapYtDlpError('ERROR: Unsupported URL').code, 'not_a_video_url');
    assert.equal(svc.mapYtDlpError('ERROR: timed out').code, 'timeout');
    assert.equal(svc.mapYtDlpError('ERROR: HTTP Error 503: Service Unavailable').code, 'network_error');
    assert.equal(svc.mapYtDlpError('').code, 'unknown');
    assert.equal(svc.mapYtDlpError('some random error').code, 'unknown');
});

test('ERROR_CODES: 包含中英文文案且不为空', () => {
    clearAll();
    const svc = require('../services/videoDownloadService');
    for (const code of ['video_unavailable', 'geo_restricted', 'private_video', 'network_error', 'timeout', 'unknown']) {
        const m = svc.ERROR_CODES[code];
        assert.ok(m, `missing code ${code}`);
        assert.ok(m.en && m.en.length > 0, `missing en for ${code}`);
        assert.ok(m.zh && m.zh.length > 0, `missing zh for ${code}`);
    }
});

test('fetchVideoMetadata: 成功解析 yt-dlp dump-json 输出', async () => {
    clearAll();
    const fakeJson = {
        id: 'dQw4w9WgXcQ',
        title: 'Test Video Title',
        duration: 213,
        uploader: 'Rick Astley',
        upload_date: '20091025',
        thumbnail: 'https://i.ytimg.com/vi/x.jpg',
        webpage_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        extractor: 'youtube',
        ext: 'm4a',
    };

    installChildProcessMock({
        execFile: (binary, args, opts, cb) => {
            // 验证调用方式：参数数组而非 shell 字符串
            assert.ok(Array.isArray(args));
            assert.ok(args.includes('--dump-json'));
            assert.ok(args.includes('--no-playlist'));
            cb(null, JSON.stringify(fakeJson), '');
        },
        spawn: () => { throw new Error('spawn should not be called'); },
    });

    const svc = require('../services/videoDownloadService');
    const meta = await svc.fetchVideoMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(meta.title, 'Test Video Title');
    assert.equal(meta.duration, 213);
    assert.equal(meta.uploader, 'Rick Astley');
    assert.equal(meta.platform, 'youtube');
    assert.equal(meta.videoId, 'dQw4w9WgXcQ');
    assert.equal(meta.ext, 'm4a');

    restoreChildProcess();
});

test('fetchVideoMetadata: yt-dlp 返回错误时映射为友好错误码', async () => {
    clearAll();
    installChildProcessMock({
        execFile: (binary, args, opts, cb) => {
            const err = new Error('Command failed');
            err.code = 1;
            cb(err, '', 'ERROR: Video unavailable');
        },
        spawn: () => { throw new Error('spawn should not be called'); },
    });

    const svc = require('../services/videoDownloadService');
    let thrown = null;
    try {
        await svc.fetchVideoMetadata('https://www.youtube.com/watch?v=abc');
    } catch (err) {
        thrown = err;
    }
    assert.ok(thrown);
    assert.equal(thrown.code, 'video_unavailable');
    assert.ok(thrown.userMessage && thrown.userMessage.zh && thrown.userMessage.en);

    restoreChildProcess();
});

test('fetchVideoMetadata: yt-dlp 不存在时返回 yt_dlp_missing', async () => {
    clearAll();
    installChildProcessMock({
        execFile: (binary, args, opts, cb) => {
            const err = new Error('spawn ENOENT');
            err.code = 'ENOENT';
            cb(err, '', '');
        },
        spawn: () => { throw new Error('spawn should not be called'); },
    });

    const svc = require('../services/videoDownloadService');
    let thrown = null;
    try {
        await svc.fetchVideoMetadata('https://www.youtube.com/watch?v=abc');
    } catch (err) {
        thrown = err;
    }
    assert.ok(thrown);
    assert.equal(thrown.code, 'yt_dlp_missing');

    restoreChildProcess();
});

test('downloadAudio: 成功路径解析 stdout 中的 Destination 与进度', async () => {
    clearAll();

    // 创建一个 fake child 进程
    const fakeChild = new EventEmitter();
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.kill = () => {};

    installChildProcessMock({
        execFile: () => { throw new Error('execFile should not be called'); },
        spawn: (binary, args) => {
            assert.ok(Array.isArray(args));
            assert.ok(args.includes('--no-playlist'));
            // 异步触发数据 + close 事件
            setImmediate(() => {
                fakeChild.stdout.emit('data', Buffer.from('[download]  10.0% of 5.00MiB\n'));
                fakeChild.stdout.emit('data', Buffer.from('[download]  50.0% of 5.00MiB\n'));
                fakeChild.stdout.emit('data', Buffer.from('[download] 100.0% of 5.00MiB\n'));
                fakeChild.stdout.emit('data', Buffer.from(`[download] Destination: ${outputFilePath}\n`));
                fakeChild.emit('close', 0, null);
            });
            return fakeChild;
        },
    });

    // 准备一个真实存在的临时输出文件，让 service 内部 fs.existsSync 通过
    const fs = require('fs');
    const os = require('os');
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-url-test-'));
    const outputPathNoExt = path.join(outputDir, 'test_output');
    const outputFilePath = `${outputPathNoExt}.m4a`;
    fs.writeFileSync(outputFilePath, 'fake audio content');

    const svc = require('../services/videoDownloadService');
    const progress = [];
    const result = await svc.downloadAudio('https://www.youtube.com/watch?v=abc', outputPathNoExt, {
        onProgress: (p) => progress.push(p),
        timeoutMs: 5000,
    });

    assert.equal(result.filePath, outputFilePath);
    assert.ok(result.fileSizeBytes > 0);
    assert.deepEqual(progress, [10, 50, 100]);

    // 清理
    try { fs.unlinkSync(outputFilePath); } catch (_e) { /* ignore */ }
    try { fs.rmdirSync(outputDir); } catch (_e) { /* ignore */ }
    restoreChildProcess();
});

test('downloadAudio: 非零退出码映射为对应错误码', async () => {
    clearAll();

    const fakeChild = new EventEmitter();
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    fakeChild.kill = () => {};

    installChildProcessMock({
        execFile: () => { throw new Error('execFile should not be called'); },
        spawn: () => {
            setImmediate(() => {
                fakeChild.stderr.emit('data', Buffer.from('ERROR: Video unavailable\n'));
                fakeChild.emit('close', 1, null);
            });
            return fakeChild;
        },
    });

    const svc = require('../services/videoDownloadService');
    const fs = require('fs');
    const os = require('os');
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-url-test-'));

    let thrown = null;
    try {
        await svc.downloadAudio('https://www.youtube.com/watch?v=abc', path.join(outputDir, 'x'));
    } catch (err) {
        thrown = err;
    }
    assert.ok(thrown);
    assert.equal(thrown.code, 'video_unavailable');

    try { fs.rmdirSync(outputDir); } catch (_e) { /* ignore */ }
    restoreChildProcess();
});

test('downloadAudio: 超时被强制 kill 返回 timeout', async () => {
    clearAll();

    const fakeChild = new EventEmitter();
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();
    let killed = false;
    fakeChild.kill = (sig) => {
        killed = true;
        // 模拟 SIGKILL 后子进程关闭
        setImmediate(() => fakeChild.emit('close', null, sig));
    };

    installChildProcessMock({
        execFile: () => { throw new Error('execFile should not be called'); },
        spawn: () => fakeChild,
    });

    const svc = require('../services/videoDownloadService');
    const fs = require('fs');
    const os = require('os');
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-url-test-'));

    let thrown = null;
    try {
        // 给一个很短的 timeout，会立刻触发 SIGKILL
        await svc.downloadAudio('https://www.youtube.com/watch?v=abc', path.join(outputDir, 'x'), {
            timeoutMs: 20,
        });
    } catch (err) {
        thrown = err;
    }
    assert.ok(thrown);
    assert.equal(thrown.code, 'timeout');
    assert.ok(killed);

    try { fs.rmdirSync(outputDir); } catch (_e) { /* ignore */ }
    restoreChildProcess();
});
