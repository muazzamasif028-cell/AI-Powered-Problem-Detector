// ============================================================
// 🤖 services/ai-generator.service.js
// SUPREME AI Domain Generator v11.0
// ============================================================

class AIDomainGenerator {
    constructor() {
        this.prefixes = [
            'get', 'try', 'use', 'go', 'my', 'the', 'pro', 'super',
            'ultra', 'mega', 'hyper', 'quantum', 'cyber', 'digital',
            'smart', 'rapid', 'swift', 'nova', 'prime', 'elite'
        ];
        
        this.suffixes = [
            'hub', 'lab', 'box', 'kit', 'app', 'pro', 'io', 'ly',
            'ify', 'ster', 'ium', 'eon', 'ora', 'ica', 'ova', 'ix'
        ];
        
        this.industryTLDs = {
            technology: ['com', 'io', 'dev', 'tech', 'ai', 'app'],
            healthcare: ['com', 'care', 'health', 'med', 'org'],
            finance: ['com', 'finance', 'bank', 'money', 'capital'],
            education: ['com', 'edu', 'academy', 'school', 'learn'],
            ecommerce: ['com', 'store', 'shop', 'buy', 'market'],
            gaming: ['com', 'gg', 'game', 'play', 'fun'],
            media: ['com', 'tv', 'media', 'video', 'stream'],
            startup: ['io', 'ai', 'co', 'vc', 'ventures']
        };
    }

    /**
     * Suggest alternative domain names
     */
    async suggestAlternatives(originalName, searchResults = []) {
        const suggestions = [];
        const unavailableDomains = searchResults.filter(r => !r.available);
        
        // Generate variations
        const variations = [
            ...this.generateWithPrefixes(originalName),
            ...this.generateWithSuffixes(originalName),
            ...this.generateCompoundNames(originalName),
            ...this.generateModifiedNames(originalName),
            ...this.generateIndustrySpecific(originalName),
            ...this.generateTLDAlternatives(originalName, unavailableDomains)
        ];
        
        // Remove duplicates and limit to 15
        const unique = [...new Set(variations.map(v => v.domain))];
        const limited = unique.slice(0, 15);
        
        // Score each suggestion
        for (const domain of limited) {
            const score = this.calculateBrandScore(domain);
            const seoScore = this.calculateSEOScore(domain, originalName);
            
            suggestions.push({
                domain,
                brandScore: score,
                seoScore,
                available: !searchResults.some(r => r.domain === domain && !r.available),
                category: this.categorizeDomain(domain, originalName)
            });
        }
        
        // Sort by combined score
        suggestions.sort((a, b) => (b.brandScore + b.seoScore) - (a.brandScore + a.seoScore));
        
        return suggestions;
    }

    /**
     * Generate with prefixes
     */
    generateWithPrefixes(name) {
        return this.prefixes.slice(0, 8).map(prefix => ({
            domain: `${prefix}${name}.com`,
            type: 'prefixed'
        }));
    }

    /**
     * Generate with suffixes
     */
    generateWithSuffixes(name) {
        return this.suffixes.slice(0, 8).map(suffix => ({
            domain: `${name}${suffix}.com`,
            type: 'suffixed'
        }));
    }

    /**
     * Generate compound names
     */
    generateCompoundNames(name) {
        const words = ['cloud', 'app', 'lab', 'hub', 'studio', 'works'];
        return words.map(word => ({
            domain: `${name}${word}.com`,
            type: 'compound'
        }));
    }

    /**
     * Generate modified names
     */
    generateModifiedNames(name) {
        const modifications = [];
        
        // Remove vowels
        const noVowels = name.replace(/[aeiou]/gi, '');
        if (noVowels.length > 2) {
            modifications.push({ domain: `${noVowels}.io`, type: 'modified' });
        }
        
        // Add 'ly'
        if (!name.endsWith('ly')) {
            modifications.push({ domain: `${name}ly.io`, type: 'modified' });
        }
        
        // Short form
        if (name.length > 6) {
            modifications.push({ domain: `${name.substring(0, 5)}.io`, type: 'abbreviated' });
        }
        
        return modifications;
    }

