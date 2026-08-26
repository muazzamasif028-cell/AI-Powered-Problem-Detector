// ============================================================
// 🛣️ controllers/pricing.controller.js
// SUPREME Pricing Controller v14.0
// ============================================================
const pricingEngine = require('../services/pricing-engine.service');
const { success, badRequest, notFound } = require('../../../utils/responseFormatter');

class PricingController {
    
    /**
     * Calculate price for domain
     */
    async calculatePrice(req, res) {
        const { tld, plan, quantumTier, years, quantity, promoCode, country } = req.body;
        
        if (!tld) {
            return badRequest(res, 'TLD is required');
        }
        
        try {
            const result = pricingEngine.calculateTotalPrice({
                tld,
                plan: plan || 'starter',
                quantumTier: quantumTier || 'standard',
                years: years || 1,
                quantity: quantity || 1,
                promoCode: promoCode || null,
                country: country || 'US'
            });
            
            return success(res, result, 'Price calculated successfully');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    /**
     * Get all TLD pricing
     */
    async getAllTLDPricing(req, res) {
        const { category } = req.query;
        const pricing = pricingEngine.getAllTLDPricing(category);
        
        return success(res, {
            total: pricing.length,
            tlds: pricing
        }, 'TLD pricing retrieved');
    }

    /**
     * Get TLD price
     */
    async getTLDPrice(req, res) {
        const { tld } = req.params;
        const price = pricingEngine.getTLDPrice(tld);
        
        if (!price) {
            return notFound(res, `TLD .${tld} not found`);
        }
        
        return success(res, {
            tld,
            ...price
        }, 'TLD price retrieved');
    }

    /**
     * Get platform plans
     */
    async getPlans(req, res) {
        const plans = pricingEngine.getPlatformPlans();
        return success(res, plans, 'Platform plans retrieved');
    }

    /**
     * Compare plans
     */
    async comparePlans(req, res) {
        const comparison = pricingEngine.comparePlans();
        return success(res, comparison, 'Plan comparison generated');
    }

    /**
     * Get quantum tiers
     */
    async getQuantumTiers(req, res) {
        const tiers = Object.entries(pricingEngine.pricing.quantum_addons).map(([id, tier]) => ({
            id,
            ...tier
        }));
        
        return success(res, tiers, 'Quantum tiers retrieved');
    }

    /**
     * Generate enterprise quote
     */
    async getEnterpriseQuote(req, res) {
        const quote = pricingEngine.generateEnterpriseQuote(req.body);
        return success(res, quote, 'Enterprise quote generated');
    }

    /**
     * Apply promo code
     */
    async validatePromoCode(req, res) {
        const { code, subtotal } = req.body;
        
        if (!code) {
            return badRequest(res, 'Promo code is required');
        }
        
        const result = pricingEngine.applyPromoCode(code, subtotal || 0);
        
        if (!result.valid) {
            return badRequest(res, result.reason);
        }
        
        return success(res, {
            code,
            discount: `${result.percent}%`,
            savings: result.amount.toFixed(2)
        }, 'Promo code applied');
    }

    /**
     * Get pricing stats
     */
    async getStats(req, res) {
        const stats = pricingEngine.getStats();
        return success(res, stats, 'Pricing statistics retrieved');
    }

    /**
     * Clear cache
     */
    async clearCache(req, res) {
        const result = pricingEngine.clearCache();
        return success(res, result, 'Pricing cache cleared');
    }
}

module.exports = new PricingController();
