/**
 * 视频 URL 解析与平台识别工具
 * 支持 YouTube 和 Bilibili 两大平台的多种 URL 格式
 */

const YOUTUBE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
]);

const BILIBILI_HOSTS = new Set([
    'bilibili.com',
    'www.bilibili.com',
    'm.bilibili.com',
    'b23.tv',
]);

/**
 * 解析输入字符串为 URL 对象，失败返回 null。
 * @param {string} input
 * @returns {URL|null}
 */
function safeParseUrl(input) {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
        // 若用户输入未带协议，自动补充 https://
        const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        return new URL(withProtocol);
    } catch (_err) {
        return null;
    }
}

/**
 * 识别 URL 所属平台。
 * @param {string} url - 输入的视频 URL
 * @returns {'youtube'|'bilibili'|null}
 */
function detectPlatform(url) {
    const parsed = safeParseUrl(url);
    if (!parsed) return null;
    const host = parsed.hostname.toLowerCase();
    if (YOUTUBE_HOSTS.has(host)) return 'youtube';
    if (BILIBILI_HOSTS.has(host)) return 'bilibili';
    return null;
}

/**
 * 从 URL 中提取 videoId。
 * - YouTube: 11 位字符串
 * - Bilibili: 优先 BV 号，其次 av 号；b23.tv 短链返回短码以便后续 yt-dlp 解析
 * @param {string} url
 * @param {string} [platform]
 * @returns {string|null}
 */
function extractVideoId(url, platform) {
    const parsed = safeParseUrl(url);
    if (!parsed) return null;
    const plat = platform || detectPlatform(url);
    if (!plat) return null;

    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname || '';

    if (plat === 'youtube') {
        // youtu.be/<id>
        if (host === 'youtu.be') {
            const id = pathname.replace(/^\/+/, '').split('/')[0];
            return /^[\w-]{6,}$/.test(id) ? id : null;
        }
        // /watch?v=<id>
        if (pathname === '/watch') {
            const id = parsed.searchParams.get('v');
            return id && /^[\w-]{6,}$/.test(id) ? id : null;
        }
        // /shorts/<id> 或 /embed/<id> 或 /live/<id>
        const segMatch = pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
        if (segMatch) return segMatch[2];
        // 兜底
        const v = parsed.searchParams.get('v');
        return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }

    if (plat === 'bilibili') {
        // b23.tv/<short>
        if (host === 'b23.tv') {
            const code = pathname.replace(/^\/+/, '').split('/')[0];
            return code ? `b23:${code}` : null;
        }
        // /video/BV... 或 /video/av...
        const bv = pathname.match(/\/video\/(BV[0-9A-Za-z]+)/);
        if (bv) return bv[1];
        const av = pathname.match(/\/video\/(av\d+)/i);
        if (av) return av[1].toLowerCase();
        return null;
    }

    return null;
}

/**
 * 规范化 URL：仅保留单视频信息，去掉播放列表 / 分P / 时间戳等参数。
 * 返回值为干净的字符串 URL，便于传递给 yt-dlp。
 * @param {string} url
 * @returns {string|null}
 */
function normalizeUrl(url) {
    const parsed = safeParseUrl(url);
    if (!parsed) return null;
    const plat = detectPlatform(url);
    if (!plat) return null;

    // 移除常见的播放列表 / 分P / 时间戳 / 推广 / 来源参数
    const removalKeys = [
        'list', 'index', 'start_radio',
        'p', 'spm_id_from', 'share_source', 'share_medium', 'share_plat', 'share_session_id',
        'share_tag', 'share_from', 'bbid', 'ts', 'from_source', 'vd_source',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'feature', 't', // YouTube 起始时间
    ];
    removalKeys.forEach(key => parsed.searchParams.delete(key));

    // 移除 hash（如 #reply...）
    parsed.hash = '';

    return parsed.toString();
}

/**
 * 检查 URL 是否包含播放列表/分P 等多视频指示参数。
 * @param {string} url
 * @returns {boolean}
 */
function hasPlaylistHint(url) {
    const parsed = safeParseUrl(url);
    if (!parsed) return false;
    return parsed.searchParams.has('list')
        || parsed.searchParams.has('p')
        || parsed.searchParams.has('index');
}

/**
 * 将视频标题清理为安全的文件名片段：
 * - 移除路径分隔符、空白、特殊字符
 * - 限制长度，避免文件名过长
 * @param {string} title
 * @param {number} [maxLength=60]
 * @returns {string}
 */
function sanitizeTitle(title, maxLength = 60) {
    if (typeof title !== 'string' || !title.trim()) return 'untitled';
    let cleaned = title
        .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_.\-]+|[_.\-]+$/g, '');
    if (!cleaned) cleaned = 'untitled';
    if (cleaned.length > maxLength) cleaned = cleaned.slice(0, maxLength);
    return cleaned;
}

module.exports = {
    detectPlatform,
    extractVideoId,
    normalizeUrl,
    hasPlaylistHint,
    sanitizeTitle,
};
