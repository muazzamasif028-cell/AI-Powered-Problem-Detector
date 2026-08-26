// ============================================================
// 🍋 src/services/payment/lemonsqueezy.provider.js
// Lemon Squeezy — Modern MoR for SaaS
// Supported: Global, Crypto payments, Buy Now Pay Later
// ============================================================
const axios = require('axios');
const Domain = require('../../models/Domain');
const User = require('../../models/User');

class LemonSqueezyProvider {
    constructor() {
        this.apiKey = process.env.LEMONSQUEEZY_API_KEY;
        this.storeId = process.env.LEMONSQUEEZY_STORE_ID;
        this.webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
        this.baseURL = 'https://api.lemonsqueezy.com/v1';
        
        this.supportedCountries = [
            'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX',
            'AE', 'SA', 'SG', 'KR', 'HK', 'TW', 'MY', 'ID', 'PH', 'TH',
            'PK', 'BD', 'LK', 'NP', 'NG', 'KE', 'GH', 'ZA', 'EG', 'MA',
            // Lemon Squeezy supports 100+ countries
        ];
    }

    /**
     * Create checkout
     */
    async createCheckout(userId, domainData) {
        const { domainName, tld, years = 1, plan = 'starter' } = domainData;
        const user = await User.findById(userId);
        const price = this.getDomainPrice(tld, years, plan) * 100; // Cents
        
        try {
            // First, create or get variant
            const variantId = await this.getOrCreateVariant(tld, plan, price);
            
            // Create checkout
            const response = await axios.post(
                `${this.baseURL}/checkouts`,
                {
                    data: {
                        type: 'checkouts',
                        attributes: {
                            checkout_data: {
                                email: user.email,
                                name: user.name,
                                custom: {
                                    userId,
                                    domainName,
                                    tld,
                                    years: years.toString(),
                                    plan
                                }
                            },
                            product_options: {
                                redirect_url: `${process.env.FRONTEND_URL}/domains?success=true`
                            }
                        },
                        relationships: {
                            store: {
                                data: { type: 'stores', id: this.storeId }
                            },
                            variant: {
                                data: { type: 'variants', id: variantId }
                            }
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/vnd.api+json'
                    }
                }
            );

            return {
                success: true,
                provider: 'lemonsqueezy',
                checkoutUrl: response.data.data.attributes.url,
                checkoutId: response.data.data.id,
                price: price / 100,
                currency: 'USD'
            };

        } catch (error) {
            console.error('Lemon Squeezy error:', error.response?.data || error.message);
            throw new Error('Failed to create checkout');
        }
    }

    /**
     * Handle webhook
     */
    async handleWebhook(req, res) {
        const signature = req.headers['x-signature'];
        const event = req.body;
        
        // Verify signature in production
        if (process.env.NODE_ENV === 'production') {
            const crypto = require('crypto');
            const hmac = crypto.createHmac('sha256', this.webhookSecret);
            const digest = hmac.update(JSON.stringify(event)).digest('hex');
            
            if (signature !== digest) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        const eventName = event.meta?.event_name;
        
        switch (eventName) {
            case 'order_created':
                await this.handleOrderCreated(event.data);
                break;
                
            case 'subscription_created':
                await this.handleSubscriptionCreated(event.data);
                break;
                
            case 'subscription_cancelled':
                await this.handleSubscriptionCancelled(event.data);
                break;
        }

        res.json({ received: true });
    }

    /**
     * Handle order created
     */
    async handleOrderCreated(data) {
        const custom = data.attributes.custom_data || data.attributes.checkout_data?.custom;
        if (!custom) return;

        const { userId, domainName, tld, years } = custom;

        const domain = await Domain.create({
            userId,
            domainName: domainName.toLowerCase(),
            tld: tld.toLowerCase(),
            years: parseInt(years),
            status: 'active',
            price: data.attributes.total / 100,
            paymentProvider: 'lemonsqueezy',
            paymentTransactionId: data.id,
            expiryDate: new Date(Date.now() + parseInt(years) * 365 * 24 * 60 * 60 * 1000),
            websiteUrl: `https://${domainName}.${tld}`,
            websiteDeployed: true
        });

        await User.findByIdAndUpdate(userId, {
            $push: { domains: domain._id }
        });

        console.log(`✅ LemonSqueezy: Domain ${domainName}.${tld} registered`);
    }

    /**
     * Get or create product variant
     */
    async getOrCreateVariant(tld, plan, price) {
        // In production, you'd create products/variants in Lemon Squeezy dashboard
        // and store the variant IDs in your database
        const variantIds = {
            'com-starter': process.env.LS_VARIANT_COM_STARTER || '12345',
            'com-pro': process.env.LS_VARIANT_COM_PRO || '12346',
            'io-starter': process.env.LS_VARIANT_IO_STARTER || '12347',
            'ai-starter': process.env.LS_VARIANT_AI_STARTER || '12348',
        };
        
        const key = `${tld}-${plan}`;
        return variantIds[key] || variantIds['com-starter'];
    }

    getDomainPrice(tld, years, plan) {
        const basePrices = {
            'com': 12.99, 'net': 14.99, 'org': 13.99,
            'io': 45.00, 'ai': 79.00
        };
        const planAddons = { starter: 0, pro: 10, business: 25 };
        
        return ((basePrices[tld] || 14.99) + (planAddons[plan] || 0)) * years;
    }

    async verifyPayment(transactionId) {
        const response = await axios.get(
            `${this.baseURL}/orders/${transactionId}`,
            { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
        );
        
        return {
            success: response.data.data.attributes.status === 'paid',
            data: response.data.data
        };
    }
}

module.exports = new LemonSqueezyProvider();
