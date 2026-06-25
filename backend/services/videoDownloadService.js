/**
 * yt-dlp 视频下载服务封装
 *
 * 安全要求：
 *  - 仅通过 execFile 以参数数组方式调用 yt-dlp，禁止任何 shell 拼接，防止命令注入
 *  - 用户传入的 URL 仅作为 argv 末尾参数
 *  - 全部子进程均设置超时，超时后强制 SIGKILL
 */

const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const bilibiliDirect = require('./bilibiliDirectService');

const DEFAULT_TIMEOUT_MS = 600000; // 10 分钟

// 用一个常见浏览器 UA，避免被 B 站等站点根据 yt-dlp 默认 UA 拦截（HTTP 412）
const DEFAULT_BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * 根据 URL 域名构造平台特定的 HTTP 头参数（UA / Referer）。
 * 主要用于绕过 Bilibili 的 412 反爬：B 站要求请求带浏览器 UA 与 bilibili.com Referer。
 * YouTube 也带上 UA 以提升稳定性。
 * @param {string} url
 * @returns {string[]} 注入到 yt-dlp argv 的参数片段
 */
function buildPlatformHeaderArgs(url) {
    const args = ['--user-agent', DEFAULT_BROWSER_UA];
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (host.includes('bilibili.com') || host === 'b23.tv') {
            args.push('--referer', 'https://www.bilibili.com');
            // B 站常见的两个 cookie 字段如果通过 --add-header 透传可以进一步降低 412 概率
            args.push('--add-header', 'Origin: https://www.bilibili.com');
        } else if (host.includes('youtube.com') || host === 'youtu.be') {
            args.push('--referer', 'https://www.youtube.com');
        }
    } catch (_e) {
        // URL 解析失败时不附加 Referer，仅保留 UA
    }
    return args;
}

/**
 * 错误码与中英文友好提示映射。
 * 对外暴露便于路由层做 i18n 文案选择。
 */
const ERROR_CODES = {
    video_unavailable: {
        en: 'Video is unavailable or has been removed.',
        zh: '视频不可用或已被删除。',
    },
    geo_restricted: {
        en: 'This video is not available in your region.',
        zh: '该视频在当前地区不可访问。',
    },
    private_video: {
        en: 'This video is private and requires login.',
        zh: '该视频为私密视频，需要登录后才能访问。',
    },
    age_restricted: {
        en: 'This video is age-restricted and requires authentication.',
        zh: '该视频受年龄限制，需要登录后才能访问。',
    },
    network_error: {
        en: 'Network error or anti-bot block while accessing the video (HTTP 4xx/5xx). For Bilibili you may need to provide a cookies.txt file; please try again later.',
        zh: '访问视频时网络异常或被站点风控拦截（HTTP 4xx/5xx）。Bilibili 链接可能需要提供 cookies.txt，请稍后重试或更换链接。',
    },
    timeout: {
        en: 'Video download timed out, please try a shorter video or try again later.',
        zh: '视频下载超时，请尝试较短的视频或稍后重试。',
    },
    not_a_video_url: {
        en: 'The URL does not appear to be a video link.',
        zh: '链接看起来不是有效的视频地址。',
    },
    yt_dlp_missing: {
        en: 'yt-dlp is not installed on the server.',
        zh: '服务器未安装 yt-dlp，无法处理视频链接。',
    },
    unknown: {
        en: 'Failed to download the video.',
        zh: '视频下载失败，请稍后重试。',
    },
};

/**
 * 解析 yt-dlp stderr 输出，识别错误类型。
 * @param {string} stderr
 * @returns {{ code: string, message: { en: string, zh: string } }}
 */
