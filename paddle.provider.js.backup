// ============================================================
// 🏓 src/services/payment/paddle.provider.js
// Paddle — Merchant of Record (Handles global taxes)
// Supported: 200+ countries, PayPal, Cards, Apple Pay, Google Pay
// ============================================================
const axios = require('axios');
const Domain = require('../../models/Domain');
const User = require('../../models/User');

class PaddleProvider {
    constructor() {
        this.apiKey = process.env.PADDLE_API_KEY;
        this.clientToken = process.env.PADDLE_CLIENT_TOKEN;
        this.webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
        this.baseURL = 'https://api.paddle.com';
        this.sandbox = process.env.NODE_ENV !== 'production';
        
        this.supportedCountries = [
            'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX',
            'AE', 'SA', 'SG', 'NL', 'IT', 'ES', 'SE', 'NO', 'DK', 'FI',
            'PK', 'NG', 'KE', 'ZA', 'EG', 'TR', 'ID', 'PH', 'VN', 'TH',
            // ... 200+ more countries
        ];

        this.paymentMethods = {
            US: ['card', 'paypal', 'apple_pay', 'google_pay'],
            UK: ['card', 'paypal', 'apple_pay', 'google_pay'],
            IN: ['card', 'upi', 'netbanking', 'paypal'],
            PK: ['card', 'paypal'],
            AE: ['card', 'paypal', 'apple_pay'],
            SA: ['card', 'mada', 'paypal', 'apple_pay'],
            JP: ['card', 'paypal', 'apple_pay', 'konbini'],
            BR: ['card', 'paypal', 'boleto', 'pix'],
            MX: ['card', 'paypal', 'oxxo'],
            default: ['card', 'paypal']
        };
    }

