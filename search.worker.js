// ============================================================
// 🔍 workers/search.worker.js
// SUPREME Search Index Worker v11.0
// Handles: Full-text search, indexing, ranking, filtering
// ============================================================
const { parentPort, workerData } = require('worker_threads');

// =============================================
// 📊 SIMPLE LOGGER
// =============================================
const log = (message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[SEARCH-WORKER] ${timestamp} | ${message}`, 
        Object.keys(data).length ? JSON.stringify(data).substring(0, 200) : '');
};

// =============================================
// 🔍 SEARCH ENGINE
// =============================================
class SearchWorker {
    constructor() {
        this.status = 'INITIALIZING';
        this.index = new Map();
        this.totalDocuments = 0;
        this.totalSearches = 0;
        this.startTime = Date.now();
        this.cache = new Map();
        this.cacheMaxSize = 1000;
        
        log('Search worker initializing...');
    }

    /**
     * Initialize search index
     */
    async initialize() {
        try {
            log('Building search index...');
            
            // Load sample data (production: load from database)
            await this.buildInitialIndex();
            
            this.status = 'READY';
            log(`✅ Search worker ready — ${this.totalDocuments} documents indexed`);
            
            parentPort.postMessage({
                type: 'worker:ready',
                workerId: workerData?.workerId || 'search-1',
                documents: this.totalDocuments,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.status = 'ERROR';
            log(`Initialization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build initial search index
     */
    async buildInitialIndex() {
        const sampleDocs = [
            { id: 'doc-1', title: 'SUPREME OS Installation Guide', content: 'How to install SUPREME Planetary OS on your system...', category: 'documentation', tags: ['install', 'setup', 'guide'] },
            { id: 'doc-2', title: 'AI Agent Configuration', content: 'Configure 280+ autonomous AI agents for your enterprise...', category: 'ai', tags: ['agent', 'ai', 'config'] },
            { id: 'doc-3', title: 'Cloud Deployment', content: 'Deploy SUPREME OS on AWS, Azure, GCP, or on-premise...', category: 'cloud', tags: ['deploy', 'cloud', 'aws'] },
            { id: 'doc-4', title: 'API Reference v2', content: 'Complete API reference for SUPREME OS v2 endpoints...', category: 'api', tags: ['api', 'reference', 'v2'] },
            { id: 'doc-5', title: 'Security Best Practices', content: 'Enterprise security configuration and best practices...', category: 'security', tags: ['security', 'enterprise', 'config'] },
            { id: 'doc-6', title: 'Telemetry Monitoring', content: 'Set up real-time telemetry monitoring and alerts...', category: 'monitoring', tags: ['telemetry', 'monitor', 'alerts'] },
            { id: 'doc-7', title: 'LLM Integration', content: 'Integrate GPT, Claude, Gemini, DeepSeek, Qwen models...', category: 'ai', tags: ['llm', 'integration', 'models'] },
            { id: 'doc-8', title: 'Satellite Fleet Management', content: 'Manage 350+ satellite distribution channels...', category: 'satellite', tags: ['satellite', 'fleet', 'manage'] },
        ];
        
        sampleDocs.forEach(doc => this.addToIndex(doc));
    }

    /**
     * Add document to index
     */
    addToIndex(document) {
        const tokens = this.tokenize(document.title + ' ' + document.content + ' ' + (document.tags || []).join(' '));
        
        tokens.forEach(token => {
            if (!this.index.has(token)) {
                this.index.set(token, new Set());
            }
            this.index.get(token).add(document.id);
        });
        
        // Store document
        this.index.set(`_doc:${document.id}`, document);
        this.totalDocuments++;
    }

    /**
     * Tokenize text
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .split(/\s+/)
            .filter(token => token.length > 1)
            .filter(token => !this.getStopWords().includes(token));
    }

    /**
     * Get stop words
     */
    getStopWords() {
        return ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'this', 'that'];
    }

    /**
     * Perform search
     */
    async search(data) {
        const { 
            query, 
            category, 
            tags, 
            limit = 10, 
            offset = 0,
            sortBy = 'relevance',
            fuzzySearch = false
        } = data;
        
        log(`Search: query="${query}", category=${category}, limit=${limit}`);
        
        const startTime = Date.now();
        this.totalSearches++;
        
        // Check cache
        const cacheKey = JSON.stringify({ query, category, tags, limit, offset });
        if (this.cache.has(cacheKey)) {
            log('Cache hit!');
            return this.cache.get(cacheKey);
        }
        
        // Tokenize query
        const queryTokens = this.tokenize(query || '');
        
        // Find matching documents
        const matchedDocs = new Map();
        
        queryTokens.forEach(token => {
            if (this.index.has(token)) {
                const docIds = this.index.get(token);
                docIds.forEach(docId => {
                    matchedDocs.set(docId, (matchedDocs.get(docId) || 0) + 1);
                });
            }
        });
        
        // Fuzzy search (if enabled)
        if (fuzzySearch && matchedDocs.size === 0) {
            return this.fuzzySearch(query, category, tags);
        }
        
        // Get full documents and score
        let results = Array.from(matchedDocs.entries())
            .map(([docId, score]) => {
                const doc = this.index.get(`_doc:${docId}`);
                return { ...doc, relevanceScore: score };
            });
        
        // Apply filters
        if (category) {
            results = results.filter(doc => doc.category === category);
        }
        if (tags && tags.length > 0) {
            results = results.filter(doc => 
                doc.tags && tags.some(tag => doc.tags.includes(tag))
            );
        }
        
        // Sort
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        // Paginate
        const total = results.length;
        results = results.slice(offset, offset + limit);
        
        const response = {
            success: true,
            query,
            results,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            },
            latency: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };
        
        // Cache results
        if (this.cache.size >= this.cacheMaxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, response);
        
        return response;
    }

    /**
     * Fuzzy search fallback
     */
    fuzzySearch(query, category, tags) {
        const allDocs = [];
        this.index.forEach((value, key) => {
            if (key.startsWith('_doc:')) {
                allDocs.push(value);
            }
        });
        
        let results = allDocs.filter(doc => 
            doc.title.toLowerCase().includes(query?.toLowerCase() || '') ||
            doc.content.toLowerCase().includes(query?.toLowerCase() || '')
        );
        
        if (category) results = results.filter(doc => doc.category === category);
        
        return {
            success: true,
            query,
            fuzzySearch: true,
            results: results.slice(0, 10),
            pagination: { total: results.length, limit: 10, offset: 0 },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get worker statistics
     */
    getStats() {
        return {
            status: this.status,
            totalDocuments: this.totalDocuments,
            totalSearches: this.totalSearches,
            indexSize: this.index.size,
            cacheSize: this.cache.size,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        };
    }

    /**
     * Cleanup
     */
    async shutdown() {
        log('Shutting down search worker...');
        this.status = 'STOPPED';
        this.index.clear();
        this.cache.clear();
    }
}

// =============================================
// 🎯 MESSAGE HANDLER
// =============================================
const worker = new SearchWorker();

parentPort.on('message', async (message) => {
    const { type, data, jobId } = message;
    
    try {
        let result;
        
        switch (type) {
            case 'search:query':
                result = await worker.search(data);
                break;
                
            case 'search:index':
                result = worker.addToIndex(data);
                break;
                
            case 'worker:stats':
                result = worker.getStats();
                break;
                
            case 'worker:shutdown':
                await worker.shutdown();
                result = { status: 'SHUTDOWN_COMPLETE' };
                break;
                
            case 'worker:health':
                result = { status: worker.status, timestamp: new Date().toISOString() };
                break;
                
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
        
        parentPort.postMessage({
            type: `${type}:complete`,
            jobId,
            success: true,
            data: result,
            workerId: workerData?.workerId || 'search-1',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        parentPort.postMessage({
            type: `${type}:error`,
            jobId,
            success: false,
            error: { message: error.message, code: 'SEARCH_WORKER_ERROR' }
        });
    }
});

// Initialize
worker.initialize().catch(error => {
    log(`Fatal: ${error.message}`);
    process.exit(1);
});