function mapYtDlpError(stderr) {
    const text = String(stderr || '').toLowerCase();
    let code = 'unknown';

    if (!text.trim()) {
        code = 'unknown';
    } else if (text.includes('enoent') || text.includes('not found') && text.includes('yt-dlp')) {
        code = 'yt_dlp_missing';
    } else if (text.includes('video unavailable') || text.includes('this video has been removed') || text.includes('content isn\'t available')) {
        code = 'video_unavailable';
    } else if (text.includes('not available in your country') || text.includes('geo') && text.includes('restrict')) {
        code = 'geo_restricted';
    } else if (text.includes('private video') || text.includes('sign in') || text.includes('login required')) {
        code = 'private_video';
    } else if (text.includes('age restrict') || text.includes('confirm your age')) {
        code = 'age_restricted';
    } else if (text.includes('unsupported url') || text.includes('no video could be found') || text.includes('is not a valid url')) {
        code = 'not_a_video_url';
    } else if (text.includes('http error 412') || text.includes('precondition failed')) {
        // B 站等站点的风控拦截，归类为 network_error 让前端展示统一文案
        code = 'network_error';
    } else if (text.includes('http error 4') || text.includes('http error 5') || text.includes('unable to download') || text.includes('connection') || text.includes('timed out') || text.includes('timeout') || text.includes('network')) {
        code = text.includes('timeout') || text.includes('timed out') ? 'timeout' : 'network_error';
    }

    return { code, message: ERROR_CODES[code] };
}

/**
 * 创建一个自定义错误对象。
 * @param {string} code
 * @param {string} stderr
 * @returns {Error}
 */
function buildYtDlpError(code, stderr = '') {
    const info = ERROR_CODES[code] || ERROR_CODES.unknown;
    const err = new Error(info.zh);
    err.code = code;
    err.userMessage = info; // { en, zh }
    err.stderr = stderr;
    return err;
}

/**
 * 通用 yt-dlp 执行函数（带超时和缓冲区上限）。
 * @param {string[]} args
 * @param {object} opts
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function runYtDlp(args, opts = {}) {
    const binary = config.videoUrl?.ytDlpBinary || 'yt-dlp';
    const timeoutMs = Number(opts.timeoutMs || config.videoUrl?.ytDlpTimeoutMs || DEFAULT_TIMEOUT_MS);
    const maxBuffer = opts.maxBuffer || 10 * 1024 * 1024; // 10MB stdout (用于 dump-json)

    return new Promise((resolve, reject) => {
        execFile(binary, args, { timeout: timeoutMs, maxBuffer }, (error, stdout, stderr) => {
            if (error) {
                // 区分超时
                if (error.killed && error.signal === 'SIGTERM') {
                    return reject(buildYtDlpError('timeout', String(stderr || '')));
                }
                if (error.code === 'ENOENT') {
                    return reject(buildYtDlpError('yt_dlp_missing', `yt-dlp 可执行文件未找到: ${binary}`));
                }
                const mapped = mapYtDlpError(stderr);
                return reject(buildYtDlpError(mapped.code, String(stderr || error.message || '')));
            }
            resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
        });
    });
}

/**
 * 获取视频元数据。
 * @param {string} url - 必须是已校验过平台的 URL
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.cookiesFile]
 * @returns {Promise<object>} { title, duration, uploader, uploadDate, thumbnail, videoId, platform, webpageUrl, ext }
 */
/**
 * 判断 URL 是否为 Bilibili，如是则改走直连 API 绕过 yt-dlp 的 412 问题。
 */
function isBilibili(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host.endsWith('bilibili.com') || host === 'b23.tv';
    } catch (_e) {
        return false;
    }
}

