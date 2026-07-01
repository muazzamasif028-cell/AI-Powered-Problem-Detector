// ============================================================
// ⚙️ counter.js
// SUPREME Counter Engine — State Management & Business Logic
// ============================================================

class Counter {
    constructor(initialValue = 0, options = {}) {
        // Core state
        this.value = initialValue;
        this.initialValue = initialValue;
        this.step = options.step || 1;
        this.minValue = options.min ?? -Infinity;
        this.maxValue = options.max ?? Infinity;
        
        // Statistics
        this.stats = {
            totalIncrements: 0,
            totalDecrements: 0,
            totalResets: 0,
            lastModified: null,
            peak: initialValue,
            lowest: initialValue
        };
        
        // History (last 50 actions)
        this.history = [];
        this.maxHistory = 50;
        
        // Event listeners
        this.listeners = new Map();
        
        // Persistence key
        this.storageKey = options.storageKey || 'supreme-counter-state';
        
        // Load from storage if available
        if (options.persist) {
            this.load();
        }
        
        console.log('⚡ Counter initialized:', {
            value: this.value,
            step: this.step,
            min: this.minValue,
            max: this.maxValue
        });
    }

    // =============================================
    // 📈 CORE OPERATIONS
    // =============================================

    /**
     * Increment counter
     */
    increment(stepValue = null) {
        const incrementBy = stepValue ?? this.step;
        const newValue = this.value + incrementBy;
        
        // Check max limit
        if (newValue > this.maxValue) {
            this.emit('limitReached', { type: 'max', current: this.value, max: this.maxValue });
            return this.value;
        }
        
        this.value = newValue;
        this.stats.totalIncrements++;
        this.stats.lastModified = new Date();
        
        // Update peak
        if (this.value > this.stats.peak) {
            this.stats.peak = this.value;
        }
        
        this.addToHistory('increment', incrementBy);
        this.save();
        this.emit('change', { value: this.value, action: 'increment', amount: incrementBy });
        
        return this.value;
    }

    /**
     * Decrement counter
     */
    decrement(stepValue = null) {
        const decrementBy = stepValue ?? this.step;
        const newValue = this.value - decrementBy;
        
        // Check min limit
        if (newValue < this.minValue) {
            this.emit('limitReached', { type: 'min', current: this.value, min: this.minValue });
            return this.value;
        }
        
        this.value = newValue;
        this.stats.totalDecrements++;
        this.stats.lastModified = new Date();
        
        // Update lowest
        if (this.value < this.stats.lowest) {
            this.stats.lowest = this.value;
        }
        
        this.addToHistory('decrement', decrementBy);
        this.save();
        this.emit('change', { value: this.value, action: 'decrement', amount: decrementBy });
        
        return this.value;
    }

    /**
     * Reset counter to initial value
     */
    reset() {
        const oldValue = this.value;
        this.value = this.initialValue;
        this.stats.totalResets++;
        this.stats.lastModified = new Date();
        
        this.addToHistory('reset', oldValue - this.initialValue);
        this.save();
        this.emit('change', { value: this.value, action: 'reset', previousValue: oldValue });
        
        return this.value;
    }

    /**
     * Set counter to specific value
     */
    setValue(newValue) {
        const clampedValue = Math.max(this.minValue, Math.min(this.maxValue, newValue));
        const oldValue = this.value;
        
        this.value = clampedValue;
        this.stats.lastModified = new Date();
        
        if (clampedValue > this.stats.peak) this.stats.peak = clampedValue;
        if (clampedValue < this.stats.lowest) this.stats.lowest = clampedValue;
        
        this.addToHistory('set', clampedValue - oldValue);
        this.save();
        this.emit('change', { value: this.value, action: 'set', previousValue: oldValue });
        
        return this.value;
    }

    /**
     * Double the counter value
     */
    double() {
        return this.setValue(this.value * 2);
    }

    /**
     * Half the counter value
     */
    half() {
        return this.setValue(Math.floor(this.value / 2));
    }

    // =============================================
    // ⚙️ CONFIGURATION
    // =============================================

    /**
     * Update step value
     */
    setStep(newStep) {
        if (newStep <= 0) {
            throw new Error('Step must be greater than 0');
        }
        this.step = newStep;
        this.emit('configChange', { step: this.step });
        return this.step;
    }

    /**
     * Set limits
     */
    setLimits(min, max) {
        this.minValue = min ?? this.minValue;
        this.maxValue = max ?? this.maxValue;
        
        // Clamp current value to new limits
        this.value = Math.max(this.minValue, Math.min(this.maxValue, this.value));
        
        this.emit('configChange', { min: this.minValue, max: this.maxValue });
        return { min: this.minValue, max: this.maxValue };
    }

    // =============================================
    // 📊 GETTERS
    // =============================================

    /**
     * Get current value
     */
    getValue() {
        return this.value;
    }

    /**
     * Get all stats
     */
    getStats() {
        return {
            ...this.stats,
            currentValue: this.value,
            step: this.step,
            isPositive: this.value > 0,
            isNegative: this.value < 0,
            isZero: this.value === 0,
            totalOperations: this.stats.totalIncrements + this.stats.totalDecrements + this.stats.totalResets
        };
    }

    /**
     * Get history
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit).reverse();
    }

    /**
     * Get state summary
     */
    getState() {
        return {
            value: this.value,
            initialValue: this.initialValue,
            step: this.step,
            minValue: this.minValue,
            maxValue: this.maxValue,
            stats: this.stats,
            history: this.getHistory(5)
        };
    }

    // =============================================
    // 💾 PERSISTENCE
    // =============================================

    /**
     * Save state to localStorage
     */
    save() {
        try {
            const state = {
                value: this.value,
                initialValue: this.initialValue,
                step: this.step,
                stats: this.stats,
                history: this.history.slice(-20)
            };
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save counter state:', error.message);
        }
    }

    /**
     * Load state from localStorage
     */
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const state = JSON.parse(saved);
                this.value = state.value ?? this.value;
                this.initialValue = state.initialValue ?? this.initialValue;
                this.step = state.step ?? this.step;
                this.stats = { ...this.stats, ...state.stats };
                this.history = state.history || [];
                console.log('💾 Counter state loaded from storage');
                return true;
            }
        } catch (error) {
            console.warn('Failed to load counter state:', error.message);
        }
        return false;
    }

    /**
     * Clear saved state
     */
    clearStorage() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    // =============================================
    // 📝 HISTORY
    // =============================================

    /**
     * Add action to history
     */
    addToHistory(action, amount) {
        this.history.push({
            action,
            amount,
            value: this.value,
            timestamp: new Date().toISOString()
        });
        
        // Trim history
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }

    // =============================================
    // 🔔 EVENT SYSTEM
    // =============================================

    /**
     * Listen to events
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        
        // Return unsubscribe function
        return () => {
            const listeners = this.listeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) listeners.splice(index, 1);
        };
    }

    /**
     * Emit event
     */
    emit(event, data) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    // =============================================
    // 🗑️ DESTROY
    // =============================================

    /**
     * Clean up
     */
    destroy() {
        this.listeners.clear();
        this.history = [];
        console.log('🗑️ Counter destroyed');
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Counter;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.Counter = Counter;
}
