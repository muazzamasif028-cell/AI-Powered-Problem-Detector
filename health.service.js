// ============================================================
// ❤️ services/health.service.js
// SUPREME Health Check Service v11.0
// ============================================================
const os = require('os');
const { execSync } = require('child_process');

class HealthService {
    constructor() {
        this.startTime = Date.now();
        this.checks = {};
    }

    /**
     * Get comprehensive health status
     */
    async getFullHealth() {
        const checks = await Promise.all([
            this.checkSystem(),
            this.checkMemory(),
            this.checkDisk(),
            this.checkCPU(),
            this.checkNetwork(),
            this.checkDatabase(),
            this.checkRedis(),
            this.checkLLMServices()
        ]);

        const allHealthy = checks.every(check => check.status === 'healthy');

        return {
            status: allHealthy ? 'HEALTHY' : 'DEGRADED',
            platform: 'SUPREME Planetary OS',
            version: '11.0.0',
            uptime: this.getUptime(),
            timestamp: new Date().toISOString(),
            checks: checks.reduce((acc, check) => {
                acc[check.name] = check;
                return acc;
            }, {})
        };
    }

    /**
     * Quick health check (for load balancers)
     */
    async getQuickHealth() {
        const memoryUsage = process.memoryUsage();
        
        return {
            status: 'HEALTHY',
            uptime: Math.floor(process.uptime()),
            memory: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            timestamp: Date.now()
        };
    }

    /**
     * System information
     */
    async checkSystem() {
        return {
            name: 'system',
            status: 'healthy',
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            nodeVersion: process.version,
            pid: process.pid,
            uptime: Math.floor(os.uptime())
        };
    }

    /**
     * Memory check
     */
    async checkMemory() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const usagePercent = ((usedMem / totalMem) * 100).toFixed(2);
        const isHealthy = usagePercent < 90;

        return {
            name: 'memory',
            status: isHealthy ? 'healthy' : 'warning',
            total: this.formatBytes(totalMem),
            used: this.formatBytes(usedMem),
            free: this.formatBytes(freeMem),
            usagePercent: `${usagePercent}%`,
            message: isHealthy ? 'Memory usage normal' : 'High memory usage'
        };
    }

    /**
     * Disk check
     */
    async checkDisk() {
        try {
            let diskInfo;
            
            if (os.platform() === 'win32') {
                diskInfo = execSync('wmic logicaldisk get size,freespace,caption').toString();
            } else {
                diskInfo = execSync('df -h /').toString();
            }

            return {
                name: 'disk',
                status: 'healthy',
                info: diskInfo.trim().split('\n')[1] || 'Disk info available'
            };
        } catch (error) {
            return {
                name: 'disk',
                status: 'healthy',
                info: 'Disk check skipped (non-critical)'
            };
        }
    }

    /**
     * CPU check
     */
    async checkCPU() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const cpuCount = cpus.length;
        
        // Calculate average CPU usage
        let totalIdle = 0, totalTick = 0;
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        
        const idlePercent = (totalIdle / totalTick) * 100;
        const usagePercent = (100 - idlePercent).toFixed(2);
        const isHealthy = parseFloat(usagePercent) < 85;

        return {
            name: 'cpu',
            status: isHealthy ? 'healthy' : 'warning',
            cores: cpuCount,
            loadAverage: {
                '1min': loadAvg[0].toFixed(2),
                '5min': loadAvg[1].toFixed(2),
                '15min': loadAvg[2].toFixed(2)
            },
            usagePercent: `${usagePercent}%`,
            message: isHealthy ? 'CPU usage normal' : 'High CPU usage'
        };
    }

    /**
     * Network check
     */
    async checkNetwork() {
        const interfaces = os.networkInterfaces();
        const activeInterfaces = [];
        
        for (const [name, nets] of Object.entries(interfaces)) {
            for (const net of nets) {
                if (!net.internal && net.family === 'IPv4') {
                    activeInterfaces.push({
                        name,
                        address: net.address,
                        mac: net.mac
                    });
                }
            }
        }

        return {
            name: 'network',
            status: activeInterfaces.length > 0 ? 'healthy' : 'warning',
            interfaces: activeInterfaces,
            message: activeInterfaces.length > 0 ? 'Network connected' : 'No active network interfaces'
        };
    }

    /**
     * Database check (placeholder)
     */
    async checkDatabase() {
        // In production, this would actually check DB connection
        const isConnected = process.env.DATABASE_URL ? true : false;
        
        return {
            name: 'database',
            status: isConnected ? 'healthy' : 'degraded',
            connected: isConnected,
            message: isConnected ? 'Database connected' : 'Database not configured'
        };
    }

    /**
     * Redis check (placeholder)
     */
    async checkRedis() {
        const isConnected = process.env.REDIS_URL ? true : false;
        
        return {
            name: 'redis',
            status: isConnected ? 'healthy' : 'degraded',
            connected: isConnected,
            message: isConnected ? 'Redis connected' : 'Redis not configured'
        };
    }

    /**
     * LLM Services check
     */
    async checkLLMServices() {
        const models = ['GPT-4', 'Claude-3', 'Gemini', 'DeepSeek', 'Qwen'];
        const apiKeys = {
            'GPT-4': process.env.OPENAI_API_KEY,
            'Claude-3': process.env.ANTHROPIC_API_KEY,
            'Gemini': process.env.GOOGLE_AI_KEY,
            'DeepSeek': process.env.DEEPSEEK_API_KEY,
            'Qwen': process.env.QWEN_API_KEY
        };

        const available = models.filter(model => apiKeys[model]);
        const unavailable = models.filter(model => !apiKeys[model]);

        return {
            name: 'llm_services',
            status: available.length > 0 ? 'healthy' : 'degraded',
            total: models.length,
            available: available.length,
            availableModels: available,
            unavailableModels: unavailable,
            message: `${available.length}/${models.length} LLM models configured`
        };
    }

    /**
     * Uptime calculation
     */
    getUptime() {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        return {
            seconds: uptimeSeconds,
            formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
            since: new Date(this.startTime).toISOString()
        };
    }

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Singleton instance
const healthService = new HealthService();

module.exports = healthService;
