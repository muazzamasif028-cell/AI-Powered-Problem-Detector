// ============================================================
// 🌐 src/routes/domain.js
// ============================================================
const express = require('express');
const Domain = require('../models/Domain');
const User = require('../models/User');
const auth = require('../middleware/auth');
const domainService = require('../services/domain');

const router = express.Router();

// All routes require auth
router.use(auth);

// =============================================
// 🔍 SEARCH DOMAIN
// =============================================
router.post('/search', async (req, res) => {
    try {
        const { domain } = req.body;
        
        if (!domain) {
            return res.status(400).json({ error: 'Domain name required' });
        }

        // Clean domain name
        const cleanDomain = domain.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // Check common TLDs
        const tlds = ['com', 'net', 'org', 'io', 'ai', 'co', 'app', 'dev'];
        const results = [];

        for (const tld of tlds) {
            // Check if already registered in our system
            const existing = await Domain.findOne({ 
                domainName: cleanDomain, 
                tld 
            });

            results.push({
                domain: `${cleanDomain}.${tld}`,
                tld,
                available: !existing,
                price: getPrice(tld),
                currency: 'USD'
            });
        }

        // AI suggestions
        const suggestions = generateSuggestions(cleanDomain, results);

        res.json({
            success: true,
            searchTerm: cleanDomain,
            results,
            suggestions,
            availableCount: results.filter(r => r.available).length
        });

    } catch (error) {
        console.error('Domain search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// =============================================
// 🛒 REGISTER DOMAIN
// =============================================
router.post('/register', async (req, res) => {
    try {
        const { domainName, tld, years = 1, autoRenew = true } = req.body;

        if (!domainName || !tld) {
            return res.status(400).json({ error: 'Domain name and TLD required' });
        }

        // Check if already taken
        const existing = await Domain.findOne({ 
            domainName: domainName.toLowerCase(), 
            tld: tld.toLowerCase() 
        });

        if (existing) {
            return res.status(409).json({ error: 'Domain already registered' });
        }

        // Get price
        const price = getPrice(tld) * years;

        // Create domain
        const domain = await Domain.create({
            userId: req.userId,
            domainName: domainName.toLowerCase(),
            tld: tld.toLowerCase(),
            price,
            years,
            autoRenew,
            status: 'active',
            expiryDate: new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000),
            nameservers: [
                'ns1.supreme-os.com',
                'ns2.supreme-os.com'
            ]
        });

        // Add to user's domains
        await User.findByIdAndUpdate(req.userId, {
            $push: { domains: domain._id }
        });

        // In production: Call real registrar API here
        // await namecheapAPI.register(domainName, tld);
        // await cloudflareAPI.addDomain(domainName, tld);

        // Auto-deploy basic website
        domain.websiteUrl = `https://${domainName}.${tld}`;
        domain.websiteDeployed = true;
        await domain.save();

        res.status(201).json({
            success: true,
            domain: {
                id: domain._id,
                domain: domain.fullDomain,
                status: domain.status,
                expiryDate: domain.expiryDate,
                price,
                websiteUrl: domain.websiteUrl,
                nameservers: domain.nameservers
            },
            message: `🎉 ${domain.fullDomain} registered successfully!`
        });

    } catch (error) {
        console.error('Domain registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// =============================================
// 📋 LIST MY DOMAINS
// =============================================
router.get('/list', async (req, res) => {
    try {
        const domains = await Domain.find({ userId: req.userId })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            total: domains.length,
            domains: domains.map(d => ({
                id: d._id,
                domain: d.fullDomain,
                status: d.status,
                expiryDate: d.expiryDate,
                autoRenew: d.autoRenew,
                websiteDeployed: d.websiteDeployed,
                websiteUrl: d.websiteUrl,
                ssl: d.ssl,
                createdAt: d.createdAt
            }))
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch domains' });
    }
});

// =============================================
// 🔍 GET DOMAIN DETAILS
// =============================================
router.get('/:id', async (req, res) => {
    try {
        const domain = await Domain.findOne({ 
            _id: req.params.id, 
            userId: req.userId 
        });

        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }

        res.json({
            success: true,
            domain
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch domain' });
    }
});

// =============================================
// 🗑️ DELETE DOMAIN
// =============================================
router.delete('/:id', async (req, res) => {
    try {
        const domain = await Domain.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });

        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }

        await User.findByIdAndUpdate(req.userId, {
            $pull: { domains: domain._id }
        });

        res.json({
            success: true,
            message: 'Domain deleted successfully'
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to delete domain' });
    }
});

// =============================================
// 💰 HELPER: Get domain price
// =============================================
function getPrice(tld) {
    const prices = {
        'com': 12.99,
        'net': 14.99,
        'org': 13.99,
        'io': 45.00,
        'ai': 79.00,
        'co': 25.00,
        'app': 18.00,
        'dev': 15.00
    };
    return prices[tld] || 14.99;
}

// =============================================
// 🤖 HELPER: Generate AI suggestions
// =============================================
function generateSuggestions(domain, results) {
    const unavailable = results.filter(r => !r.available);
    const suggestions = [];
    
    const prefixes = ['get', 'try', 'my', 'the', 'go', 'use'];
    const suffixes = ['app', 'hq', 'lab', 'hub', 'pro', 'io'];

    // Prefix variations
    prefixes.forEach(prefix => {
        suggestions.push({
            domain: `${prefix}${domain}.com`,
            type: 'prefix',
            score: 85
        });
    });

    // Suffix variations
    suffixes.forEach(suffix => {
        suggestions.push({
            domain: `${domain}${suffix}.com`,
            type: 'suffix',
            score: 80
        });
    });

    // TLD alternatives for unavailable domains
    const alternativeTLDs = ['io', 'co', 'app', 'dev', 'xyz', 'online'];
    unavailable.forEach(result => {
        alternativeTLDs.forEach(altTLD => {
            if (altTLD !== result.tld) {
                suggestions.push({
                    domain: `${domain}.${altTLD}`,
                    type: 'tld_alternative',
                    score: 70
                });
            }
        });
    });

    // Deduplicate and sort by score
    const unique = [...new Map(suggestions.map(s => [s.domain, s])).values()];
    return unique.sort((a, b) => b.score - a.score).slice(0, 10);
}

module.exports = router;
