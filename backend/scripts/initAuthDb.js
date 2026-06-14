require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const logger = require('../utils/logger');
const { initializeUserStore } = require('../utils/userStore');
const { closePool } = require('../utils/db');

async function main() {
    const result = await initializeUserStore();
    logger.info('AUTH_DB_READY', {
        message: '认证数据库表结构初始化完成',
        ...result,
    });
}

main()
    .catch((error) => {
        logger.error('AUTH_DB_INIT_FAILED', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await closePool();
        } catch (error) {
            logger.warn('AUTH_DB_POOL_CLOSE_FAILED', error);
        }
    });