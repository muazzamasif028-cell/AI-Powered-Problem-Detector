// ============================================================
// 🛣️ routes/universal.routes.js
// SUPREME Universal Services Routes v12.0
// ============================================================
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../../middleware/asyncHandler');
const universalController = require('../controllers/universal.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const rateLimiter = require('../../../middleware/rateLimiter.middleware');

// =============================================
// 🔑 UNIVERSAL LOGIN
// =============================================
router.post('/login/:provider', 
    rateLimiter.authLimiter,
    asyncHandler(universalController.universalLogin)
);

router.get('/login/:provider/callback', 
    asyncHandler(universalController.oauthCallback)
);

router.post('/login/refresh', 
    rateLimiter.authLimiter,
    asyncHandler(universalController.refreshToken)
);

router.post('/logout', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.logout)
);

// =============================================
// 👤 UNIVERSAL IDENTITY
// =============================================
router.get('/identity', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.getIdentity)
);

router.put('/identity', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.updateIdentity)
);

router.delete('/identity', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.deleteIdentity)
);

router.post('/identity/link/:provider', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.linkProvider)
);

router.delete('/identity/unlink/:provider', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.unlinkProvider)
);

// =============================================
// 🧠 UNIVERSAL AI MEMORY
// =============================================
router.get('/memory', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.getAIMemory)
);

router.post('/memory', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.updateAIMemory)
);

router.post('/memory/interaction', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.addInteraction)
);

router.delete('/memory', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.clearMemory)
);

// =============================================
// 🔍 UNIVERSAL SEARCH
// =============================================
router.get('/search', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.universalSearch)
);

// =============================================
// 🌐 UNIVERSAL API GATEWAY
// =============================================
router.all('/gateway/:service/*', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.apiGateway)
);

// =============================================
// 📱 UNIVERSAL APP STORE
// =============================================
router.get('/apps', 
    asyncHandler(universalController.getApps)
);

router.get('/apps/:id', 
    asyncHandler(universalController.getApp)
);

router.post('/apps/:id/install', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.installApp)
);

router.delete('/apps/:id/uninstall', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.uninstallApp)
);

// =============================================
// 🛒 UNIVERSAL PAYMENT GATEWAY
// =============================================
router.post('/pay', 
    authMiddleware.authenticate(),
    rateLimiter.paymentLimiter,
    asyncHandler(universalController.universalPayment)
);

router.get('/transactions', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.getTransactions)
);

// =============================================
// 📊 UNIVERSAL DASHBOARD
// =============================================
router.get('/dashboard', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.getDashboard)
);

router.get('/activity', 
    authMiddleware.authenticate(),
    asyncHandler(universalController.getActivity)
);

module.exports = router;
