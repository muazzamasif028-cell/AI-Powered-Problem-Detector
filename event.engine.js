// ============================================================
// 🔮 kernel/engines/event.engine.js
// SUPREME Event Engine — Universal Event Bus & Pub/Sub
// ============================================================
const EventEmitter = require('events');
const crypto = require('crypto');

class EventEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            maxListeners: config.MAX_LISTENERS || 1000,
            persistentEvents: config.PERSISTENT_EVENTS || true,
            deadLetterQueue: config.DEAD_LETTER_QUEUE || true,
            retryAttempts: config.RETRY_ATTEMPTS || 3,
            ...config
        };
        
        this.setMaxListeners(this.config.maxListeners);
        
        this.subscriptions = new Map();
        this.eventStore = new Map();
        this.deadLetters = [];
        this.eventCount = 0;
        this.handlers = new Map();
        
        this.registerSystemEvents();
    }

    /**
     * Register system-level events
     */
    registerSystemEvents() {
        const systemEvents = [
            'kernel:started',
            'kernel:stopped',
            'kernel:error',
            'module:loaded',
            'module:unloaded',
            'module:error',
            'user:created',
            'user:authenticated',
            'user:deleted',
            'session:created',
            'session:expired',
            'billing:charge',
            'billing:refund',
            'billing:subscription_changed',
            'deployment:started',
            'deployment:completed',
            'deployment:failed',
            'domain:registered',
            'domain:expired',
            'ssl:issued',
            'ssl:expiring',
            'ai:request',
            'ai:response',
            'ai:error',
            'storage:uploaded',
            'storage:deleted',
            'database:backup',
            'database:restore',
            'security:alert',
            'security:breach_detected',
            'rate_limit:exceeded',
            'webhook:triggered',
            'webhook:failed'
        ];
        
        systemEvents.forEach(event => {
            this.handlers.set(event, []);
        });
    }

    /**
     * Publish event
     */
    async publish(eventName, data = {}, options = {}) {
        const event = {
            id: crypto.randomUUID(),
            name: eventName,
            data,
            metadata: {
                timestamp: new Date().toISOString(),
                source: options.source || 'kernel',
                correlationId: options.correlationId || crypto.randomUUID(),
                userId: options.userId,
                tenantId: options.tenantId,
                priority: options.priority || 'normal'
            },
            attempts: 0
        };
        
        this.eventCount++;
        
        // Store event if persistent
        if (this.config.persistentEvents) {
            this.eventStore.set(event.id, event);
        }
        
        // Emit to listeners
        this.emit(eventName, event);
        
        // Process subscriptions
        const subscribers = this.subscriptions.get(eventName) || [];
        
        for (const subscriber of subscribers) {
            try {
                await this.deliverToSubscriber(subscriber, event);
            } catch (error) {
                await this.handleDeliveryFailure(event, subscriber, error);
            }
        }
        
        // Wildcard subscribers
        const wildcardSubscribers = this.subscriptions.get('*') || [];
        for (const subscriber of wildcardSubscribers) {
            try {
                await this.deliverToSubscriber(subscriber, event);
            } catch (error) {
                // Wildcard failures are logged but not retried
                console.error(`Wildcard delivery failed: ${error.message}`);
            }
        }
        
        return event.id;
    }

    /**
     * Subscribe to event(s)
     */
    subscribe(eventNames, handler, options = {}) {
        const subscription = {
            id: crypto.randomUUID(),
            handler,
            options: {
                retry: options.retry !== false,
                maxRetries: options.maxRetries || 3,
                timeout: options.timeout || 30000,
                filter: options.filter || null,
                ...options
            },
            createdAt: new Date()
        };
        
        const names = Array.isArray(eventNames) ? eventNames : [eventNames];
        
        names.forEach(name => {
            if (!this.subscriptions.has(name)) {
                this.subscriptions.set(name, []);
            }
            this.subscriptions.get(name).push(subscription);
        });
        
        this.emit('subscription:created', { subscription, events: names });
        
        return subscription.id;
    }

    /**
     * Unsubscribe
     */
    unsubscribe(subscriptionId) {
        for (const [eventName, subscribers] of this.subscriptions) {
            const index = subscribers.findIndex(s => s.id === subscriptionId);
            if (index > -1) {
                subscribers.splice(index, 1);
                
                if (subscribers.length === 0) {
                    this.subscriptions.delete(eventName);
                }
                
                this.emit('subscription:removed', { subscriptionId, eventName });
                return true;
            }
        }
        
        return false;
    }

    /**
     * Deliver event to subscriber
     */
    async deliverToSubscriber(subscriber, event) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Subscriber timeout'));
            }, subscriber.options.timeout);
            
            try {
                const result = subscriber.handler(event);
                
                if (result instanceof Promise) {
                    result.then(() => {
                        clearTimeout(timeout);
                        resolve();
                    }).catch(reject);
                } else {
                    clearTimeout(timeout);
                    resolve();
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    /**
     * Handle delivery failure
     */
    async handleDeliveryFailure(event, subscriber, error) {
        event.attempts++;
        
        if (event.attempts <= subscriber.options.maxRetries) {
            // Retry with exponential backoff
            const delay = Math.pow(2, event.attempts) * 1000;
            
            setTimeout(async () => {
                try {
                    await this.deliverToSubscriber(subscriber, event);
                } catch (retryError) {
                    await this.handleDeliveryFailure(event, subscriber, retryError);
                }
            }, delay);
        } else {
            // Move to dead letter queue
            if (this.config.deadLetterQueue) {
                this.deadLetters.push({
                    event,
                    subscriber: subscriber.id,
                    error: error.message,
                    failedAt: new Date().toISOString()
                });
            }
            
            this.emit('event:dead_letter', { event, subscriber, error });
        }
    }

    /**
     * Create event stream (for real-time subscriptions)
     */
    createStream(eventNames, options = {}) {
        const streamId = crypto.randomUUID();
        const events = [];
        
        const subscription = this.subscribe(eventNames, (event) => {
            events.push(event);
            
            if (options.maxEvents && events.length > options.maxEvents) {
                events.shift();
            }
        });
        
        return {
            id: streamId,
            getEvents: () => [...events],
            clear: () => events.length = 0,
            unsubscribe: () => this.unsubscribe(subscription)
        };
    }

    /**
     * Replay events
     */
    replay(eventName, fromTimestamp, toTimestamp) {
        const replayed = [];
        
        for (const [id, event] of this.eventStore) {
            if (event.name === eventName) {
                const eventTime = new Date(event.metadata.timestamp).getTime();
                
                if ((!fromTimestamp || eventTime >= fromTimestamp) &&
                    (!toTimestamp || eventTime <= toTimestamp)) {
                    replayed.push(event);
                }
            }
        }
        
        return replayed;
    }

    /**
     * Get event statistics
     */
    getStats() {
        return {
            totalEvents: this.eventCount,
            activeSubscriptions: Array.from(this.subscriptions.values())
                .reduce((sum, subs) => sum + subs.length, 0),
            uniqueEventTypes: this.subscriptions.size,
            deadLetters: this.deadLetters.length,
            storedEvents: this.eventStore.size
        };
    }

    /**
     * Clear dead letter queue
     */
    clearDeadLetters() {
        const count = this.deadLetters.length;
        this.deadLetters = [];
        return { cleared: count };
    }
}

// Singleton
const eventEngine = new EventEngine();

module.exports = eventEngine;
