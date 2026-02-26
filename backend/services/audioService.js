/**
 * 音频处理服务模块
 * 封装音频时长获取、FFmpeg切割等逻辑
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const logger = require('../utils/logger');
const { getSplitDir } = require('../utils/fileHelper');
const processManager = require('../utils/processManager');

/**
 * 获取音频文件时长（增强版，支持webm等格式）
 * 降级策略: ffprobe → 命令行 ffprobe → 文件大小估算
 * @param {string} filePath - 音频文件路径
 * @returns {Promise<number>} 音频时长（秒）
 */
const getAudioDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(filePath);
        logger('DURATION_START', `开始获取音频时长: ${fileName}`);
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            logger('DURATION_ERROR', `文件不存在，使用默认时长600秒: ${filePath}`);
            resolve(600); // 默认10分钟
            return;
        }

        // 获取文件大小，用于估算时长
        const fileSizeBytes = fs.statSync(filePath).size;
        const fileSizeMB = fileSizeBytes / (1024 * 1024);
        logger('DURATION_INFO', `文件大小: ${fileSizeMB.toFixed(2)}MB`);
        
        // 方案1: 使用 ffprobe
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                logger('DURATION_WARN', `方案1(ffprobe)获取时长失败: ${err.message}`);
                logger('DURATION_INFO', `尝试方案2: 使用命令行ffprobe`);
                
                // 方案2: 使用命令行 ffprobe（对webm格式更可靠）
                exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, 
                    (error, stdout, stderr) => {
                    if (error || !stdout.trim()) {
                            logger('DURATION_WARN', `方案2(命令行ffprobe)也失败，降级到方案3: 使用文件大小估算时长`);
                            // 方案3: 根据文件大小估算（假设平均码率 128kbps）
                            const estimatedDuration = Math.ceil((fileSizeMB * 8 * 1024) / 128);
                logger('DURATION_ESTIMATE_INFO', `文件大小 ${fileSizeMB.toFixed(2)}MB，估算时长 ${Math.round(estimatedDuration/60)} 分钟 (基于128kbps码率计算)`);
                            resolve(Math.max(estimatedDuration, 600)); // 至少10分钟
                        } else {
                            const duration = parseFloat(stdout.trim());
                            if (isNaN(duration) || duration <= 0) {
                                logger('DURATION_WARN', `解析时长失败(值: ${stdout.trim()})，使用文件大小估算`);
                                const estimatedDuration = Math.ceil((fileSizeMB * 8 * 1024) / 128);
                                resolve(Math.max(estimatedDuration, 600));
                            } else {
                                logger('DURATION_SUCCESS', `方案2(命令行ffprobe)成功获取文件时长: ${Math.round(duration/60)} 分钟 (${duration.toFixed(1)}秒)`);
                                resolve(duration);
                            }
                        }
                    }
                );
                return;
            }
            
            // 成功获取元数据
            const duration = metadata?.format?.duration;
            if (!duration || isNaN(duration) || duration <= 0) {
                logger('DURATION_WARN', `元数据中时长无效(值: ${duration})，使用文件大小估算`);
                const estimatedDuration = Math.ceil((fileSizeMB * 8 * 1024) / 128);
                logger('DURATION_ESTIMATE_INFO', `文件大小 ${fileSizeMB.toFixed(2)}MB，估算时长 ${Math.round(estimatedDuration/60)} 分钟`);
                resolve(Math.max(estimatedDuration, 600));
            } else {
                logger('DURATION_SUCCESS', `方案1(ffprobe)成功获取文件时长: ${Math.round(duration/60)} 分钟 (${duration}s)`);
                resolve(duration);
            }
        });
    });
};

/**
 * 使用原生FFmpeg命令行切割音频（更稳定）
 * @param {string} filePath - 音频文件路径
 * @param {number} segmentTime - 每段时长（秒），默认600秒
 * @param {string|null} fileId - 文件ID，用于进程跟踪
 * @returns {Promise<string[]>} 有效切片文件路径数组
 */
