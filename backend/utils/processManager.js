/**
 * 进程管理与状态管理模块
 * 封装 processingStatus、activeProcesses 等全局状态
 */

const logger = require('./logger');

// 处理进度状态存储（简单内存存储，生产环境建议使用Redis）
const processingStatus = new Map();

// 进程跟踪器：存储正在运行的FFmpeg和OpenAI进程
const activeProcesses = new Map();

// 进程类型枚举
const ProcessType = {
    FFMPEG: 'ffmpeg',
    OPENAI: 'openai',
    SPLIT: 'split',
    TRANSCRIBE: 'transcribe',
    SUMMARY: 'summary'
};

// 进度日志去重记录
const lastProgressLog = new Map();

/**
 * 获取处理状态
 * @param {string} fileId
 * @returns {object|undefined}
 */
function getStatus(fileId) {
    return processingStatus.get(fileId);
}

/**
 * 设置处理状态
 * @param {string} fileId
 * @param {object} status
 */
function setStatus(fileId, status) {
    processingStatus.set(fileId, status);
}

/**
 * 删除处理状态
 * @param {string} fileId
 */
function deleteStatus(fileId) {
    processingStatus.delete(fileId);
}

/**
 * 获取 processingStatus Map（供路由直接遍历等场景使用）
 * @returns {Map}
 */
function getStatusMap() {
    return processingStatus;
}

/**
 * 注册活跃进程
 * @param {string} fileId
 * @param {object} processInfo
 */
function registerProcess(fileId, processInfo) {
    activeProcesses.set(fileId, processInfo);
}

/**
 * 获取活跃进程
 * @param {string} fileId
 * @returns {object|undefined}
 */
function getProcess(fileId) {
    return activeProcesses.get(fileId);
}

/**
 * 移除活跃进程
 * @param {string} fileId
 */
function removeProcess(fileId) {
    activeProcesses.delete(fileId);
}

/**
 * 获取 activeProcesses Map（供路由直接遍历等场景使用）
 * @returns {Map}
 */
function getProcessMap() {
    return activeProcesses;
}

/**
 * 获取上次进度日志记录
 * @param {string} key
 * @returns {*}
 */
function getLastProgressLog(key) {
    return lastProgressLog.get(key);
}

/**
 * 设置上次进度日志记录
 * @param {string} key
 * @param {*} value
 */
function setLastProgressLog(key, value) {
    lastProgressLog.set(key, value);
}

/**
 * 启动定时清理过期状态的定时器
 * 每 5 分钟检查并清理超过 30 分钟的处理状态
 */
function startCleanupTimer() {
    setInterval(() => {
        const now = Date.now();
        for (const [fileId, status] of processingStatus.entries()) {
            // 假设文件名包含时间戳，超过30分钟清理
            const fileTime = parseInt(fileId.split('-')[0]);
            if (now - fileTime > 30 * 60 * 1000) {
                processingStatus.delete(fileId);
            }
        }
    }, 5 * 60 * 1000); // 每5分钟清理一次
}

module.exports = {
    ProcessType,
    getStatus,
    setStatus,
    deleteStatus,
    getStatusMap,
    registerProcess,
    getProcess,
    removeProcess,
    getProcessMap,
    getLastProgressLog,
    setLastProgressLog,
    startCleanupTimer
};
