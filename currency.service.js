// ============================================================
// 💱 src/services/billing/currency.service.js
// Multi-Currency Support
// ============================================================
const axios = require('axios');

class CurrencyService {
    constructor() {
        this.baseCurrency = 'USD';
        this.supportedCurrencies = [
            'USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR',
            'JPY', 'AUD', 'CAD', 'SGD', 'MYR', 'IDR', 'PHP',
            'VND', 'THB', 'KRW', 'CNY', 'HKD', 'TWD', 'BRL',
            'MXN', 'ARS', 'COP', 'CLP', 'PEN', 'NGN', 'KES',
            'ZAR', 'EGP', 'TRY', 'RUB', 'UAH', 'BDT', 'LKR',
            'NPR', 'QAR', 'OMR', 'BHD', 'KWD'
        ];
        
        this.rates = {};
        this.lastUpdated = null;
        this.symbols = {
            USD: '$', EUR: '€', GBP: '£', PKR: '₨', INR: '₹',
            AED: 'د.إ', SAR: '﷼', JPY: '¥', AUD: 'A$', CAD: 'C$',
            SGD: 'S$', MYR: 'RM', IDR: 'Rp', PHP: '₱', VND: '₫',
            THB: '฿', KRW: '₩', CNY: '¥', HKD: 'HK$', BRL: 'R$',
            MXN: 'Mex$', NGN: '₦', KES: 'KSh', ZAR: 'R',
            EGP: 'E£', TRY: '₺', BDT: '৳', LKR: 'Rs', NPR: 'रू',
            QAR: 'QR', OMR: 'OMR', BHD: 'BD', KWD: 'KD'
        };
    }

    /**
     * Fetch latest exchange rates
     */
    async fetchRates() {
        try {
            // Use free API (replace with paid API in production)
            const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
            
            this.rates = response.data.rates;
            this.lastUpdated = new Date();
            
            console.log(`💱 Exchange rates updated: ${Object.keys(this.rates).length} currencies`);
        } catch (error) {
            console.error('Failed to fetch rates:', error.message);
            // Use cached rates
        }
    }

    /**
     * Convert amount between currencies
     */
    convert(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return amount;
        
        const fromRate = this.rates[fromCurrency] || 1;
        const toRate = this.rates[toCurrency] || 1;
        
        const usdAmount = amount / fromRate;
        const convertedAmount = usdAmount * toRate;
        
        return parseFloat(convertedAmount.toFixed(2));
    }

    /**
     * Format currency for display
     */
    format(amount, currency) {
        const symbol = this.symbols[currency] || currency;
        
        // Different formatting for different currencies
        const formatters = {
            USD: (v) => `${symbol}${v.toFixed(2)}`,
            EUR: (v) => `${symbol}${v.toFixed(2)}`,
            GBP: (v) => `${symbol}${v.toFixed(2)}`,
            PKR: (v) => `${symbol} ${v.toLocaleString()}`,
            INR: (v) => `${symbol}${v.toLocaleString()}`,
            JPY: (v) => `${symbol}${v.toLocaleString()}`,
            AED: (v) => `${v.toFixed(2)} ${symbol}`,
            SAR: (v) => `${v.toFixed(2)} ${symbol}`,
            default: (v) => `${symbol}${v.toFixed(2)}`
        };
        
        const formatter = formatters[currency] || formatters.default;
        return formatter(amount);
    }

    /**
     * Get customer's preferred currency
     */
    getCustomerCurrency(country) {
        const countryCurrency = {
            'US': 'USD', 'UK': 'GBP', 'DE': 'EUR', 'FR': 'EUR',
            'IN': 'INR', 'PK': 'PKR', 'AE': 'AED', 'SA': 'SAR',
            'JP': 'JPY', 'AU': 'AUD', 'CA': 'CAD', 'SG': 'SGD',
            'MY': 'MYR', 'ID': 'IDR', 'PH': 'PHP', 'VN': 'VND',
            'TH': 'THB', 'KR': 'KRW', 'CN': 'CNY', 'BR': 'BRL',
            'MX': 'MXN', 'NG': 'NGN', 'KE': 'KES', 'ZA': 'ZAR',
            'EG': 'EGP', 'TR': 'TRY', 'BD': 'BDT', 'LK': 'LKR',
            'NP': 'NPR', 'QA': 'QAR', 'OM': 'OMR', 'BH': 'BHD', 'KW': 'KWD'
        };
        
        return countryCurrency[country] || 'USD';
    }

    /**
     * Get supported currencies with details
     */
    getSupportedCurrencies() {
        return this.supportedCurrencies.map(code => ({
            code,
            symbol: this.symbols[code] || code,
            rate: this.rates[code] || 1,
            name: this.getCurrencyName(code)
        }));
    }

    getCurrencyName(code) {
        const names = {
            USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound',
            PKR: 'Pakistani Rupee', INR: 'Indian Rupee',
            AED: 'UAE Dirham', SAR: 'Saudi Riyal',
            JPY: 'Japanese Yen', AUD: 'Australian Dollar',
            CAD: 'Canadian Dollar', SGD: 'Singapore Dollar'
        };
        return names[code] || code;
    }
}

module.exports = new CurrencyService();
