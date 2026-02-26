/**
 * 健康检查路由
 */

const express = require('express');
const router = express.Router();

// 健康检查端点
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'MeetingMind Backend'
    });
});

module.exports = router;
