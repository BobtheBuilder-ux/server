import { Router } from 'express';
import { userCleanupService } from '../services/userCleanupService';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { db, users } from '../utils/database';

const router = Router();

/**
 * POST /api/auth/cleanup/delete-on-refresh
 * Delete unverified user account immediately when page is refreshed
 */
router.post('/cleanup/delete-on-refresh', async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        message: 'User ID and email are required',
      });
    }

    // Check if user exists and is unverified
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, userId))
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

    // Delete the user and associated data
    await userCleanupService.deleteUserOnRefresh(userId, email);

    res.json({
      success: true,
      message: 'User account deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting user on refresh via API', error, req.body.userId, req.body.email);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/cleanup/should-delete/:userId
 * Check if a user should be deleted due to verification timeout
 */
router.get('/cleanup/should-delete/:userId', async (_req, res) => {
  try {
    const { userId } = _req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Check if user exists
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, userId))
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

    // Check if user should be deleted
    const shouldDelete = await userCleanupService.shouldDeleteUser(userId);

    res.json({
      success: true,
      shouldDelete,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    logger.error('Error checking if user should be deleted via API', error, _req.params.userId);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export { router as userCleanupRoutes };