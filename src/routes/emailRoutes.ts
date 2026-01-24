import { Router, Request, Response } from 'express';
import { getEmailSubscriptions, unsubscribeFromEmailList } from '../utils/emailSubscriptionService';

const router = Router();

// Get all email subscriptions (admin only)
router.get('/subscriptions', async (req, res) => {
  try {
    const subscriptions = await getEmailSubscriptions(req.query.type as string);
    res.json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    console.error('Error fetching email subscriptions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

// Unsubscribe from email list
router.post('/unsubscribe', (req: Request, res: Response) => {
  const handleUnsubscribe = async () => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }
      
      await unsubscribeFromEmailList(email);
      
      res.json({
        success: true,
        message: 'Successfully unsubscribed from email list'
      });
    } catch (error) {
      console.error('Error unsubscribing:', error);
      res.status(500).json({ success: false, error: 'Failed to unsubscribe' });
    }
  };
  
  handleUnsubscribe();
});

export default router;