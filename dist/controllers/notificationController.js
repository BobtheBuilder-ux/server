"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = void 0;
const tslib_1 = require("tslib");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const notificationService_1 = tslib_1.__importDefault(require("../services/notificationService"));
let notificationService = null;
function getNotificationService() {
    if (!notificationService) {
        notificationService = new notificationService_1.default();
    }
    return notificationService;
}
exports.notificationController = {
    async getUserNotifications(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const notificationsData = await database_1.db.select()
                .from(database_1.notifications)
                .where((0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId))
                .orderBy((0, drizzle_orm_1.desc)(database_1.notifications.createdAt))
                .limit(limit)
                .offset(offset);
            const totalCountResult = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(database_1.notifications)
                .where((0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId));
            const totalCount = totalCountResult[0]?.count || 0;
            const unreadCountResult = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(database_1.notifications)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId), (0, drizzle_orm_1.eq)(database_1.notifications.isRead, false)));
            const unreadCount = unreadCountResult[0]?.count || 0;
            res.json({
                notifications: notificationsData,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                },
                unreadCount
            });
        }
        catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ error: 'Failed to fetch notifications' });
        }
    },
    async getUnreadCount(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const unreadCountResult = await database_1.db.select({ count: (0, drizzle_orm_1.count)() })
                .from(database_1.notifications)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId), (0, drizzle_orm_1.eq)(database_1.notifications.isRead, false)));
            const unreadCount = unreadCountResult[0]?.count || 0;
            res.json({ unreadCount });
        }
        catch (error) {
            console.error('Error fetching unread count:', error);
            res.status(500).json({ error: 'Failed to fetch unread count' });
        }
    },
    async markAsRead(req, res) {
        try {
            const userId = req.user?.id;
            const notificationId = parseInt(req.params.id);
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            if (isNaN(notificationId)) {
                return res.status(400).json({ error: 'Invalid notification ID' });
            }
            const [notification] = await database_1.db.update(database_1.notifications)
                .set({ isRead: true })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.notifications.id, notificationId), (0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId)))
                .returning();
            res.json({ message: 'Notification marked as read', notification });
        }
        catch (error) {
            console.error('Error marking notification as read:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Notification not found' });
            }
            res.status(500).json({ error: 'Failed to mark notification as read' });
        }
    },
    async markAllAsRead(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const result = await database_1.db.update(database_1.notifications)
                .set({ isRead: true })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId), (0, drizzle_orm_1.eq)(database_1.notifications.isRead, false)));
            res.json({
                message: 'All notifications marked as read',
                updatedCount: result.rowCount || 0
            });
        }
        catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({ error: 'Failed to mark all notifications as read' });
        }
    },
    async deleteNotification(req, res) {
        try {
            const userId = req.user?.id;
            const notificationId = parseInt(req.params.id);
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            if (isNaN(notificationId)) {
                return res.status(400).json({ error: 'Invalid notification ID' });
            }
            await database_1.db.delete(database_1.notifications)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.notifications.id, notificationId), (0, drizzle_orm_1.eq)(database_1.notifications.recipientId, userId)));
            res.json({ message: 'Notification deleted successfully' });
        }
        catch (error) {
            console.error('Error deleting notification:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Notification not found' });
            }
            res.status(500).json({ error: 'Failed to delete notification' });
        }
    },
    async getActivityFeed(_req, res) {
        try {
            res.json({
                activities: [],
                pagination: {
                    page: 1,
                    limit: 50,
                    total: 0,
                    pages: 0
                }
            });
        }
        catch (error) {
            console.error('Error fetching activity feed:', error);
            res.status(500).json({ error: 'Failed to fetch activity feed' });
        }
    },
    async createNotification(req, res) {
        try {
            const { title, message, type, priority, recipientId, recipientType, relatedId, relatedType, actionUrl, actionText, metadata, expiresAt } = req.body;
            if (!title || !message || !type || !recipientId || !recipientType) {
                return res.status(400).json({
                    error: 'Missing required fields: title, message, type, recipientId, recipientType'
                });
            }
            let notification;
            const service = getNotificationService();
            if (service) {
                notification = await service.createNotification({
                    title,
                    message,
                    type,
                    priority,
                    recipientId,
                    recipientType,
                    relatedId,
                    relatedType,
                    actionUrl,
                    actionText,
                    metadata,
                    expiresAt: expiresAt ? new Date(expiresAt) : undefined
                });
            }
            else {
                const [createdNotification] = await database_1.db.insert(database_1.notifications)
                    .values({
                    title,
                    message,
                    type,
                    recipientId,
                    recipientType,
                    relatedId,
                    relatedType,
                    actionUrl,
                    actionText,
                    metadata,
                    expiresAt: expiresAt ? new Date(expiresAt) : null
                })
                    .returning();
                notification = createdNotification;
            }
            res.status(201).json({
                message: 'Notification created successfully',
                notification
            });
        }
        catch (error) {
            console.error('Error creating notification:', error);
            res.status(500).json({ error: 'Failed to create notification' });
        }
    },
    async cleanupExpired(_req, res) {
        try {
            const now = new Date();
            const result = await database_1.db.delete(database_1.notifications)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.isNotNull)(database_1.notifications.expiresAt), (0, drizzle_orm_1.lt)(database_1.notifications.expiresAt, now)));
            res.json({
                message: 'Expired notifications cleaned up',
                deletedCount: result.rowCount || 0
            });
        }
        catch (error) {
            console.error('Error cleaning up expired notifications:', error);
            res.status(500).json({ error: 'Failed to cleanup expired notifications' });
        }
    }
};
exports.default = exports.notificationController;
