"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userCleanupRoutes = void 0;
const express_1 = require("express");
const userCleanupService_1 = require("../services/userCleanupService");
const drizzle_orm_1 = require("drizzle-orm");
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
exports.userCleanupRoutes = router;
router.post('/cleanup/delete-on-refresh', async (req, res) => {
    try {
        const { userId, email } = req.body;
        if (!userId || !email) {
            return res.status(400).json({
                success: false,
                message: 'User ID and email are required',
            });
        }
        const [user] = await database_1.db.select({
            id: database_1.users.id,
            email: database_1.users.email,
            emailVerified: database_1.users.emailVerified,
        })
            .from(database_1.users)
            .where((0, drizzle_orm_1.eq)(database_1.users.id, userId))
            .limit(1);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: 'User is already verified',
            });
        }
        await userCleanupService_1.userCleanupService.deleteUserOnRefresh(userId, email);
        res.json({
            success: true,
            message: 'User account deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting user on refresh via API', error, req.body.userId, req.body.email);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
});
router.get('/cleanup/should-delete/:userId', async (_req, res) => {
    try {
        const { userId } = _req.params;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required',
            });
        }
        const [user] = await database_1.db.select({
            id: database_1.users.id,
            email: database_1.users.email,
            emailVerified: database_1.users.emailVerified,
        })
            .from(database_1.users)
            .where((0, drizzle_orm_1.eq)(database_1.users.id, userId))
            .limit(1);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        if (user.emailVerified) {
            return res.json({
                success: true,
                shouldDelete: false,
                message: 'User is already verified',
            });
        }
        const shouldDelete = await userCleanupService_1.userCleanupService.shouldDeleteUser(userId);
        res.json({
            success: true,
            shouldDelete,
            user: {
                id: user.id,
                email: user.email,
                emailVerified: user.emailVerified,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Error checking if user should be deleted via API', error, _req.params.userId);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
});
