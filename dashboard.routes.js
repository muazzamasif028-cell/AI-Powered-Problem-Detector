// ============================================================
// 📊 src/routes/dashboard.routes.js
// SUPREME Dashboard API
// ============================================================
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const config = require('../config');

router.use(auth);

// Get dashboard data
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const plan = config.plans[user.plan];

        res.json({
            success: true,
            data: {
                user: {
                    name: user.name,
                    email: user.email,
                    plan: user.plan,
                    memberSince: user.createdAt
                },
                usage: {
                    aiRequests: { used: user.usage.aiRequests, limit: plan.aiRequests, percent: Math.round((user.usage.aiRequests / plan.aiRequests) * 100) },
                    agents: { used: user.usage.agentsCreated, limit: plan.agents, percent: Math.round((user.usage.agentsCreated / plan.agents) * 100) }
                },
                quickActions: [
                    { name: 'New AI Chat', icon: '🤖', link: '/chat' },
                    { name: 'Create Agent', icon: '🧠', link: '/agents/new' },
                    { name: 'View API Keys', icon: '🔑', link: '/settings/api' },
                    { name: 'Upgrade Plan', icon: '⬆️', link: '/billing' }
                ],
                systemStatus: {
                    api: '🟢 Operational',
                    ai: '🟢 Operational',
                    billing: '🟢 Operational'
                }
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

module.exports = router;
