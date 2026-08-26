// ============================================================
// 📋 config/constants.js
// SUPREME Platform Constants v11.0
// ============================================================

const CONSTANTS = {
    // Platform Info
    PLATFORM_NAME: 'SUPREME Planetary OS',
    VERSION: '11.0.0',
    
    // Agent Configuration
    AGENTS: {
        TOTAL: 280,
        ACTIVE: 280,
        TYPES: ['neuro-symbolic', 'shield', 'telemetry', 'predictive', 'adaptive', 'chaos']
    },
    
    // LLM Models
    LLM_MODELS: ['GPT-4', 'Claude-3', 'Gemini', 'DeepSeek', 'Qwen'],
    
    // Detection Engine
    DETECTORS: {
        TOTAL: 56,
        CATEGORIES: ['security', 'performance', 'anomaly', 'compliance', 'network']
    },
    
    // Hardware Support
    HARDWARE: {
        CHIPS_SUPPORTED: 2500,
        MANUFACTURERS: ['Intel', 'AMD', 'ARM', 'NVIDIA', 'Qualcomm', 'Apple']
    },
    
    // Satellite Fleet
    SATELLITES: {
        TOTAL: 350,
        ORBITS: ['LEO', 'MEO', 'GEO'],
        DISTRIBUTION_CHANNELS: 350
    },
    
    // Languages
    LANGUAGES: {
        SUPPORTED: 7128,
        CATEGORIES: ['programming', 'markup', 'query', 'schema', 'configuration']
    },
    
    // Smart Cities
    SMART_CITIES: {
        PROTOCOLS: ['NEOM', 'Singapore', 'Dubai', 'Tokyo', 'London'],
        STANDARDS: ['ISO 37122', 'ISO 37120', 'BIS']
    },
    
    // Rate Limits (requests per window)
    RATE_LIMITS: {
        AUTH: { max: 10, windowMs: 15 * 60 * 1000 },
        API: { max: 100, windowMs: 60 * 1000 },
        LLM: { max: 30, windowMs: 60 * 1000 },
        PAYMENT: { max: 5, windowMs: 60 * 1000 },
        TELEMETRY: { max: 1000, windowMs: 60 * 1000 }
    },
    
    // User Roles
    ROLES: {
        ADMIN: 'admin',
        OPERATOR: 'operator',
        ANALYST: 'analyst',
        CUSTOMER: 'customer',
        USER: 'user',
        GUEST: 'guest'
    },
    
    // Subscription Tiers
    TIERS: {
        FREE: 'free',
        PRO: 'pro',
        BUSINESS: 'business',
        ENTERPRISE: 'enterprise'
    }
};

module.exports = CONSTANTS;
