// ============================================================
// 🌍 src/services/billing/tax.service.js
// Global Tax Calculation — VAT, GST, Sales Tax, Digital Services
// ============================================================

class TaxService {
    constructor() {
        // Tax rates by country (simplified — update regularly)
        this.taxRates = {
            // EU VAT
            'AT': { rate: 20, name: 'VAT', region: 'EU' },
            'BE': { rate: 21, name: 'VAT', region: 'EU' },
            'BG': { rate: 20, name: 'VAT', region: 'EU' },
            'HR': { rate: 25, name: 'VAT', region: 'EU' },
            'CY': { rate: 19, name: 'VAT', region: 'EU' },
            'CZ': { rate: 21, name: 'VAT', region: 'EU' },
            'DK': { rate: 25, name: 'VAT', region: 'EU' },
            'EE': { rate: 20, name: 'VAT', region: 'EU' },
            'FI': { rate: 24, name: 'VAT', region: 'EU' },
            'FR': { rate: 20, name: 'VAT', region: 'EU' },
            'DE': { rate: 19, name: 'VAT', region: 'EU' },
            'GR': { rate: 24, name: 'VAT', region: 'EU' },
            'HU': { rate: 27, name: 'VAT', region: 'EU' },
            'IE': { rate: 23, name: 'VAT', region: 'EU' },
            'IT': { rate: 22, name: 'VAT', region: 'EU' },
            'LV': { rate: 21, name: 'VAT', region: 'EU' },
            'LT': { rate: 21, name: 'VAT', region: 'EU' },
            'LU': { rate: 17, name: 'VAT', region: 'EU' },
            'MT': { rate: 18, name: 'VAT', region: 'EU' },
            'NL': { rate: 21, name: 'VAT', region: 'EU' },
            'PL': { rate: 23, name: 'VAT', region: 'EU' },
            'PT': { rate: 23, name: 'VAT', region: 'EU' },
            'RO': { rate: 19, name: 'VAT', region: 'EU' },
            'SK': { rate: 20, name: 'VAT', region: 'EU' },
            'SI': { rate: 22, name: 'VAT', region: 'EU' },
            'ES': { rate: 21, name: 'VAT', region: 'EU' },
            'SE': { rate: 25, name: 'VAT', region: 'EU' },
            
            // Non-EU Europe
            'UK': { rate: 20, name: 'VAT', region: 'UK' },
            'CH': { rate: 7.7, name: 'VAT', region: 'Europe' },
            'NO': { rate: 25, name: 'VAT', region: 'Europe' },
            
            // Asia Pacific
            'IN': { rate: 18, name: 'GST', region: 'Asia' },
            'JP': { rate: 10, name: 'Consumption Tax', region: 'Asia' },
            'KR': { rate: 10, name: 'VAT', region: 'Asia' },
            'SG': { rate: 8, name: 'GST', region: 'Asia' },
            'AU': { rate: 10, name: 'GST', region: 'Oceania' },
            'NZ': { rate: 15, name: 'GST', region: 'Oceania' },
            'ID': { rate: 11, name: 'VAT', region: 'Asia' },
            'MY': { rate: 6, name: 'SST', region: 'Asia' },
            'TH': { rate: 7, name: 'VAT', region: 'Asia' },
            'PH': { rate: 12, name: 'VAT', region: 'Asia' },
            'VN': { rate: 10, name: 'VAT', region: 'Asia' },
            'BD': { rate: 15, name: 'VAT', region: 'Asia' },
            'LK': { rate: 15, name: 'VAT', region: 'Asia' },
            'NP': { rate: 13, name: 'VAT', region: 'Asia' },
            'PK': { rate: 17, name: 'Sales Tax', region: 'Asia' },
            
            // Middle East
            'AE': { rate: 5, name: 'VAT', region: 'Middle East' },
            'SA': { rate: 15, name: 'VAT', region: 'Middle East' },
            'QA': { rate: 0, name: 'VAT', region: 'Middle East' },
            'KW': { rate: 0, name: 'VAT', region: 'Middle East' },
            'OM': { rate: 5, name: 'VAT', region: 'Middle East' },
            'BH': { rate: 10, name: 'VAT', region: 'Middle East' },
            'EG': { rate: 14, name: 'VAT', region: 'Middle East' },
            'TR': { rate: 18, name: 'VAT', region: 'Middle East' },
            'IL': { rate: 17, name: 'VAT', region: 'Middle East' },
            
            // Africa
            'ZA': { rate: 15, name: 'VAT', region: 'Africa' },
            'NG': { rate: 7.5, name: 'VAT', region: 'Africa' },
            'KE': { rate: 16, name: 'VAT', region: 'Africa' },
            'GH': { rate: 12.5, name: 'VAT', region: 'Africa' },
            'MA': { rate: 20, name: 'VAT', region: 'Africa' },
            'TN': { rate: 18, name: 'VAT', region: 'Africa' },
            'ET': { rate: 15, name: 'VAT', region: 'Africa' },
            
            // Americas
            'US': { rate: 0, name: 'Sales Tax', region: 'North America', note: 'Varies by state' },
            'CA': { rate: 5, name: 'GST', region: 'North America', note: 'Provincial tax may apply' },
            'MX': { rate: 16, name: 'IVA', region: 'North America' },
            'BR': { rate: 17, name: 'ICMS', region: 'South America', note: 'Varies by state' },
            'AR': { rate: 21, name: 'IVA', region: 'South America' },
            'CO': { rate: 19, name: 'IVA', region: 'South America' },
            'CL': { rate: 19, name: 'IVA', region: 'South America' },
            'PE': { rate: 18, name: 'IGV', region: 'South America' }
        };
        
        // Digital services tax thresholds
        this.digitalTaxThresholds = {
            'EU': { threshold: 10000, note: 'OSS registration required above €10,000' },
            'UK': { threshold: 85000, note: 'VAT registration required above £85,000' },
            'SG': { threshold: 100000, note: 'GST registration above S$100,000' },
            'AU': { threshold: 75000, note: 'GST registration above A$75,000' }
        };
    }

