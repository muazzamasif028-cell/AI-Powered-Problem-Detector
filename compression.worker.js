// ============================================================
// 🗜️ workers/compression.worker.js
// SUPREME Compression Worker v11.0
// Handles: Data compression, image optimization, archive creation
// ============================================================
const { parentPort, workerData } = require('worker_threads');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);
const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

const log = (message) => {
    console.log(`[COMPRESSION-WORKER] ${new Date().toISOString()} | ${message}`);
};

class CompressionWorker {
    constructor() {
        this.status = 'INITIALIZING';
        this.totalCompressed = 0;
        this.totalDecompressed = 0;
        this.bytesSaved = 0;
        this.startTime = Date.now();
    }

    async initialize() {
        log('Compression worker initializing...');
        this.status = 'READY';
        log('✅ Compression worker ready');
        
        parentPort.postMessage({
            type: 'worker:ready',
            workerId: workerData?.workerId || 'compression-1'
        });
    }

    /**
     * Compress data with algorithm selection
     */
    async compress(data) {
        const { content, algorithm = 'brotli', level = 6, isBuffer = false } = data;
        
        const input = isBuffer ? Buffer.from(content, 'base64') : Buffer.from(JSON.stringify(content));
        const originalSize = input.length;
        
        log(`Compressing: ${originalSize} bytes with ${algorithm} (level ${level})`);
        
        let compressed, algorithmUsed;
        const startTime = Date.now();
        
        try {
            switch (algorithm) {
                case 'gzip':
                    compressed = await gzip(input, { level });
                    algorithmUsed = 'gzip';
                    break;
                    
                case 'deflate':
                    compressed = await deflate(input, { level });
                    algorithmUsed = 'deflate';
                    break;
                    
                case 'brotli':
                default:
                    compressed = await brotliCompress(input, {
                        params: {
                            [zlib.constants.BROTLI_PARAM_QUALITY]: level
                        }
                    });
                    algorithmUsed = 'brotli';
                    break;
            }
            
            const compressedSize = compressed.length;
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);
            const saved = originalSize - compressedSize;
            
            this.totalCompressed++;
            this.bytesSaved += saved;
            
            log(`Compressed: ${originalSize} → ${compressedSize} bytes (${ratio}% reduction, ${Date.now() - startTime}ms)`);
            
            return {
                success: true,
                algorithm: algorithmUsed,
                originalSize,
                compressedSize,
                compressionRatio: `${ratio}%`,
                bytesSaved: saved,
                compressedData: compressed.toString('base64'),
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            log(`Compression failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Decompress data
     */
    async decompress(data) {
        const { content, algorithm = 'brotli' } = data;
        
        const input = Buffer.from(content, 'base64');
        log(`Decompressing: ${input.length} bytes with ${algorithm}`);
        
        const startTime = Date.now();
        
        try {
            let decompressed;
            
            switch (algorithm) {
                case 'gzip':
                    decompressed = await gunzip(input);
                    break;
                case 'deflate':
                    decompressed = await inflate(input);
                    break;
                case 'brotli':
                default:
                    decompressed = await brotliDecompress(input);
                    break;
            }
            
            this.totalDecompressed++;
            
            return {
                success: true,
                algorithm,
                compressedSize: input.length,
                decompressedSize: decompressed.length,
                data: JSON.parse(decompressed.toString()),
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            log(`Decompression failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Auto-select best algorithm
     */
    async autoCompress(data) {
        const { content } = data;
        const input = Buffer.from(JSON.stringify(content));
        
        // Try all algorithms and pick best
        const results = await Promise.all([
            this.compress({ ...data, algorithm: 'brotli' }).catch(() => null),
            this.compress({ ...data, algorithm: 'gzip' }).catch(() => null),
            this.compress({ ...data, algorithm: 'deflate' }).catch(() => null)
        ]);
        
        // Filter successful results and pick best compression ratio
        const successful = results.filter(r => r && r.success);
        
        if (successful.length === 0) {
            throw new Error('All compression algorithms failed');
        }
        
        const best = successful.reduce((a, b) => 
            (a.compressedSize < b.compressedSize) ? a : b
        );
        
        return {
            ...best,
            autoSelected: true,
            allResults: successful.map(r => ({
                algorithm: r.algorithm,
                ratio: r.compressionRatio
            }))
        };
    }

    getStats() {
        return {
            status: this.status,
            totalCompressed: this.totalCompressed,
            totalDecompressed: this.totalDecompressed,
            bytesSaved: this.bytesSaved,
            bytesSavedFormatted: this.formatBytes(this.bytesSaved),
            uptime: Math.floor((Date.now() - this.startTime) / 1000)
        };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async shutdown() {
        log('Shutting down compression worker...');
        this.status = 'STOPPED';
    }
}

// =============================================
// 🎯 MESSAGE HANDLER
// =============================================
const worker = new CompressionWorker();

parentPort.on('message', async (message) => {
    const { type, data, jobId } = message;
    
    try {
        let result;
        
        switch (type) {
            case 'compress:data':
                result = await worker.compress(data);
                break;
                
            case 'compress:auto':
                result = await worker.autoCompress(data);
                break;
                
            case 'decompress:data':
                result = await worker.decompress(data);
                break;
                
            case 'worker:stats':
                result = worker.getStats();
                break;
                
            case 'worker:shutdown':
                await worker.shutdown();
                result = { status: 'SHUTDOWN_COMPLETE' };
                break;
                
            case 'worker:health':
                result = { status: worker.status };
                break;
                
            default:
                throw new Error(`Unknown type: ${type}`);
        }
        
        parentPort.postMessage({
            type: `${type}:complete`,
            jobId,
            success: true,
            data: result,
            workerId: workerData?.workerId || 'compression-1'
        });
        
    } catch (error) {
        parentPort.postMessage({
            type: `${type}:error`,
            jobId,
            success: false,
            error: { message: error.message }
        });
    }
});

worker.initialize().catch(error => {
    log(`Fatal: ${error.message}`);
    process.exit(1);
});
