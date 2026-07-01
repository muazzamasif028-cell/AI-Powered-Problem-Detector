// ============================================================
// 🎚️ src/services/deployment/feature-flag.service.js
// Feature Flags — Enable/disable features per user/group
// ============================================================
const FeatureFlag = require('../../models/FeatureFlag');

class FeatureFlagService {
    constructor() {
        this.flags = new Map();
        this.loadFlags();
    }

    /**
     * Load all flags from database
     */
    async loadFlags() {
        const flags = await FeatureFlag.find({ active: true });
        
        for (const flag of flags) {
            this.flags.set(flag.name, flag);
        }
        
        console.log(`🎚️ ${flags.length} feature flags loaded`);
    }

    /**
     * Check if feature is enabled
     */
    isEnabled(featureName, userId = null, userPlan = null) {
        const flag = this.flags.get(featureName);
        
        if (!flag) return false;
        
        // Check if globally enabled
        if (!flag.enabled) return false;
        
        // Check user-specific override
        if (userId && flag.userOverrides?.includes(userId.toString())) return true;
        
        // Check user exclusion
        if (userId && flag.userExclusions?.includes(userId.toString())) return false;
        
        // Check plan restriction
        if (userPlan && flag.allowedPlans?.length > 0) {
            return flag.allowedPlans.includes(userPlan);
        }
        
        // Check rollout percentage
        if (flag.rolloutPercent < 100 && userId) {
            const hash = this.hashUser(userId.toString());
            return (hash % 100) < flag.rolloutPercent;
        }
        
        return flag.enabled;
    }

    /**
     * Create/update feature flag
     */
    async setFlag(name, config) {
        let flag = await FeatureFlag.findOne({ name });
        
        if (flag) {
            Object.assign(flag, config);
        } else {
            flag = new FeatureFlag({ name, ...config });
        }
        
        await flag.save();
        this.flags.set(name, flag);
        
        return flag;
    }

    /**
     * Enable feature for user
     */
    async enableForUser(featureName, userId) {
        const flag = await FeatureFlag.findOne({ name: featureName });
        
        if (!flag) throw new Error(`Feature flag not found: ${featureName}`);
        
        if (!flag.userOverrides.includes(userId)) {
            flag.userOverrides.push(userId);
            await flag.save();
            this.flags.set(featureName, flag);
        }
        
        return flag;
    }

    /**
     * Disable feature for user
     */
    async disableForUser(featureName, userId) {
        const flag = await FeatureFlag.findOne({ name: featureName });
        
        if (!flag) throw new Error(`Feature flag not found: ${featureName}`);
        
        flag.userExclusions.push(userId);
        flag.userOverrides = flag.userOverrides.filter(id => id !== userId);
        await flag.save();
        this.flags.set(featureName, flag);
        
        return flag;
    }

    /**
     * Set rollout percentage
     */
    async setRollout(featureName, percent) {
        return this.setFlag(featureName, { rolloutPercent: percent });
    }

    /**
     * Get all flags
     */
    getAllFlags() {
        return Array.from(this.flags.values()).map(flag => ({
            name: flag.name,
            enabled: flag.enabled,
            rolloutPercent: flag.rolloutPercent,
            allowedPlans: flag.allowedPlans,
            description: flag.description,
            createdAt: flag.createdAt
        }));
    }

    /**
     * Hash user ID for consistent rollout
     */
    hashUser(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

module.exports = new FeatureFlagService();