async function fetchVideoMetadata(url, opts = {}) {
    if (typeof url !== 'string' || !url.trim()) {
        throw buildYtDlpError('not_a_video_url');
    }

    // BiliBili 走直连服务（yt-dlp BiliBili extractor 在 2026 年频繁被风控 412）
    if (isBilibili(url)) {
        logger('YT_DLP_META_BYPASS', `Bilibili URL 改走直连服务: ${url}`);
        return bilibiliDirect.fetchVideoMetadata(url, opts);
    }

    const args = [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '--skip-download',
        '--socket-timeout', '30',
        ...buildPlatformHeaderArgs(url),
    ];

    const cookiesFile = opts.cookiesFile || config.videoUrl?.cookiesFile;
    if (cookiesFile && fs.existsSync(cookiesFile)) {
        args.push('--cookies', cookiesFile);
    }

    args.push(url);

    logger('YT_DLP_META_START', `获取视频元数据: ${url}`);

    let info;
    try {
        const { stdout } = await runYtDlp(args, { timeoutMs: Math.min(opts.timeoutMs || 60000, 120000) });
        const firstLine = stdout.split('\n').find(line => line.trim().startsWith('{'));
        if (!firstLine) {
            throw buildYtDlpError('unknown', stdout.slice(0, 500));
        }
        info = JSON.parse(firstLine);
    } catch (err) {
        if (err.code && ERROR_CODES[err.code]) {
            logger('YT_DLP_META_ERROR', `获取视频元数据失败 code=${err.code}: ${err.stderr || err.message}`);
            throw err;
        }
        logger('YT_DLP_META_ERROR', `获取视频元数据失败: ${err.message}`);
        throw buildYtDlpError('unknown', err.message);
    }

    const platform = (info.extractor || info.extractor_key || '').toLowerCase().includes('bili') ? 'bilibili'
        : (info.extractor || info.extractor_key || '').toLowerCase().includes('youtube') ? 'youtube'
        : null;

    const metadata = {
        title: String(info.title || '').trim() || 'Untitled',
        duration: Number(info.duration || 0),
        uploader: String(info.uploader || info.channel || info.creator || '').trim(),
        uploadDate: String(info.upload_date || ''),
        thumbnail: String(info.thumbnail || ''),
        videoId: String(info.id || ''),
        platform,
        extractor: String(info.extractor || ''),
        webpageUrl: String(info.webpage_url || url),
        ext: String(info.ext || 'm4a'),
    };

    logger('YT_DLP_META_OK', `元数据获取成功 title="${metadata.title.slice(0, 80)}" duration=${metadata.duration}s platform=${metadata.platform}`);
    return metadata;
}

/**
 * 下载音频流到指定路径。
 *
 * @param {string} url
 * @param {string} outputPathNoExt - 不带扩展名的输出路径前缀（yt-dlp 会自动追加扩展名）
 * @param {object} [opts]
 * @param {(percent:number)=>void} [opts.onProgress] - 进度回调，参数 0~100
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.cookiesFile]
 * @returns {Promise<{ filePath: string, fileSizeBytes: number }>}
 */
