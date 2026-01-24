import { Router } from 'express';
import { SMSController } from '../controllers/smsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const smsController = new SMSController();

/**
 * @route POST /webhook
 * @desc Handle Termii webhook for incoming messages
 * @access Public (Webhook)
 * @note This endpoint should be secured with webhook signature validation in production
 */
router.post('/webhook', smsController.handleWebhook);

// Apply authentication middleware to all other routes
router.use(authMiddleware(['tenant', 'landlord', 'admin']));

/**
 * @route POST /api/sms/rent-reminder
 * @desc Send rent reminder to tenant
 * @access Private (Tenant/Admin)
 */
router.post('/rent-reminder', smsController.sendRentReminder);

/**
 * @route POST /api/sms/payment-confirmation
 * @desc Send payment confirmation to tenant
 * @access Private (Admin/System)
 */
router.post('/payment-confirmation', smsController.sendPaymentConfirmation);

/**
 * @route POST /api/sms/landlord-alert
 * @desc Send payment alert to landlord
 * @access Private (Admin/System)
 */
router.post('/landlord-alert', smsController.sendLandlordAlert);

/**
 * @route POST /api/sms/renewal-request
 * @desc Send renewal request to tenant
 * @access Private (Landlord/Admin)
 */
router.post('/renewal-request', smsController.sendRenewalRequest);

/**
 * @route GET /api/sms/history/:userId
 * @desc Get message history for a user
 * @access Private (User/Admin)
 */
router.get('/history/:userId', smsController.getMessageHistory);

/**
 * @route GET /api/sms/responses/:phoneNumber
 * @desc Get response history for a phone number
 * @access Private (Admin)
 */
router.get('/responses/:phoneNumber', authMiddleware(['admin']), smsController.getResponseHistory);

/**
 * @route POST /api/sms/overdue-reminders
 * @desc Send overdue rent reminders (cron job)
 * @access Private (Admin/System)
 */
router.post('/overdue-reminders', authMiddleware(['admin']), smsController.sendOverdueReminders);

/**
 * @route GET /api/sms/stats
 * @desc Get SMS statistics
 * @access Private (Admin)
 */
router.get('/stats', authMiddleware(['admin']), smsController.getStats);

export default router;