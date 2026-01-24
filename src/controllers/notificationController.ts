import { Request, Response } from 'express';
import { eq, and, desc, count, lt, isNotNull } from 'drizzle-orm';
import { db, notifications } from '../utils/database';
import NotificationService from '../services/notificationService';

// Initialize notification service without socket.io
let notificationService: NotificationService | null = null;

function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService();
  }
  return notificationService;
}

export const notificationController = {
  // Get user notifications with pagination
  async getUserNotifications(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const notificationsData = await db.select()
        .from(notifications)
        .where(eq(notifications.recipientId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCountResult = await db.select({ count: count() })
        .from(notifications)
        .where(eq(notifications.recipientId, userId));
      const totalCount = totalCountResult[0]?.count || 0;

      const unreadCountResult = await db.select({ count: count() })
        .from(notifications)
        .where(and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false)
        ));
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
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  },

  // Get unread notification count
  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const unreadCountResult = await db.select({ count: count() })
        .from(notifications)
        .where(and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false)
        ));
      const unreadCount = unreadCountResult[0]?.count || 0;

      res.json({ unreadCount });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  },

  // Mark notification as read
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const notificationId = parseInt(req.params.id);

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (isNaN(notificationId)) {
        return res.status(400).json({ error: 'Invalid notification ID' });
      }

      const [notification] = await db.update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, userId) // Ensure user can only mark their own notifications
        ))
        .returning();

      // Real-time updates removed - using Better Auth session management

      res.json({ message: 'Notification marked as read', notification });
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  },

  // Mark all notifications as read
  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await db.update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false)
        ));

      // Real-time updates removed - using Better Auth session management

      res.json({ 
        message: 'All notifications marked as read', 
        updatedCount: result.rowCount || 0 
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  },

  // Delete notification
  async deleteNotification(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const notificationId = parseInt(req.params.id);

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (isNaN(notificationId)) {
        return res.status(400).json({ error: 'Invalid notification ID' });
      }

      await db.delete(notifications)
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, userId) // Ensure user can only delete their own notifications
        ));

      res.json({ message: 'Notification deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  },

  // Get activity feed (public activities) - temporarily disabled due to type issues
  async getActivityFeed(_req: Request, res: Response) {
    try {
      // TODO: Fix ActivityFeed type issues
      res.json({
        activities: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0
        }
      });
    } catch (error) {
      console.error('Error fetching activity feed:', error);
      res.status(500).json({ error: 'Failed to fetch activity feed' });
    }
  },

  // Create notification (admin/system use)
  async createNotification(req: Request, res: Response) {
    try {
      const {
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
        expiresAt
      } = req.body;

      // Validate required fields
      if (!title || !message || !type || !recipientId || !recipientType) {
        return res.status(400).json({ 
          error: 'Missing required fields: title, message, type, recipientId, recipientType' 
        });
      }

      // Create notification using service if available
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
      } else {
        // Fallback to direct database creation
        const [createdNotification] = await db.insert(notifications)
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
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({ error: 'Failed to create notification' });
    }
  },

  // Clean up expired notifications
  async cleanupExpired(_req: Request, res: Response) {
    try {
      const now = new Date();
      const result = await db.delete(notifications)
        .where(and(
          isNotNull(notifications.expiresAt),
          lt(notifications.expiresAt, now)
        ));

      res.json({ 
        message: 'Expired notifications cleaned up', 
        deletedCount: result.rowCount || 0 
      });
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
      res.status(500).json({ error: 'Failed to cleanup expired notifications' });
    }
  }
};

export default notificationController;