// ============================================================
// 🛣️ routes/domain.routes.js
// SUPREME Domain Routes v11.0
// ============================================================
const express = require('express');
const router = express.Router();
const domainController = require('../controllers/domain.controller');
const dnsController = require('../controllers/dns.controller');
const sslController = require('../controllers/ssl.controller');
const emailController = require('../controllers/email.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const rateLimiter = require('../../middleware/rateLimiter.middleware');
const asyncHandler = require('../../middleware/asyncHandler');

// All routes require authentication
router.use(authMiddleware.authenticate());

// =============================================
// 🔍 DOMAIN SEARCH & DISCOVERY
// =============================================
router.post('/search', 
    rateLimiter.apiLimiter,
    asyncHandler(domainController.search)
);

router.post('/ai-suggest', 
    rateLimiter.apiLimiter,
    asyncHandler(domainController.aiSuggest)
);

router.get('/tlds', 
    asyncHandler(domainController.getSupportedTLDs)
);

// =============================================
// 🌐 DOMAIN REGISTRATION
// =============================================
router.post('/register', 
    rateLimiter.paymentLimiter,
    asyncHandler(domainController.register)
);

router.post('/transfer', 
    rateLimiter.paymentLimiter,
    asyncHandler(domainController.transfer)
);

router.get('/transfer-status/:id', 
    asyncHandler(domainController.transferStatus)
);

// =============================================
// 📋 DOMAIN MANAGEMENT
// =============================================
router.get('/my-domains', 
    asyncHandler(domainController.getMyDomains)
);

router.get('/:id', 
    asyncHandler(domainController.getDomainDetails)
);

router.post('/:id/renew', 
    rateLimiter.paymentLimiter,
    asyncHandler(domainController.renew)
);

router.delete('/:id', 
    asyncHandler(domainController.delete)
);

router.post('/:id/lock', 
    asyncHandler(domainController.toggleLock)
);

// =============================================
// 🗂️ DNS MANAGEMENT
// =============================================
router.get('/:id/dns', 
    asyncHandler(dnsController.getRecords)
);

router.post('/:id/dns', 
    asyncHandler(dnsController.addRecord)
);

router.put('/:id/dns/:recordId', 
    asyncHandler(dnsController.updateRecord)
);

router.delete('/:id/dns/:recordId', 
    asyncHandler(dnsController.deleteRecord)
);

router.post('/:id/dns/bulk', 
    asyncHandler(dnsController.bulkAddRecords)
);

// =============================================
// 🔒 SSL CERTIFICATE
// =============================================
router.get('/:id/ssl', 
    asyncHandler(sslController.getStatus)
);

router.post('/:id/ssl/issue', 
    asyncHandler(sslController.issue)
);

router.post('/:id/ssl/renew', 
    asyncHandler(sslController.renew)
);

router.delete('/:id/ssl', 
    asyncHandler(sslController.revoke)
);

// =============================================
// 📧 EMAIL SETUP
// =============================================
router.get('/:id/email', 
    asyncHandler(emailController.getStatus)
);

router.post('/:id/email/setup', 
    asyncHandler(emailController.setup)
);

router.post('/:id/email/add-account', 
    asyncHandler(emailController.addAccount)
);

router.get('/:id/email/dns-records', 
    asyncHandler(emailController.getRequiredDNSRecords)
);

// =============================================
// 🚀 ONE-CLICK DEPLOY
// =============================================
router.post('/:id/deploy', 
    asyncHandler(domainController.oneClickDeploy)
);

router.get('/:id/deploy-status', 
    asyncHandler(domainController.deployStatus)
);

// =============================================
// 📊 WHOIS
// =============================================
router.get('/:id/whois', 
    asyncHandler(domainController.getWhois)
);

module.exports = router;
