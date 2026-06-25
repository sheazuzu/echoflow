const test = require('node:test');
const assert = require('node:assert/strict');

const {
    detectPlatform,
    extractVideoId,
    normalizeUrl,
    hasPlaylistHint,
    sanitizeTitle,
} = require('../utils/videoUrlParser');

test('detectPlatform: 识别 YouTube 各种格式', () => {
    assert.equal(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
    assert.equal(detectPlatform('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
    assert.equal(detectPlatform('https://www.youtube.com/shorts/abc12345678'), 'youtube');
    assert.equal(detectPlatform('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
});

test('detectPlatform: 识别 Bilibili 各种格式', () => {
    assert.equal(detectPlatform('https://www.bilibili.com/video/BV1xx411c7mD'), 'bilibili');
    assert.equal(detectPlatform('https://www.bilibili.com/video/av123456'), 'bilibili');
    assert.equal(detectPlatform('https://b23.tv/abc123'), 'bilibili');
    assert.equal(detectPlatform('https://m.bilibili.com/video/BV1xx411c7mD'), 'bilibili');
});

test('detectPlatform: 不支持的平台或非法 URL 返回 null', () => {
    assert.equal(detectPlatform('https://vimeo.com/12345'), null);
    assert.equal(detectPlatform('https://example.com/video'), null);
    assert.equal(detectPlatform(''), null);
    assert.equal(detectPlatform(null), null);
    assert.equal(detectPlatform('not-a-url'), null);
});

test('extractVideoId: YouTube 各种格式', () => {
    assert.equal(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extractVideoId('https://www.youtube.com/shorts/abc12345678'), 'abc12345678');
    assert.equal(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=20s'), 'dQw4w9WgXcQ');
});

test('extractVideoId: Bilibili BV/av/b23 短链', () => {
    assert.equal(extractVideoId('https://www.bilibili.com/video/BV1xx411c7mD'), 'BV1xx411c7mD');
    assert.equal(extractVideoId('https://www.bilibili.com/video/BV1xx411c7mD/?p=2'), 'BV1xx411c7mD');
    assert.equal(extractVideoId('https://www.bilibili.com/video/av123456'), 'av123456');
    assert.equal(extractVideoId('https://b23.tv/abc123'), 'b23:abc123');
});

test('extractVideoId: 非法 URL 返回 null', () => {
    assert.equal(extractVideoId('https://www.youtube.com/'), null);
    assert.equal(extractVideoId('https://www.bilibili.com/'), null);
    assert.equal(extractVideoId('not-a-url'), null);
});

test('normalizeUrl: 移除播放列表与推广参数', () => {
    const cleaned = normalizeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234&index=2&t=30s');
    assert.ok(cleaned && cleaned.includes('v=dQw4w9WgXcQ'));
    assert.ok(cleaned && !cleaned.includes('list='));
    assert.ok(cleaned && !cleaned.includes('index='));
    assert.ok(cleaned && !cleaned.includes('t=30s'));
});

test('normalizeUrl: 移除 Bilibili 分P 与来源参数', () => {
    const cleaned = normalizeUrl('https://www.bilibili.com/video/BV1xx411c7mD/?p=3&spm_id_from=333.788&vd_source=abc');
    assert.ok(cleaned && cleaned.includes('BV1xx411c7mD'));
    assert.ok(cleaned && !cleaned.includes('p=3'));
    assert.ok(cleaned && !cleaned.includes('spm_id_from'));
    assert.ok(cleaned && !cleaned.includes('vd_source'));
});

test('normalizeUrl: 非法 URL 返回 null', () => {
    assert.equal(normalizeUrl('not-a-url'), null);
    assert.equal(normalizeUrl(''), null);
});

test('hasPlaylistHint: 检测 list/p/index 参数', () => {
    assert.equal(hasPlaylistHint('https://www.youtube.com/watch?v=abc&list=PL1234'), true);
    assert.equal(hasPlaylistHint('https://www.bilibili.com/video/BV1xx?p=3'), true);
    assert.equal(hasPlaylistHint('https://www.youtube.com/watch?v=abc'), false);
    assert.equal(hasPlaylistHint('https://www.bilibili.com/video/BV1xx'), false);
});

test('sanitizeTitle: 清理特殊字符', () => {
    assert.equal(sanitizeTitle('Hello / World \\ Test'), 'Hello_World_Test');
    assert.equal(sanitizeTitle('  多个   空格  '), '多个_空格');
    assert.equal(sanitizeTitle('正常标题'), '正常标题');
});

test('sanitizeTitle: 截断超长标题', () => {
    const long = 'a'.repeat(200);
    const result = sanitizeTitle(long, 60);
    assert.equal(result.length, 60);
});

test('sanitizeTitle: 空值或非字符串返回 untitled', () => {
    assert.equal(sanitizeTitle(''), 'untitled');
    assert.equal(sanitizeTitle(null), 'untitled');
    assert.equal(sanitizeTitle(undefined), 'untitled');
    assert.equal(sanitizeTitle('///'), 'untitled');
});
