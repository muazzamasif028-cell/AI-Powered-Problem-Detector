// ============================================================
// 💰 services/pricing-engine.service.js
// SUPREME Dynamic Pricing Engine v14.0
// ============================================================
const pricingData = require('../data/domain-pricing.json');
const fs = require('fs');
const path = require('path');

class PricingEngine {
    constructor() {
        this.pricing = pricingData;
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.promoCodeUsage = new Map();
        this.loadDynamicPricing();
    }

    /**
     * Load dynamic pricing (can be updated via admin panel)
     */
    loadDynamicPricing() {
        const dynamicPath = path.join(__dirname, '../data/dynamic-pricing.json');
        
        try {
            if (fs.existsSync(dynamicPath)) {
                const dynamic = JSON.parse(fs.readFileSync(dynamicPath, 'utf-8'));
                this.pricing = { ...this.pricing, ...dynamic };
                console.log('📊 Dynamic pricing loaded');
            }
        } catch (error) {
            console.warn('No dynamic pricing file found, using defaults');
        }
    }

    /**
     * Calculate complete domain price
     */
    calculateTotalPrice(params) {
        const {
            tld,
            plan = 'starter',
            quantumTier = 'standard',
            years = 1,
            quantity = 1,
            promoCode = null,
            currency = 'USD',
            country = 'US'
        } = params;

        // Generate cache key
        const cacheKey = JSON.stringify({ tld, plan, quantumTier, years, quantity, promoCode });
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.data;
        }

        // Get base TLD price
        const tldPrice = this.getTLDPrice(tld, years);
        
        // Get platform plan addon
        const planPrice = this.getPlanPrice(plan);
        
        // Get quantum addon
        const quantumPrice = this.getQuantumPrice(quantumTier);
        
        // Calculate subtotal
        const domainSubtotal = tldPrice.register * years;
        const addonSubtotal = (planPrice + quantumPrice) * years;
        const itemSubtotal = domainSubtotal + addonSubtotal;
        const subtotal = itemSubtotal * quantity;
        
        // Apply discounts
        const discounts = this.calculateAllDiscounts({
            subtotal,
            years,
            quantity,
            promoCode,
            tld,
            plan,
            quantumTier
        });
        
        // Calculate tax
        const taxableAmount = subtotal - discounts.totalDiscount;
        const tax = this.calculateTax(taxableAmount, country);
        
        // Grand total
        const grandTotal = taxableAmount + tax;
        
        // Build breakdown
        const result = {
            domain: `example.${tld}`,
            pricing: {
                tld: {
                    name: `.${tld}`,
                    registerPrice: tldPrice.register,
                    renewalPrice: tldPrice.renew,
                    transferPrice: tldPrice.transfer
                },
                plan: {
                    name: this.getPlanName(plan),
                    price: planPrice
                },
                quantum: {
                    name: this.getQuantumName(quantumTier),
                    layers: this.getQuantumLayers(quantumTier),
                    price: quantumPrice
                },
                config: {
                    years,
                    quantity,
                    currency
                },
                breakdown: {
                    domainCost: domainSubtotal * quantity,
                    addonCost: addonSubtotal * quantity,
                    subtotal,
                    discounts: discounts.breakdown,
                    totalDiscount: discounts.totalDiscount,
                    discountPercent: ((discounts.totalDiscount / subtotal) * 100).toFixed(1),
                    tax,
                    taxRate: this.getTaxRate(country),
                    grandTotal: grandTotal.toFixed(2),
                    perDomain: (grandTotal / quantity).toFixed(2),
                    perMonth: (grandTotal / (12 * years)).toFixed(2)
                },
                savings: {
                    amount: discounts.totalDiscount.toFixed(2),
                    percent: ((discounts.totalDiscount / subtotal) * 100).toFixed(1) + '%'
                }
            },
            promoApplied: discounts.appliedPromos,
            timestamp: new Date().toISOString()
        };

        // Cache result
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

