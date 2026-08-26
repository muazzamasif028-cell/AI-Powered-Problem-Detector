// ============================================================
// 🅿️ src/services/payment/paypal.provider.js
// PayPal — Traditional but widely used
// Supported: 200+ countries (varies by feature)
// ============================================================
const paypal = require('paypal-rest-sdk');
const Domain = require('../../models/Domain');
const User = require('../../models/User');

class PayPalProvider {
    constructor() {
        paypal.configure({
            mode: process.env.PAYPAL_MODE || 'sandbox',
            client_id: process.env.PAYPAL_CLIENT_ID,
            client_secret: process.env.PAYPAL_CLIENT_SECRET
        });

        this.supportedCountries = [
            'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP',
            'IN', 'BR', 'MX', 'AE', 'SA', 'SG', 'HK', 'MY', 'PH',
            'PK', 'NG', 'ZA', 'EG', 'TR', 'RU', 'ID', 'TH', 'VN',
            // PayPal available in 200+ countries
        ];
    }

    /**
     * Create PayPal payment
     */
    async createCheckout(userId, domainData) {
        const { domainName, tld, years = 1, plan = 'starter' } = domainData;
        const user = await User.findById(userId);
        const price = this.getDomainPrice(tld, years, plan);

        const paymentData = {
            intent: 'sale',
            payer: {
                payment_method: 'paypal'
            },
            redirect_urls: {
                return_url: `${process.env.FRONTEND_URL}/domains?success=true`,
                cancel_url: `${process.env.FRONTEND_URL}/domains?cancelled=true`
            },
            transactions: [{
                item_list: {
                    items: [{
                        name: `Domain: ${domainName}.${tld}`,
                        sku: `${domainName}-${tld}`,
                        price: price.toFixed(2),
                        currency: 'USD',
                        quantity: 1
                    }]
                },
                amount: {
                    currency: 'USD',
                    total: price.toFixed(2)
                },
                description: `${years} year(s) domain registration for ${domainName}.${tld}`,
                custom: JSON.stringify({ userId, domainName, tld, years, plan })
            }]
        };

        return new Promise((resolve, reject) => {
            paypal.payment.create(paymentData, (error, payment) => {
                if (error) {
                    console.error('PayPal error:', error);
                    reject(new Error('Failed to create PayPal payment'));
                } else {
                    // Find approval URL
                    const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
                    
                    resolve({
                        success: true,
                        provider: 'paypal',
                        checkoutUrl: approvalUrl?.href,
                        paymentId: payment.id,
                        price,
                        currency: 'USD'
                    });
                }
            });
        });
    }

    /**
     * Execute payment after user approval
     */
    async executePayment(paymentId, payerId) {
        return new Promise((resolve, reject) => {
            paypal.payment.execute(paymentId, { payer_id: payerId }, async (error, payment) => {
                if (error) {
                    reject(error);
                } else {
                    // Parse custom data
                    const custom = JSON.parse(payment.transactions[0].custom);
                    await this.handlePaymentSuccess(custom, payment);
                    resolve({ success: true, payment });
                }
            });
        });
    }

    /**
     * Handle successful payment
     */
    async handlePaymentSuccess(custom, payment) {
        const { userId, domainName, tld, years } = custom;

        const domain = await Domain.create({
            userId,
            domainName: domainName.toLowerCase(),
            tld: tld.toLowerCase(),
            years: parseInt(years),
            status: 'active',
            price: parseFloat(payment.transactions[0].amount.total),
            paymentProvider: 'paypal',
            paymentTransactionId: payment.id,
            expiryDate: new Date(Date.now() + parseInt(years) * 365 * 24 * 60 * 60 * 1000),
            websiteUrl: `https://${domainName}.${tld}`,
            websiteDeployed: true
        });

        await User.findByIdAndUpdate(userId, {
            $push: { domains: domain._id }
        });

        console.log(`✅ PayPal: Domain ${domainName}.${tld} registered`);
    }

    /**
     * Handle IPN (Instant Payment Notification)
     */
    async handleWebhook(req, res) {
        const event = req.body;

        // Verify IPN with PayPal
        const verified = await this.verifyIPN(req.body);
        
        if (!verified) {
            return res.status(400).json({ error: 'Invalid IPN' });
        }

        if (event.payment_status === 'Completed') {
            // Payment verified
            console.log('PayPal IPN: Payment completed', event.txn_id);
        }

        res.json({ received: true });
    }

    /**
     * Verify IPN message with PayPal
     */
    async verifyIPN(body) {
        try {
            const response = await axios.post(
                `https://ipnpb.${process.env.PAYPAL_MODE === 'live' ? '' : 'sandbox.'}paypal.com/cgi-bin/webscr`,
                `cmd=_notify-validate&${new URLSearchParams(body).toString()}`,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            
            return response.data === 'VERIFIED';
        } catch (error) {
            return false;
        }
    }

    getDomainPrice(tld, years, plan) {
        const basePrices = {
            'com': 12.99, 'net': 14.99, 'org': 13.99,
            'io': 45.00, 'ai': 79.00
        };
        return (basePrices[tld] || 14.99) * years;
    }

    async verifyPayment(paymentId) {
        return new Promise((resolve, reject) => {
            paypal.payment.get(paymentId, (error, payment) => {
                if (error) reject(error);
                resolve({ success: payment.state === 'approved', data: payment });
            });
        });
    }
}

module.exports = new PayPalProvider();