    /**
     * Generate industry-specific suggestions
     */
    generateIndustrySpecific(name) {
        const suggestions = [];
        const industries = Object.entries(this.industryTLDs);
        
        for (const [industry, tlds] of industries) {
            tlds.slice(0, 2).forEach(tld => {
                suggestions.push({
                    domain: `${name}.${tld}`,
                    type: 'industry',
                    industry
                });
            });
        }
        
        return suggestions;
    }

    /**
     * Generate TLD alternatives for unavailable domains
     */
    generateTLDAlternatives(name, unavailableDomains) {
        const takenTLDs = unavailableDomains.map(d => d.tld);
        const allTLDs = ['com', 'net', 'org', 'io', 'ai', 'cloud', 'app', 'dev', 'co', 'me'];
        const availableTLDs = allTLDs.filter(tld => !takenTLDs.includes(tld));
        
        return availableTLDs.map(tld => ({
            domain: `${name}.${tld}`,
            type: 'tld_alternative'
        }));
    }

    /**
     * Calculate brand score (0-100)
     */
    calculateBrandScore(domain) {
        let score = 50; // Base score
        
        // Shorter domains are better
        const name = domain.split('.')[0];
        if (name.length <= 6) score += 20;
        else if (name.length <= 10) score += 10;
        else if (name.length > 15) score -= 15;
        
        // .com is premium
        if (domain.endsWith('.com')) score += 15;
        else if (domain.endsWith('.io') || domain.endsWith('.ai')) score += 5;
        
        // Easy to pronounce
        const vowels = (name.match(/[aeiou]/gi) || []).length;
        const consonants = name.length - vowels;
        if (consonants > 0 && vowels / consonants >= 0.5) score += 10;
        
        // No hyphens or numbers
        if (!/[-\d]/.test(domain)) score += 10;
        else score -= 20;
        
        return Math.min(100, Math.max(0, score));
    }

    /**
     * Calculate SEO score (0-100)
     */
    calculateSEOScore(domain, originalKeyword) {
        let score = 40;
        
        const name = domain.split('.')[0];
        
        // Contains keyword
        if (name.includes(originalKeyword.toLowerCase())) score += 25;
        
        // Short URL
        if (domain.length < 15) score += 15;
        
        // .com preferred for SEO
        if (domain.endsWith('.com')) score += 10;
        
        // No special characters
        if (!/[^a-zA-Z0-9.]/.test(domain)) score += 10;
        
        return Math.min(100, Math.max(0, score));
    }

    /**
     * Categorize domain
     */
    categorizeDomain(domain, originalName) {
        if (domain.includes(originalName)) return 'exact_match';
        if (domain.startsWith('get') || domain.startsWith('try')) return 'action_verb';
        if (domain.endsWith('.io') || domain.endsWith('.ai')) return 'tech_startup';
        if (domain.endsWith('.com')) return 'professional';
        if (domain.endsWith('.app') || domain.endsWith('.dev')) return 'developer';
        return 'alternative';
    }

    /**
     * Generate domain from business description
     */
    async generateFromDescription(description) {
        // Extract keywords
        const keywords = description
            .toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2);
        
        const suggestions = [];
        const uniqueKeywords = [...new Set(keywords)].slice(0, 5);
        
        // Generate combinations
        for (let i = 0; i < uniqueKeywords.length; i++) {
            for (let j = i + 1; j < uniqueKeywords.length; j++) {
                const combined = uniqueKeywords[i] + uniqueKeywords[j];
                if (combined.length <= 20) {
                    suggestions.push({
                        domain: `${combined}.com`,
                        type: 'ai_generated',
                        keywords: [uniqueKeywords[i], uniqueKeywords[j]]
                    });
                }
            }
        }
        
        // Single keyword + TLD
        uniqueKeywords.forEach(keyword => {
            ['com', 'io', 'ai', 'app'].forEach(tld => {
                suggestions.push({
                    domain: `${keyword}.${tld}`,
                    type: 'ai_generated',
                    keywords: [keyword]
                });
            });
        });
        
        return suggestions.slice(0, 10);
    }
}

module.exports = new AIDomainGenerator();
