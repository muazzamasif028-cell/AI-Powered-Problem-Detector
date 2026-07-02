// ============================================================
// 🛣️ src/routes/auth.routes.js
// SUPREME Authentication Routes
// ============================================================
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimiter = require('../middleware/rateLimiter.middleware');

// =============================================
// 📝 SIGN UP
// =============================================
router.post('/signup',
    rateLimiter.authLimiter,
    [
        body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number')
    ],
    authController.signUp
);

// =============================================
// 🔑 SIGN IN
// =============================================
router.post('/signin',
    rateLimiter.authLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    authController.signIn
);

// =============================================
// 🔄 REFRESH TOKEN
// =============================================
router.post('/refresh',
    rateLimiter.authLimiter,
    [
        body('refreshToken').notEmpty().withMessage('Refresh token is required')
    ],
    authController.refreshToken
);

// =============================================
// 🚪 SIGN OUT
// =============================================
router.post('/signout',
    authMiddleware.authenticate(),
    authController.signOut
);

// =============================================
// 📧 VERIFY EMAIL
// =============================================
router.get('/verify-email/:token', authController.verifyEmail);

// =============================================
// 🔑 FORGOT PASSWORD
// =============================================
router.post('/forgot-password',
    rateLimiter.authLimiter,
    [body('email').isEmail().normalizeEmail()],
    authController.forgotPassword
);

// =============================================
// 🔐 RESET PASSWORD
// =============================================
router.post('/reset-password',
    rateLimiter.authLimiter,
    [
        body('token').notEmpty().withMessage('Reset token required'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    ],
    authController.resetPassword
);

// =============================================
// 📱 2FA MANAGEMENT
// =============================================
router.post('/2fa/enable', authMiddleware.authenticate(), authController.enableTwoFactor);
router.post('/2fa/verify', authMiddleware.authenticate(), authController.verifyTwoFactor);
router.post('/2fa/disable', authMiddleware.authenticate(), authController.disableTwoFactor);

// =============================================
// 📱 SESSION MANAGEMENT
// =============================================
router.get('/sessions', authMiddleware.authenticate(), authController.getSessions);
router.delete('/sessions/:sessionId', authMiddleware.authenticate(), authController.revokeSession);

// =============================================
// 👤 GET CURRENT USER
// =============================================
router.get('/me', authMiddleware.authenticate(), async (req, res) => {
    const User = require('../models/User');
    const user = await User.findById(req.user.sub).populate('apiKeys');
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user: user.toSafeObject() });
});

module.exports = router;