function downloadAudio(url, outputPathNoExt, opts = {}) {
    // BiliBili 走直连服务
    if (isBilibili(url)) {
        logger('YT_DLP_DOWNLOAD_BYPASS', `Bilibili URL 改走直连下载: ${url}`);
        return bilibiliDirect.downloadAudio(url, outputPathNoExt, opts);
    }

    return new Promise((resolve, reject) => {
        if (typeof url !== 'string' || !url.trim()) {
            return reject(buildYtDlpError('not_a_video_url'));
        }
        if (!outputPathNoExt) {
            return reject(new Error('outputPathNoExt 不能为空'));
        }

        const binary = config.videoUrl?.ytDlpBinary || 'yt-dlp';
        const timeoutMs = Number(opts.timeoutMs || config.videoUrl?.ytDlpTimeoutMs || DEFAULT_TIMEOUT_MS);

        const args = [
            '--no-playlist',
            '--no-warnings',
            '--no-part',
            '--restrict-filenames',
            // 限制最终文件名总长度，避免在某些文件系统上因 256 字节限制把扩展名截断掉，
            // 导致后续 ffmpeg 无法根据扩展名识别容器格式（曾出现 m4a 后缀被吞导致 exit 234）
            '--trim-filenames', '180',
            '--socket-timeout', '30',
            '--retries', '3',
            // 优先选择 m4a/AAC 源（YouTube itag 140 即 m4a/AAC，可直接 -c copy 切片，无需转码）
            // 兜底逻辑：m4a > 任意 bestaudio > best
            '-f', 'bestaudio[ext=m4a]/bestaudio/best',
            '-o', `${outputPathNoExt}.%(ext)s`,
            '--newline', // 让进度逐行输出，便于解析
            // 注入浏览器 UA / Referer 以绕过 B 站等站点的反爬（HTTP 412）
            ...buildPlatformHeaderArgs(url),
        ];

        const cookiesFile = opts.cookiesFile || config.videoUrl?.cookiesFile;
        if (cookiesFile && fs.existsSync(cookiesFile)) {
            args.push('--cookies', cookiesFile);
        }

        args.push(url);

        logger('YT_DLP_DOWNLOAD_START', `开始下载音频: ${url} -> ${outputPathNoExt}.*`);

        const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderrBuf = '';
        let stdoutBuf = '';
        let finalFilePath = null;
        let killedByTimeout = false;

        const killTimer = setTimeout(() => {
            killedByTimeout = true;
            try { child.kill('SIGKILL'); } catch (_e) { /* ignore */ }
        }, timeoutMs);

        child.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            stdoutBuf += text;
            // 限制 stdout 缓冲，避免内存暴涨
            if (stdoutBuf.length > 1024 * 1024) {
                stdoutBuf = stdoutBuf.slice(-512 * 1024);
            }
            // 解析进度行：[download]  12.3% of 5.00MiB at 1.20MiB/s ETA 00:03
            const progressMatches = text.match(/\[download\]\s+(\d{1,3}(?:\.\d+)?)%/g);
            if (progressMatches && typeof opts.onProgress === 'function') {
                const last = progressMatches[progressMatches.length - 1];
                const m = last.match(/(\d{1,3}(?:\.\d+)?)%/);
                if (m) {
                    const percent = Math.max(0, Math.min(100, parseFloat(m[1])));
                    try { opts.onProgress(percent); } catch (_e) { /* ignore */ }
                }
            }
            // 解析最终输出文件路径：[download] Destination: /path/to/file.m4a
            // 或：[ExtractAudio] Destination: ...
            // 或：[download] /path/to/file.m4a has already been downloaded
            const destMatch = text.match(/\[(?:download|ExtractAudio|Merger)\]\s+(?:Destination:\s+)?(.+\.\w{2,5})(?:\s|$)/);
            if (destMatch) {
                const candidate = destMatch[1].trim();
                if (candidate && !candidate.includes('%(')) {
                    finalFilePath = candidate;
                }
            }
        });

        child.stderr.on('data', (chunk) => {
            stderrBuf += chunk.toString();
            if (stderrBuf.length > 256 * 1024) {
                stderrBuf = stderrBuf.slice(-128 * 1024);
            }
        });

        child.on('error', (err) => {
            clearTimeout(killTimer);
            if (err.code === 'ENOENT') {
                return reject(buildYtDlpError('yt_dlp_missing', `yt-dlp 可执行文件未找到: ${binary}`));
            }
            reject(buildYtDlpError('unknown', err.message));
        });

        child.on('close', (code, signal) => {
            clearTimeout(killTimer);

            if (killedByTimeout) {
                logger('YT_DLP_DOWNLOAD_TIMEOUT', `下载超时被强制终止: ${url}`);
                return reject(buildYtDlpError('timeout', stderrBuf));
            }

            if (code !== 0) {
                const mapped = mapYtDlpError(stderrBuf);
                logger('YT_DLP_DOWNLOAD_ERROR', `下载失败 exitCode=${code} signal=${signal} mapped=${mapped.code} stderr=${stderrBuf.slice(0, 500)}`);
                return reject(buildYtDlpError(mapped.code, stderrBuf));
            }

            // 优先使用从 stdout 解析到的文件路径；如果未拿到，则回退到目录扫描
            let resolvedPath = finalFilePath;
            if (!resolvedPath || !fs.existsSync(resolvedPath)) {
                try {
                    const dir = path.dirname(outputPathNoExt);
                    const base = path.basename(outputPathNoExt);
                    const matched = fs.readdirSync(dir).find(name => name.startsWith(base + '.'));
                    if (matched) resolvedPath = path.join(dir, matched);
                } catch (_e) { /* ignore */ }
            }

            if (!resolvedPath || !fs.existsSync(resolvedPath)) {
                logger('YT_DLP_DOWNLOAD_NOFILE', `下载完成但未找到输出文件: outputPathNoExt=${outputPathNoExt}`);
                return reject(buildYtDlpError('unknown', '下载完成但未找到输出文件'));
            }

            let fileSizeBytes = 0;
            try {
                fileSizeBytes = fs.statSync(resolvedPath).size;
            } catch (_e) { /* ignore */ }

            logger('YT_DLP_DOWNLOAD_OK', `下载完成: ${resolvedPath} (${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
            resolve({ filePath: resolvedPath, fileSizeBytes });
        });
    });
}

module.exports = {
    fetchVideoMetadata,
    downloadAudio,
    mapYtDlpError,
    buildYtDlpError,
    ERROR_CODES,
};
