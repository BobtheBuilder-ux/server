import express from 'express';
import { notificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// All notification routes require authentication (allow all authenticated users)
router.use(authMiddleware(['landlord', 'tenant', 'agent', 'admin']));

// Get user notifications with pagination
router.get('/', notificationController.getUserNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Get activity feed
router.get('/activity-feed', notificationController.getActivityFeed);

// Create notification (admin/system use)
router.post('/', notificationController.createNotification);

// Clean up expired notifications (admin/system use)
router.delete('/cleanup/expired', notificationController.cleanupExpired);

export default router;