    /**
     * Create checkout for domain purchase
     */
    async createCheckout(userId, domainData) {
        const { domainName, tld, years = 1, plan = 'starter' } = domainData;
        const user = await User.findById(userId);
        
        const price = this.getDomainPrice(tld, years, plan);
        
        try {
            // Paddle API — Create transaction
            const response = await axios.post(
                `${this.baseURL}/transactions`,
                {
                    items: [{
                        price: {
                            description: `Domain: ${domainName}.${tld}`,
                            unit_price: {
                                amount: (price * 100).toString(), // Paddle uses string amounts
                                currency_code: 'USD'
                            },
                            product: {
                                name: `${domainName}.${tld}`,
                                description: `${years} year(s) domain registration`,
                                tax_category: 'digital-goods'
                            },
                            quantity: 1
                        }
                    }],
                    customer: {
                        email: user.email,
                        name: user.name
                    },
                    custom_data: {
                        userId,
                        domainName,
                        tld,
                        years: years.toString(),
                        plan
                    },
                    status: 'draft',
                    billing: {
                        payment_method: 'automatic'
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Get checkout URL
            const checkoutUrl = response.data.data.checkout.url;
            
            return {
                success: true,
                provider: 'paddle',
                checkoutUrl,
                transactionId: response.data.data.id,
                price,
                currency: 'USD'
            };

        } catch (error) {
            console.error('Paddle checkout error:', error.response?.data || error.message);
            throw new Error('Failed to create checkout');
        }
    }

    /**
     * Get payment URL for domain purchase
     */
    async getPaymentUrl(userId, domainData) {
        const checkout = await this.createCheckout(userId, domainData);
        return checkout.checkoutUrl;
    }

    /**
     * Handle Paddle webhook
     */
    async handleWebhook(req, res) {
        // Verify webhook signature
        const signature = req.headers['paddle-signature'];
        
        if (!this.verifyWebhookSignature(req.body, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = JSON.parse(req.body.toString());
        
        switch (event.event_type) {
            case 'transaction.completed':
                await this.handleTransactionCompleted(event.data);
                break;
                
            case 'transaction.payment_failed':
                await this.handlePaymentFailed(event.data);
                break;
                
            case 'transaction.refunded':
                await this.handleRefund(event.data);
                break;
                
            case 'subscription.created':
                await this.handleSubscriptionCreated(event.data);
                break;
                
            case 'subscription.cancelled':
                await this.handleSubscriptionCancelled(event.data);
                break;
        }

        res.json({ received: true });
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload, signature) {
        if (!this.webhookSecret) return true; // Skip in development
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', this.webhookSecret);
        const computedSignature = hmac.update(payload).digest('hex');
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(computedSignature)
        );
    }

    /**
     * Handle completed transaction
     */
    async handleTransactionCompleted(data) {
        const { userId, domainName, tld, years, plan } = data.custom_data;
        
        // Create domain
        const domain = await Domain.create({
            userId,
            domainName: domainName.toLowerCase(),
            tld: tld.toLowerCase(),
            years: parseInt(years),
            status: 'active',
            price: parseFloat(data.totals.total) / 100,
            paymentProvider: 'paddle',
            paymentTransactionId: data.id,
            expiryDate: new Date(Date.now() + parseInt(years) * 365 * 24 * 60 * 60 * 1000),
            websiteUrl: `https://${domainName}.${tld}`,
            websiteDeployed: true
        });

        await User.findByIdAndUpdate(userId, {
            $push: { domains: domain._id }
        });

        console.log(`✅ Paddle: Domain ${domainName}.${tld} registered for user ${userId}`);
    }

    /**
     * Handle payment failure
     */
    async handlePaymentFailed(data) {
        console.error('❌ Paddle payment failed:', data.id);
        // Notify user via email
    }

    /**
     * Handle refund
     */
    async handleRefund(data) {
        const domain = await Domain.findOne({
            paymentTransactionId: data.id,
            paymentProvider: 'paddle'
        });
        
        if (domain) {
            domain.status = 'deleted';
            await domain.save();
            console.log(`↩️ Domain ${domain.fullDomain} refunded and removed`);
        }
    }

    /**
     * Create subscription for recurring plans
     */
    async createSubscription(userId, planData) {
        const { plan, domainId } = planData;
        const user = await User.findById(userId);
        const prices = {
            pro: { monthly: 19, yearly: 190 },
            business: { monthly: 49, yearly: 490 },
            enterprise: { monthly: 99, yearly: 990 }
        };

        const response = await axios.post(
            `${this.baseURL}/subscriptions`,
            {
                customer: { email: user.email },
                items: [{
                    price: {
                        description: `SUPREME OS ${plan} Plan`,
                        unit_price: {
                            amount: (prices[plan].yearly * 100).toString(),
                            currency_code: 'USD'
                        },
                        product: {
                            name: `SUPREME ${plan.toUpperCase()}`,
                            tax_category: 'saas'
                        },
                        billing_cycle: { interval: 'year', frequency: 1 }
                    }
                }],
                custom_data: { userId, plan, domainId }
            },
            {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            }
        );

        return {
            success: true,
            subscriptionId: response.data.data.id,
            checkoutUrl: response.data.data.checkout?.url
        };
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId) {
        await axios.patch(
            `${this.baseURL}/subscriptions/${subscriptionId}`,
            { status: 'canceled' },
            { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
        );
        
        return { success: true, message: 'Subscription cancelled' };
    }

    /**
     * Verify payment
     */
    async verifyPayment(transactionId) {
        const response = await axios.get(
            `${this.baseURL}/transactions/${transactionId}`,
            { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
        );
        
        return {
            success: response.data.data.status === 'completed',
            data: response.data.data
        };
    }

    /**
     * Get domain price with Paddle's tax handling
     */
    getDomainPrice(tld, years, plan) {
        const basePrices = {
            'com': 12.99, 'net': 14.99, 'org': 13.99,
            'io': 45.00, 'ai': 79.00, 'co': 25.00
        };
        
        let price = (basePrices[tld] || 14.99) * years;
        
        // Plan addon
        const planAddons = { starter: 0, pro: 10, business: 25, enterprise: 50 };
        price += (planAddons[plan] || 0) * years;
        
        return price;
    }

    /**
     * Get payment methods for country
     */
    getPaymentMethods(country) {
        return this.paymentMethods[country] || this.paymentMethods.default;
    }
}

module.exports = new PaddleProvider();