    /**
     * Calculate tax for an invoice
     */
    calculateTax(amount, country, customerType = 'individual', taxExempt = false, taxId = null) {
        if (taxExempt) {
            return {
                taxableAmount: 0,
                taxAmount: 0,
                totalAmount: amount,
                breakdown: [],
                isTaxExempt: true
            };
        }

        const taxInfo = this.taxRates[country];
        
        if (!taxInfo || taxInfo.rate === 0) {
            return {
                taxableAmount: amount,
                taxAmount: 0,
                totalAmount: amount,
                breakdown: [],
                isTaxExempt: false,
                note: taxInfo?.note || 'No tax applicable'
            };
        }

        // EU B2B reverse charge (if customer has valid VAT ID)
        if (taxInfo.region === 'EU' && customerType === 'business' && taxId) {
            if (this.validateVATNumber(taxId, country)) {
                return {
                    taxableAmount: amount,
                    taxAmount: 0,
                    totalAmount: amount,
                    breakdown: [{
                        name: 'EU Reverse Charge',
                        rate: 0,
                        amount: 0,
                        note: 'VAT reverse charged to customer'
                    }],
                    isTaxExempt: true,
                    reverseCharge: true
                };
            }
        }

        const taxAmount = amount * (taxInfo.rate / 100);
        
        return {
            taxableAmount: amount,
            taxAmount: parseFloat(taxAmount.toFixed(2)),
            totalAmount: parseFloat((amount + taxAmount).toFixed(2)),
            breakdown: [{
                name: taxInfo.name,
                rate: taxInfo.rate,
                amount: parseFloat(taxAmount.toFixed(2)),
                country,
                region: taxInfo.region
            }],
            isTaxExempt: false,
            note: taxInfo.note
        };
    }

    /**
     * Calculate tax for US (state-specific)
     */
    calculateUSTax(amount, state) {
        const stateTaxRates = {
            'CA': 7.25, 'NY': 4.0, 'TX': 6.25, 'FL': 6.0,
            'IL': 6.25, 'PA': 6.0, 'OH': 5.75, 'WA': 6.5,
            'DE': 0, 'MT': 0, 'NH': 0, 'OR': 0
        };
        
        const rate = stateTaxRates[state] || 0;
        const taxAmount = amount * (rate / 100);
        
        return {
            taxableAmount: amount,
            taxAmount: parseFloat(taxAmount.toFixed(2)),
            totalAmount: parseFloat((amount + taxAmount).toFixed(2)),
            breakdown: [{
                name: 'Sales Tax',
                rate,
                amount: parseFloat(taxAmount.toFixed(2)),
                state,
                note: 'State sales tax only — local taxes may apply'
            }]
        };
    }

    /**
     * Validate EU VAT number
     */
    validateVATNumber(vatNumber, country) {
        // In production, call VIES API
        // https://ec.europa.eu/taxation_customs/vies/vatResponse.html
        const pattern = /^[A-Z]{2}[A-Z0-9]{2,12}$/;
        return pattern.test(vatNumber) && vatNumber.startsWith(country);
    }

    /**
     * Get all supported countries
     */
    getSupportedCountries() {
        return Object.entries(this.taxRates).map(([code, info]) => ({
            code,
            taxName: info.name,
            rate: info.rate,
            region: info.region,
            note: info.note
        }));
    }

    /**
     * Get tax summary for reporting
     */
    getTaxSummary(invoices) {
        const summary = {};
        
        for (const invoice of invoices) {
            const key = invoice.currency;
            if (!summary[key]) {
                summary[key] = { totalNet: 0, totalTax: 0, totalGross: 0, count: 0 };
            }
            summary[key].totalNet += invoice.subtotal;
            summary[key].totalTax += invoice.tax.totalTax;
            summary[key].totalGross += invoice.total;
            summary[key].count++;
        }
        
        return summary;
    }

    /**
     * Digital services tax compliance
     */
    checkDigitalTaxCompliance(salesByCountry) {
        const alerts = [];
        
        for (const [country, amount] of Object.entries(salesByCountry)) {
            const thresholds = this.getThresholds(country);
            
            if (thresholds && amount >= thresholds.threshold) {
                alerts.push({
                    country,
                    currentSales: amount,
                    threshold: thresholds.threshold,
                    action: thresholds.note,
                    severity: 'high'
                });
            }
        }
        
        return alerts;
    }

    getThresholds(country) {
        return this.digitalTaxThresholds[country] || 
               this.digitalTaxThresholds['EU']; // Default to EU for EU countries
    }
}

module.exports = new TaxService();
