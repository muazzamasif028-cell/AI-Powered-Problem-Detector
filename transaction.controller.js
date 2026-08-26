// ============================================================
// 🛣️ controllers/transaction.controller.js
// SUPREME Transaction Controller v15.0
// ============================================================
const transactionService = require('../services/transaction.service');
const pricingEngine = require('../services/pricing-engine.service');
const registrySyncService = require('../services/registry-sync.service');
const { success, badRequest, notFound, serverError } = require('../../../utils/responseFormatter');

class TransactionController {

    /**
     * Create purchase transaction
     */
    async createTransaction(req, res) {
        try {
            const { domain, tld, years, plan, quantumTier, paymentMethod, promoCode } = req.body;
            
            if (!domain || !tld) {
                return badRequest(res, 'Domain and TLD are required');
            }

            const transaction = await transactionService.createPurchaseTransaction({
                userId: req.user.id,
                domain,
                tld,
                years: years || 1,
                plan: plan || 'starter',
                quantumTier: quantumTier || 'standard',
                paymentMethod: paymentMethod || 'stripe',
                promoCode,
                currency: req.body.currency || 'USD'
            });

            return success(res, transaction, 'Transaction created successfully', 201);

        } catch (error) {
            return serverError(res, error.message);
        }
    }

    /**
     * Process payment
     */
    async processPayment(req, res) {
        try {
            const { transactionId, paymentDetails } = req.body;
            
            if (!transactionId) {
                return badRequest(res, 'Transaction ID is required');
            }

            const transaction = await transactionService.processPayment(transactionId, paymentDetails);

            return success(res, transaction, 'Payment processed successfully');

        } catch (error) {
            return serverError(res, error.message);
        }
    }

    /**
     * Get transaction status
     */
    async getTransaction(req, res) {
        const { id } = req.params;
        const transaction = transactionService.getTransaction(id);
        
        if (!transaction) {
            return notFound(res, 'Transaction not found');
        }
        
        return success(res, transaction, 'Transaction retrieved');
    }

    /**
     * Get user transactions
     */
    async getUserTransactions(req, res) {
        const { limit } = req.query;
        const transactions = transactionService.getUserTransactions(
            req.user.id,
            parseInt(limit) || 20
        );
        
        return success(res, {
            total: transactions.length,
            transactions
        }, 'User transactions retrieved');
    }

    /**
     * Initiate refund
     */
    async refundTransaction(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            
            const refund = await transactionService.initiateRefund(id, reason);
            
            if (!refund) {
                return badRequest(res, 'Transaction cannot be refunded');
            }
            
            return success(res, refund, 'Refund initiated');
            
        } catch (error) {
            return serverError(res, error.message);
        }
    }

    /**
     * Get real-time TLD pricing
     */
    async getRealTimePricing(req, res) {
        const { tld } = req.params;
        
        try {
            const price = pricingEngine.getDynamicTLDPrice(tld);
            const registryInfo = registrySyncService.getRegistryPrice(tld);
            
            return success(res, {
                tld,
                pricing: price,
                registry: registryInfo ? {
                    name: registryInfo.registry,
                    lastSynced: registryInfo.syncedAt
                } : null,
                timestamp: new Date().toISOString()
            }, 'Real-time pricing retrieved');
            
        } catch (error) {
            return serverError(res, error.message);
        }
    }

    /**
     * Get registry sync status
     */
    async getRegistryStatus(req, res) {
        const stats = registrySyncService.getStats();
        return success(res, stats, 'Registry sync status retrieved');
    }

    /**
     * Force sync specific TLD
     */
    async syncTLD(req, res) {
        const { tld } = req.params;
        
        try {
            const price = await registrySyncService.syncSpecificTLD(tld);
            return success(res, {
                tld,
                pricing: price,
                message: 'TLD pricing synced successfully'
            }, 'TLD synced');
            
        } catch (error) {
            return serverError(res, error.message);
        }
    }

    /**
     * Get transaction stats
     */
    async getTransactionStats(req, res) {
        const stats = transactionService.getStats();
        return success(res, stats, 'Transaction statistics retrieved');
    }
}

module.exports = new TransactionController();
