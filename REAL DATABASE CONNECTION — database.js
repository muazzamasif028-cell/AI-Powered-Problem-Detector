// ============================================================
// 🤫 REAL DATABASE CONNECTION — MongoDB + Redis
// ============================================================

const mongoose = require('mongoose');
const Redis = require('redis');

class DatabaseManager {
    constructor() {
        this.mongo = null;
        this.redis = null;
        this.connected = false;
    }

    async connect() {
        console.log('🗄️ [DATABASE] Connecting...\n');

        // =============================================
        // MONGODB CONNECTION
        // =============================================
        try {
            this.mongo = await mongoose.connect(
                process.env.MONGODB_URI || 'mongodb://localhost:27017/supreme-platform',
                {
                    maxPoolSize: 50,
                    minPoolSize: 10,
                    serverSelectionTimeoutMS: 5000,
                    socketTimeoutMS: 45000,
                    retryWrites: true,
                    w: 'majority'
                }
            );
            console.log('  ✅ MongoDB Connected — supreme-platform database');
            
            // Create indexes
            await this.createIndexes();
            
        } catch (err) {
            console.error('  ❌ MongoDB Connection Failed:', err.message);
            throw err;
        }

        // =============================================
        // REDIS CONNECTION
        // =============================================
        try {
            this.redis = Redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                socket: {
                    reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
                }
            });

            this.redis.on('error', (err) => console.warn('  ⚠️ Redis Error:', err.message));
            this.redis.on('connect', () => console.log('  ✅ Redis Connected'));
            
            await this.redis.connect();
            
        } catch (err) {
            console.warn('  ⚠️ Redis Connection Failed:', err.message);
        }

        this.connected = true;
        console.log('\n🗄️ [DATABASE] All connections established ✅\n');
        
        return this;
    }

    async createIndexes() {
        const db = mongoose.connection.db;
        
        // Tenants collection
        await db.collection('tenants').createIndex({ tenantId: 1 }, { unique: true });
        await db.collection('tenants').createIndex({ companyName: 1 });
        
        // Problems collection
        await db.collection('problems').createIndex({ problemId: 1 }, { unique: true });
        await db.collection('problems').createIndex({ tenantId: 1, createdAt: -1 });
        await db.collection('problems').createIndex({ category: 1, severity: 1 });
        
        // Transactions collection
        await db.collection('transactions').createIndex({ transactionId: 1 }, { unique: true });
        await db.collection('transactions').createIndex({ tenantId: 1, createdAt: -1 });
        
        // Audit logs
        await db.collection('audit_logs').createIndex({ tenantId: 1, timestamp: -1 });
        await db.collection('audit_logs').createIndex({ action: 1, timestamp: -1 });
        
        // Metrics (Time-series)
        await db.collection('metrics').createIndex({ tenantId: 1, timestamp: -1 });
        await db.collection('metrics').createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
        
        console.log('  ✅ Database indexes created');
    }

    // =============================================
    // SAVE OPERATIONS
    // =============================================
    async saveProblem(tenantId, problem) {
        const db = mongoose.connection.db;
        return db.collection('problems').insertOne({
            ...problem,
            tenantId,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    async saveTransaction(tenantId, transaction) {
        const db = mongoose.connection.db;
        return db.collection('transactions').insertOne({
            ...transaction,
            tenantId,
            createdAt: new Date()
        });
    }

    async saveAuditLog(tenantId, action, details) {
        const db = mongoose.connection.db;
        return db.collection('audit_logs').insertOne({
            tenantId,
            action,
            details,
            timestamp: new Date(),
            ip: details.ip || '0.0.0.0'
        });
    }

    async saveMetric(tenantId, metric) {
        const db = mongoose.connection.db;
        return db.collection('metrics').insertOne({
            tenantId,
            ...metric,
            timestamp: new Date()
        });
    }

    // =============================================
    // QUERY OPERATIONS
    // =============================================
    async getProblems(tenantId, filter = {}) {
        const db = mongoose.connection.db;
        return db.collection('problems')
            .find({ tenantId, ...filter })
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();
    }

    async getTransactions(tenantId, days = 30) {
        const db = mongoose.connection.db;
        const since = new Date(Date.now() - days * 86400000);
        return db.collection('transactions')
            .find({ tenantId, createdAt: { $gte: since } })
            .sort({ createdAt: -1 })
            .toArray();
    }

    // =============================================
    // CACHE OPERATIONS (Redis)
    // =============================================
    async cacheGet(key) {
        if (!this.redis?.isReady) return null;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async cacheSet(key, value, ttl = 3600) {
        if (!this.redis?.isReady) return;
        await this.redis.set(key, JSON.stringify(value), { EX: ttl });
    }

    async cacheDelete(key) {
        if (!this.redis?.isReady) return;
        await this.redis.del(key);
    }

    // =============================================
    // HEALTH CHECK
    // =============================================
    async healthCheck() {
        const health = {
            mongodb: 'DISCONNECTED',
            redis: 'DISCONNECTED'
        };

        try {
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.db.admin().ping();
                health.mongodb = 'CONNECTED';
            }
        } catch (err) {
            health.mongodb = 'ERROR: ' + err.message;
        }

        try {
            if (this.redis?.isReady) {
                await this.redis.ping();
                health.redis = 'CONNECTED';
            }
        } catch (err) {
            health.redis = 'ERROR: ' + err.message;
        }

        return health;
    }

    async disconnect() {
        if (this.mongo) await mongoose.disconnect();
        if (this.redis) await this.redis.quit();
        this.connected = false;
    }
}

module.exports = DatabaseManager;
