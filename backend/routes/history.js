const express = require('express');
const router = express.Router();
const userStore = require('../utils/userStore');
const { requireAuth, requireAdmin } = require('../middleware/auth');

function normalizeFilters(query = {}) {
    return {
        keyword: String(query.keyword || '').trim(),
        activityType: userStore.normalizeActivityTypeFilter(query.activityType || query.type || 'all'),
        status: String(query.status || 'all').trim() || 'all',
        dateFrom: String(query.dateFrom || '').trim(),
        dateTo: String(query.dateTo || '').trim(),
        userId: String(query.userId || '').trim(),
    };
}

function normalizePagination(query = {}) {
    return {
        page: Number(query.page) || 1,
        pageSize: Number(query.pageSize) || 20,
    };
}

router.get('/history', requireAuth, async (req, res, next) => {
    try {
        const filters = normalizeFilters(req.query || {});
        const pagination = normalizePagination(req.query || {});
        const result = await userStore.listUserActivities({
            userId: req.auth.user.id,
            filters,
            ...pagination,
        });

        res.json({
            success: true,
            items: result.items,
            pagination: result.pagination,
            filters,
        });
    } catch (error) {
        next(error);
    }
});

router.get('/history/analytics', requireAuth, async (req, res, next) => {
    try {
        const filters = normalizeFilters(req.query || {});
        const analytics = await userStore.getUserActivityAnalytics({
            userId: req.auth.user.id,
            filters,
        });

        res.json({
            success: true,
            analytics,
        });
    } catch (error) {
        next(error);
    }
});

router.get('/admin/dashboard', requireAdmin, async (req, res, next) => {
    try {
        const filters = normalizeFilters(req.query || {});
        const pagination = normalizePagination(req.query || {});
        const [records, analytics, users] = await Promise.all([
            userStore.listUserActivities({
                includeAllUsers: true,
                filters,
                ...pagination,
            }),
            userStore.getUserActivityAnalytics({
                includeAllUsers: true,
                filters,
            }),
            userStore.listActivityUsers(filters),
        ]);

        res.json({
            success: true,
            actor: {
                id: req.auth.user.id,
                email: req.auth.user.email,
                displayName: req.auth.user.displayName,
                role: req.auth.user.role,
            },
            filters,
            users,
            overview: {
                totalRecords: analytics.totalRecords,
                activeUsers: analytics.uniqueUsers,
                statusCounts: analytics.statusCounts,
                activityTypeCounts: analytics.activityTypeCounts,
            },
            analytics,
            records: records.items,
            pagination: records.pagination,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;