// ============================================================
// 💳 src/routes/billing.routes.js
// SUPREME Billing API
// ============================================================
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const billingService = require('../services/billing.service');

router.use(auth);

// Get plans
router.get('/plans', (req, res) => {
    const config = require('../config');
    res.json({ success: true, plans: config.plans });
});

// Create checkout session
router.post('/checkout', async (req, res) => {
    try {
        const { plan } = req.body;
        const session = await billingService.createCheckout(req.userId, plan);
        res.json({ success: true, url: session.url });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Get billing info
router.get('/info', async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.userId);
        
        res.json({
            success: true,
            plan: user.plan,
            subscriptionStatus: user.subscriptionStatus,
            usage: user.usage,
            limits: require('../config').plans[user.plan]
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        await billingService.handleWebhook(req, res);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
