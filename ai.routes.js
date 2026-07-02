// ============================================================
// 🛣️ src/routes/ai.routes.js
// SUPREME AI API Routes
// ============================================================
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiGateway = require('../services/ai-gateway.service');
const rateLimiter = require('../middleware/rateLimiter');

router.use(auth);

// Chat completion
router.post('/chat', rateLimiter.aiLimiter, async (req, res) => {
    try {
        const { messages, provider, model, temperature, maxTokens } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        const result = await aiGateway.chat(req.userId, messages, {
            provider, model, temperature, maxTokens
        });

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Get available models
router.get('/models', (req, res) => {
    const models = aiGateway.getAvailableModels();
    res.json({ success: true, models });
});

module.exports = router;
