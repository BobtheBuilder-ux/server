"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emailSubscriptionService_1 = require("../utils/emailSubscriptionService");
const router = (0, express_1.Router)();
router.get('/subscriptions', async (req, res) => {
    try {
        const subscriptions = await (0, emailSubscriptionService_1.getEmailSubscriptions)(req.query.type);
        res.json({
            success: true,
            count: subscriptions.length,
            data: subscriptions
        });
    }
    catch (error) {
        console.error('Error fetching email subscriptions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
    }
});
router.post('/unsubscribe', (req, res) => {
    const handleUnsubscribe = async () => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ success: false, error: 'Email is required' });
            }
            await (0, emailSubscriptionService_1.unsubscribeFromEmailList)(email);
            res.json({
                success: true,
                message: 'Successfully unsubscribed from email list'
            });
        }
        catch (error) {
            console.error('Error unsubscribing:', error);
            res.status(500).json({ success: false, error: 'Failed to unsubscribe' });
        }
    };
    handleUnsubscribe();
});
exports.default = router;