        return result;
    }

    /**
     * Get TLD pricing
     */
    getTLDPrice(tld, years = 1) {
        const tldLower = tld.toLowerCase();
        
        // Search in all TLD categories
        for (const category of ['premium_global', 'standard_global', 'country']) {
            if (this.pricing.tld_pricing[category]?.[tldLower]) {
                const price = { ...this.pricing.tld_pricing[category][tldLower] };
                
                // Apply multi-year discount to TLD price
                const multiYearDiscount = this.getMultiYearDiscount(years);
                if (multiYearDiscount > 0) {
                    price.register = price.register * (1 - multiYearDiscount / 100);
                    price.renew = price.renew * (1 - multiYearDiscount / 100);
                }
                
                return price;
            }
        }
        
        // Default pricing for unknown TLDs
        return {
            register: 14.99,
            renew: 14.99,
            transfer: 12.99,
            registry_cost: 10.00,
            margin: 4.99,
            tier: 'unknown',
            popularity: 0
        };
    }

    /**
     * Get platform plan price
     */
    getPlanPrice(plan) {
        return this.pricing.platform_plans[plan]?.addon_price || 0;
    }

    /**
     * Get plan name
     */
    getPlanName(plan) {
        return this.pricing.platform_plans[plan]?.name || 'Starter Domain';
    }

    /**
     * Get quantum tier price
     */
    getQuantumPrice(tier) {
        return this.pricing.quantum_addons[tier]?.price || 0;
    }

    /**
     * Get quantum tier name
     */
    getQuantumName(tier) {
        return this.pricing.quantum_addons[tier]?.name || 'No Quantum Layers';
    }

    /**
     * Get quantum layers count
     */
    getQuantumLayers(tier) {
        return this.pricing.quantum_addons[tier]?.layers || 0;
    }

    /**
     * Calculate all applicable discounts
     */
    calculateAllDiscounts(params) {
        const { subtotal, years, quantity, promoCode } = params;
        const breakdown = [];
        let totalDiscount = 0;
        const appliedPromos = [];

        // 1. Multi-year discount
        const multiYearDiscount = this.getMultiYearDiscount(years);
        if (multiYearDiscount > 0) {
            const amount = subtotal * (multiYearDiscount / 100);
            breakdown.push({
                type: 'multi_year',
                name: `${years}-Year Registration`,
                percent: multiYearDiscount,
                amount: amount.toFixed(2)
            });
            totalDiscount += amount;
        }

        // 2. Volume discount
        const volumeDiscount = this.getVolumeDiscount(quantity);
        if (volumeDiscount > 0) {
            const discountedSubtotal = subtotal - totalDiscount;
            const amount = discountedSubtotal * (volumeDiscount / 100);
            breakdown.push({
                type: 'volume',
                name: `Bulk Purchase (${quantity} domains)`,
                percent: volumeDiscount,
                amount: amount.toFixed(2)
            });
            totalDiscount += amount;
        }

        // 3. Promo code discount
        if (promoCode) {
            const promoResult = this.applyPromoCode(promoCode, subtotal - totalDiscount);
            if (promoResult.valid) {
                breakdown.push({
                    type: 'promo',
                    name: `Promo: ${promoCode}`,
                    percent: promoResult.percent,
                    amount: promoResult.amount.toFixed(2)
                });
                totalDiscount += promoResult.amount;
                appliedPromos.push(promoCode);
            }
        }

        // 4. Loyalty discount (if applicable)
        // Could check user's purchase history here

        return {
            breakdown,
            totalDiscount: parseFloat(totalDiscount.toFixed(2)),
            appliedPromos
        };
    }

    /**
     * Get multi-year discount percentage
     */
    getMultiYearDiscount(years) {
        const discounts = this.pricing.discounts.multi_year;
        if (years >= 10) return discounts['10_years'];
        if (years >= 5) return discounts['5_years'];
        if (years >= 3) return discounts['3_years'];
        if (years >= 2) return discounts['2_years'];
        return 0;
    }

    /**
     * Get volume discount percentage
     */
    getVolumeDiscount(quantity) {
        const discounts = this.pricing.discounts.volume;
        if (quantity >= 100) return discounts['100_domains'];
        if (quantity >= 50) return discounts['50_domains'];
        if (quantity >= 25) return discounts['25_domains'];
        if (quantity >= 10) return discounts['10_domains'];
        if (quantity >= 5) return discounts['5_domains'];
        return 0;
    }

    /**
     * Apply promo code
     */
    applyPromoCode(code, subtotal) {
        const promo = this.pricing.discounts.promo_codes[code];
        
        if (!promo) {
            return { valid: false, reason: 'Invalid promo code' };
        }
        
        if (subtotal < promo.minPurchase) {
            return { 
                valid: false, 
                reason: `Minimum purchase of $${promo.minPurchase} required` 
            };
        }
        
        // Check usage limits (max 100 uses per code)
        const usage = this.promoCodeUsage.get(code) || 0;
        if (usage >= 100) {
            return { valid: false, reason: 'Promo code expired' };
        }
        
        const amount = subtotal * (promo.discount / 100);
        this.promoCodeUsage.set(code, usage + 1);
        
        return {
            valid: true,
            percent: promo.discount,
            amount,
            code
        };
    }

    /**
     * Calculate tax
     */
    calculateTax(amount, country = 'US') {
        const rate = this.getTaxRate(country);
        return amount * rate;
    }

    /**
     * Get tax rate by country
     */
    getTaxRate(country) {
        const rates = {
            US: 0.00, UK: 0.20, EU: 0.21, IN: 0.18,
            AU: 0.10, PK: 0.00, AE: 0.05, SA: 0.15,
            JP: 0.10, CN: 0.13, DE: 0.19, FR: 0.20,
            CA: 0.13, BR: 0.17, ZA: 0.15, SG: 0.08
        };
        return rates[country] || 0;
    }

    /**
     * Get all platform plans
     */
    getPlatformPlans() {
        return Object.entries(this.pricing.platform_plans).map(([id, plan]) => ({
            id,
            name: plan.name,
            price: plan.addon_price,
            features: plan.features,
            target: plan.target
        }));
    }

    /**
     * Get all TLDs with pricing
     */
    getAllTLDPricing(category = null) {
        const results = [];
        
        for (const [cat, tlds] of Object.entries(this.pricing.tld_pricing)) {
            if (category && cat !== category) continue;
            
            for (const [tld, price] of Object.entries(tlds)) {
                results.push({
                    tld,
                    category: cat,
                    ...price
                });
            }
        }
        
        return results.sort((a, b) => b.popularity - a.popularity);
    }

    /**
     * Generate enterprise quote
     */
    generateEnterpriseQuote(params) {
        const {
            domains = [],
            plan = 'enterprise',
            quantumTier = 'quantum',
            years = 1,
            customRequirements = {}
        } = params;
        
        let totalBase = 0;
        const domainBreakdown = [];
        
        for (const domain of domains) {
            const price = this.calculateTotalPrice({
                tld: domain.tld,
                plan,
                quantumTier,
                years,
                quantity: domain.quantity || 1
            });
            
            domainBreakdown.push({
                domain: domain.name,
                tld: domain.tld,
                quantity: domain.quantity || 1,
                price: price.pricing.breakdown.grandTotal
            });
            
            totalBase += parseFloat(price.pricing.breakdown.grandTotal);
        }
        
        // Custom enterprise discount
        const enterpriseDiscount = this.calculateEnterpriseDiscount(
            domains.length, totalBase, customRequirements
        );
        
        const finalPrice = totalBase - enterpriseDiscount;
        
        return {
            quote: {
                id: `QT-${Date.now()}`,
                domains: domainBreakdown,
                plan,
                quantumTier,
                years,
                pricing: {
                    basePrice: totalBase.toFixed(2),
                    enterpriseDiscount: enterpriseDiscount.toFixed(2),
                    discountPercent: ((enterpriseDiscount / totalBase) * 100).toFixed(1) + '%',
                    finalPrice: finalPrice.toFixed(2),
                    annualBilling: (finalPrice / years).toFixed(2),
                    currency: 'USD'
                },
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                includes: [
                    'Dedicated Account Manager',
                    'Priority Migration Support',
                    'Custom DNS Configuration',
                    'Extended SLA',
                    'Quarterly Business Review'
                ]
            }
        };
    }

    /**
     * Calculate enterprise discount
     */
    calculateEnterpriseDiscount(domainCount, totalPrice, requirements) {
        let discountPercent = 0;
        
        // Volume-based
        if (domainCount >= 1000) discountPercent = 40;
        else if (domainCount >= 500) discountPercent = 30;
        else if (domainCount >= 100) discountPercent = 20;
        else if (domainCount >= 50) discountPercent = 10;
        else if (domainCount >= 10) discountPercent = 5;
        
        // Long-term commitment bonus
        if (requirements.contractYears >= 5) discountPercent += 10;
        else if (requirements.contractYears >= 3) discountPercent += 5;
        
        // Maximum enterprise discount cap
        const finalPercent = Math.min(discountPercent, 50);
        
        return totalPrice * (finalPercent / 100);
    }

    /**
     * Compare plans side by side
     */
    comparePlans() {
        const example = { tld: 'com', years: 1, quantity: 1 };
        const plans = ['starter', 'business', 'enterprise'];
        
        return plans.map(plan => {
            const price = this.calculateTotalPrice({ ...example, plan });
            
            return {
                plan: price.pricing.plan.name,
                basePrice: price.pricing.breakdown.domainCost,
                planAddon: price.pricing.plan.price,
                total: price.pricing.breakdown.grandTotal,
                features: this.pricing.platform_plans[plan].features,
                target: this.pricing.platform_plans[plan].target
            };
        });
    }

    /**
     * Get pricing stats
     */
    getStats() {
        const allTLDs = this.getAllTLDPricing();
        
        return {
            totalTLDs: allTLDs.length,
            categories: Object.keys(this.pricing.tld_pricing).length,
            averagePrice: (allTLDs.reduce((sum, t) => sum + t.register, 0) / allTLDs.length).toFixed(2),
            cheapestTLD: allTLDs.sort((a, b) => a.register - b.register)[0],
            mostExpensiveTLD: allTLDs.sort((a, b) => b.register - a.register)[0],
            plans: Object.keys(this.pricing.platform_plans).length,
            quantumTiers: Object.keys(this.pricing.quantum_addons).length,
            activePromos: Object.keys(this.pricing.discounts.promo_codes).length
        };
    }

    /**
     * Clear pricing cache
     */
    clearCache() {
        this.cache.clear();
        return { cleared: true };
    }
}

// Singleton
const pricingEngine = new PricingEngine();

module.exports = pricingEngine;