const splitAudioWithFFmpegCLI = async (filePath, segmentTime = 600, fileId = null) => {
    const splitDir = getSplitDir();
    const cliFileName = path.basename(filePath);
    const cliFileSizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
    logger('FFMPEG_CLI_START', `FFmpeg CLI切割开始: ${cliFileName} (${cliFileSizeMB}MB)，每段${Math.round(segmentTime/60)}分钟`);
    
    // 清理文件名
    const cleanBaseName = path.basename(filePath, path.extname(filePath))
        .replace(/[\s\W]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    
    // 根据输入文件扩展名确定输出格式
    const inputExt = path.extname(filePath).toLowerCase();
    const outputExt = inputExt === '.mp3' ? '.mp3' : '.m4a';
    const outputPattern = path.join(splitDir, `${cleanBaseName}_%03d${outputExt}`);
    
    // 检查文件
    if (!fs.existsSync(filePath)) {
        throw new Error(`输入文件不存在: ${filePath}`);
    }
    
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
    } catch (err) {
        throw new Error(`文件不可读或无权限: ${filePath}`);
    }
    
    // 使用原生FFmpeg命令行，根据格式选择适当的编码方式
    const command = `ffmpeg -i "${filePath}" -f segment -segment_time ${segmentTime} -c copy "${outputPattern}"`;
    logger('FFMPEG_CLI_CMD', `FFmpeg CLI命令: ${command}`);
    
    try {
        // 记录FFmpeg进程（使用child_process以便后续终止）
        const childProcess = exec(command);
        
        // 存储进程信息以便后续终止
        const processInfo = {
            type: processManager.ProcessType.FFMPEG,
            process: childProcess,
            startTime: new Date(),
            command: command
        };
        
        // 如果提供了fileId，则关联进程以便后续终止
        if (fileId) {
            processManager.registerProcess(fileId, processInfo);
        }
        
        // 等待进程完成
        await new Promise((resolve, reject) => {
            childProcess.on('close', (code) => {
                // 清理进程跟踪
                if (fileId) {
                    processManager.removeProcess(fileId);
                }
                
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg进程退出码: ${code}`));
                }
            });
            
            childProcess.on('error', (error) => {
                // 清理进程跟踪
                if (fileId) {
                    processManager.removeProcess(fileId);
                }
                reject(error);
            });
        });
        
        // 读取生成的切片文件并过滤掉太短的切片
        const files = await fs.promises.readdir(splitDir);
        const allChunks = files
            .filter(f => f.startsWith(cleanBaseName))
            .map(f => path.join(splitDir, f))
            .sort();
        
        // 过滤掉太短的切片（小于1KB）
        const validChunks = [];
        for (const chunk of allChunks) {
            try {
                const stats = await fs.promises.stat(chunk);
                if (stats.size > 1024) { // 文件大小大于1KB
                    validChunks.push(chunk);
                } else {
                    logger('FFMPEG_CLI_WARN', `跳过太短的切片: ${path.basename(chunk)} (${stats.size} bytes，小于1KB阈值)`);
                    await fs.promises.unlink(chunk); // 删除无效切片
                }
            } catch (err) {
                logger('FFMPEG_CLI_WARN', `无法检查切片文件状态: ${path.basename(chunk)}, 错误: ${err.message}`);
            }
        }
        
        logger('FFMPEG_CLI_SUCCESS', `FFmpeg CLI切割完成: ${cliFileName}，生成 ${allChunks.length} 个切片，有效切片: ${validChunks.length}`);
        validChunks.forEach((chunk, idx) => {
            const chunkSize = (fs.statSync(chunk).size / (1024 * 1024)).toFixed(2);
            logger('FFMPEG_CLI_DETAIL', `  切片 ${idx + 1}: ${path.basename(chunk)} (${chunkSize}MB)`);
        });
        return validChunks;
    } catch (error) {
        logger('FFMPEG_CLI_ERROR', `FFmpeg CLI切割失败: ${cliFileName}，错误: ${error.message}`);
        throw error;
    }
};

/**
 * 主音频切割函数，支持多种备选方案
 * 降级策略: FFmpeg CLI → fluent-ffmpeg
 * @param {string} filePath - 音频文件路径
 * @param {number} segmentTime - 每段时长（秒），默认600秒
 * @param {string|null} fileId - 文件ID，用于进程跟踪和取消检查
 * @returns {Promise<string[]>} 有效切片文件路径数组
 */
const splitAudio = async (filePath, segmentTime = 600, fileId = null) => {
    const splitDir = getSplitDir();
    const fileName = path.basename(filePath);
    const fileSizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
    
    logger('SPLIT_START', `开始音频切割: ${fileName} (${fileSizeMB}MB)，每段${Math.round(segmentTime/60)}分钟`);
    
    // 检查是否被取消
    if (fileId && processManager.getStatus(fileId)?.status === 'cancelled') {
        logger('SPLIT_CANCEL', `音频切割进程被取消，跳过文件: ${fileName}`);
        throw new Error('用户取消了处理');
    }
    
    // 方案1：首先尝试使用FFmpeg CLI（最稳定）
    try {
        logger('SPLIT_METHOD', `使用方案1: FFmpeg CLI切割文件: ${fileName}`);
        const result = await splitAudioWithFFmpegCLI(filePath, segmentTime, fileId);
        logger('SPLIT_SUCCESS', `FFmpeg CLI切割完成: ${fileName} -> ${result.length}个有效切片`);
        return result;
    } catch (error) {
        logger('SPLIT_WARN', `方案1(FFmpeg CLI)失败: ${error.message}，尝试方案2(fluent-ffmpeg)`);
    }
    
    // 方案2：回退到fluent-ffmpeg
    logger('SPLIT_METHOD', `使用方案2: fluent-ffmpeg切割文件: ${fileName}`);
    return new Promise((resolve, reject) => {
        const cleanBaseName = path.basename(filePath, path.extname(filePath))
            .replace(/[\s\W]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
            
        // 根据输入文件扩展名确定输出格式
        const inputExt = path.extname(filePath).toLowerCase();
        const outputExt = inputExt === '.mp3' ? '.mp3' : '.m4a';
        const outputPattern = path.join(splitDir, `${cleanBaseName}_%03d${outputExt}`);
        
        if (!fs.existsSync(filePath)) {
            const errorMsg = `输入文件不存在: ${filePath}`;
            logger('SPLIT_ERROR', errorMsg);
            reject(new Error(errorMsg));
            return;
        }
        
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
        } catch (err) {
            const errorMsg = `文件不可读或无权限: ${filePath}`;
            logger('SPLIT_ERROR', errorMsg);
            reject(new Error(errorMsg));
            return;
        }
        
        logger('SPLIT_DETAIL', `使用fluent-ffmpeg处理: ${filePath} -> ${outputPattern}`);
        
        const ffmpegProcess = ffmpeg(filePath)
            .outputOptions([
                '-f segment',
                `-segment_time ${segmentTime}`,
                '-c copy'
            ])
            .output(outputPattern)
            .on('start', (commandLine) => {
                logger('SPLIT_DEBUG', `fluent-ffmpeg命令: ${commandLine}`);
                
                // 记录进程信息
                if (fileId) {
                    processManager.registerProcess(fileId, {
                        type: processManager.ProcessType.FFMPEG,
                        process: ffmpegProcess,
                        startTime: new Date(),
                        command: commandLine
                    });
                }
            })
            .on('end', () => {
                // 清理进程跟踪
                if (fileId) {
                    processManager.removeProcess(fileId);
                }
                
                fs.readdir(splitDir, (err, files) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const allChunks = files
                        .filter(f => f.startsWith(cleanBaseName))
                        .map(f => path.join(splitDir, f))
                        .sort();
                    
                    // 过滤掉太短的切片（小于1KB）
                    const validChunks = [];
                    for (const chunk of allChunks) {
                        try {
                            const stats = fs.statSync(chunk);
                            if (stats.size > 1024) { // 文件大小大于1KB
                                validChunks.push(chunk);
                            } else {
                            logger('FFMPEG_FLUENT_WARN', `跳过太短的切片: ${path.basename(chunk)} (${stats.size} bytes，小于1KB阈值)`);
                                fs.unlinkSync(chunk); // 删除无效切片
                            }
                        } catch (err) {
                            logger('FFMPEG_FLUENT_WARN', `无法检查切片文件状态: ${path.basename(chunk)}, 错误: ${err.message}`);
                        }
                    }
                    
                    logger('FFMPEG_FLUENT_SUCCESS', `fluent-ffmpeg切割完成，生成 ${allChunks.length} 个切片，有效切片: ${validChunks.length}`);
                    validChunks.forEach((chunk, idx) => {
                        try {
                            const chunkSize = (fs.statSync(chunk).size / (1024 * 1024)).toFixed(2);
                            logger('FFMPEG_FLUENT_DETAIL', `  切片 ${idx + 1}: ${path.basename(chunk)} (${chunkSize}MB)`);
                        } catch (e) {}
                    });
                    resolve(validChunks);
                });
            })
            .on('error', (err) => {
                // 清理进程跟踪
                if (fileId) {
                    processManager.removeProcess(fileId);
                }
                
                logger('FFMPEG_FLUENT_ERROR', `fluent-ffmpeg切割失败: ${err.message}`);
                logger('FFMPEG_FLUENT_ERROR', `错误详情: ${JSON.stringify(err)}`);
                reject(err);
            })
            .run();
            
        // 添加取消检查
        if (fileId) {
            const checkCancelInterval = setInterval(() => {
                if (processManager.getStatus(fileId)?.status === 'cancelled') {
                    clearInterval(checkCancelInterval);
                    logger('FFMPEG_FLUENT_CANCEL', `检测到取消请求，终止fluent-ffmpeg进程: ${fileId}`);
                    
                    // 尝试终止ffmpeg进程
                    try {
                        ffmpegProcess.kill();
                        logger('FFMPEG_FLUENT_CANCEL', `已发送终止信号给fluent-ffmpeg进程: ${fileId}`);
                    } catch (err) {
                        logger('FFMPEG_FLUENT_ERROR', `终止fluent-ffmpeg进程失败: ${err.message}`);
                    }
                    
                    reject(new Error('用户取消了处理'));
                }
            }, 1000); // 每秒检查一次
            
            // 清理定时器
            ffmpegProcess.on('end', () => clearInterval(checkCancelInterval));
            ffmpegProcess.on('error', () => clearInterval(checkCancelInterval));
        }
    });
};

module.exports = {
    getAudioDuration,
    splitAudioWithFFmpegCLI,
    splitAudio
};
