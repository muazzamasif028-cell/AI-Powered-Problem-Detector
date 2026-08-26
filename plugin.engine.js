// ============================================================
// 🔮 kernel/engines/plugin.engine.js
// SUPREME Plugin Engine — Universal Plugin System
// ============================================================
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class PluginEngine {
    constructor(config = {}) {
        this.config = {
            pluginsDir: config.PLUGINS_DIR || path.join(process.cwd(), 'plugins'),
            autoLoad: config.AUTO_LOAD || true,
            sandbox: config.SANDBOX || false,
            ...config
        };
        
        this.plugins = new Map();
        this.hooks = new Map();
        this.dependencies = new Map();
        this.loadOrder = [];
        
        this.registerCoreHooks();
    }

    /**
     * Register core hooks
     */
    registerCoreHooks() {
        const coreHooks = [
            'onKernelStart',
            'onKernelStop',
            'onModuleLoad',
            'onModuleUnload',
            'onRequest',
            'onResponse',
            'onError',
            'onAuth',
            'onBilling',
            'onDeploy',
            'onDatabaseQuery',
            'onCacheHit',
            'onCacheMiss',
            'onFileUpload',
            'onFileDownload',
            'onEmailSend',
            'onSMS',
            'onWebhook',
            'onSchedule'
        ];
        
        coreHooks.forEach(hook => {
            this.hooks.set(hook, []);
        });
    }

    /**
     * Register a plugin
     */
    async registerPlugin(pluginDefinition) {
        const {
            name,
            version,
            description,
            author,
            hooks = {},
            dependencies = [],
            permissions = [],
            config = {},
            initialize,
            destroy
        } = pluginDefinition;
        
        // Validate plugin
        this.validatePlugin(pluginDefinition);
        
        // Check dependencies
        await this.checkDependencies(dependencies);
        
        const plugin = {
            id: crypto.randomUUID(),
            name,
            version,
            description,
            author,
            permissions,
            config,
            hooks,
            dependencies,
            initialize,
            destroy,
            status: 'registered',
            registeredAt: new Date(),
            metadata: {
                loadTime: 0,
                errorCount: 0,
                lastError: null
            }
        };
        
        // Register hooks
        for (const [hookName, handler] of Object.entries(hooks)) {
            if (this.hooks.has(hookName)) {
                this.hooks.get(hookName).push({
                    pluginId: plugin.id,
                    pluginName: name,
                    handler
                });
            }
        }
        
        this.plugins.set(plugin.id, plugin);
        this.loadOrder.push(plugin.id);
        
        // Initialize plugin
        if (initialize) {
            try {
                const startTime = Date.now();
                await initialize(this.getPluginAPI(plugin));
                plugin.metadata.loadTime = Date.now() - startTime;
                plugin.status = 'active';
            } catch (error) {
                plugin.status = 'error';
                plugin.metadata.lastError = error.message;
                throw error;
            }
        } else {
            plugin.status = 'active';
        }
        
        console.log(`🔌 Plugin registered: ${name} v${version}`);
        return plugin;
    }

    /**
     * Execute hook
     */
    async executeHook(hookName, context = {}) {
        const handlers = this.hooks.get(hookName) || [];
        const results = [];
        
        for (const { pluginId, pluginName, handler } of handlers) {
            const plugin = this.plugins.get(pluginId);
            
            if (!plugin || plugin.status !== 'active') continue;
            
            try {
                const result = await handler(context);
                results.push({
                    pluginId,
                    pluginName,
                    success: true,
                    result
                });
            } catch (error) {
                const plugin = this.plugins.get(pluginId);
                if (plugin) {
                    plugin.metadata.errorCount++;
                    plugin.metadata.lastError = error.message;
                }
                
                results.push({
                    pluginId,
                    pluginName,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Get plugin API (sandboxed methods available to plugins)
     */
    getPluginAPI(plugin) {
        return {
            pluginId: plugin.id,
            config: plugin.config,
            
            // Logger
            log: (message, data) => {
                console.log(`[${plugin.name}] ${message}`, data || '');
            },
            
            // Storage
            storage: {
                get: (key) => plugin.config[key],
                set: (key, value) => { plugin.config[key] = value; }
            },
            
            // Event bus
            on: (event, handler) => {
                global.eventEngine.subscribe(event, handler);
            },
            emit: (event, data) => {
                global.eventEngine.publish(event, data, { source: plugin.name });
            },
            
            // HTTP client
            fetch: async (url, options) => {
                const fetch = require('node-fetch');
                return fetch(url, options);
            },
            
            // Crypto
            crypto: {
                hash: (data) => crypto.createHash('sha256').update(data).digest('hex'),
                randomId: () => crypto.randomUUID()
            },
            
            // Timer
            setInterval: (fn, ms) => setInterval(fn, ms),
            setTimeout: (fn, ms) => setTimeout(fn, ms)
        };
    }

    /**
     * Unregister plugin
     */
    async unregisterPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        
        // Run destroy hook
        if (plugin.destroy) {
            await plugin.destroy();
        }
        
        // Remove hooks
        for (const [hookName, handlers] of this.hooks) {
            this.hooks.set(hookName, 
                handlers.filter(h => h.pluginId !== pluginId)
            );
        }
        
        this.plugins.delete(pluginId);
        this.loadOrder = this.loadOrder.filter(id => id !== pluginId);
        
        console.log(`🔌 Plugin unregistered: ${plugin.name}`);
        return true;
    }

    /**
     * Load plugin from file
     */
    async loadPluginFromFile(pluginPath) {
        const absolutePath = path.resolve(pluginPath);
        
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Plugin not found: ${absolutePath}`);
        }
        
        const pluginModule = require(absolutePath);
        return this.registerPlugin(pluginModule);
    }

    /**
     * Load all plugins from directory
     */
    async loadAllPlugins() {
        const pluginsDir = this.config.pluginsDir;
        
        if (!fs.existsSync(pluginsDir)) {
            fs.mkdirSync(pluginsDir, { recursive: true });
            return [];
        }
        
        const files = fs.readdirSync(pluginsDir)
            .filter(f => f.endsWith('.js') || f.endsWith('.plugin.js'));
        
        const loaded = [];
        
        for (const file of files) {
            try {
                const plugin = await this.loadPluginFromFile(
                    path.join(pluginsDir, file)
                );
                loaded.push(plugin);
            } catch (error) {
                console.error(`Failed to load plugin ${file}: ${error.message}`);
            }
        }
        
        return loaded;
    }

    /**
     * Validate plugin definition
     */
    validatePlugin(plugin) {
        const required = ['name', 'version'];
        
        for (const field of required) {
            if (!plugin[field]) {
                throw new Error(`Plugin missing required field: ${field}`);
            }
        }
        
        if (this.plugins.size > 0) {
            for (const [id, existing] of this.plugins) {
                if (existing.name === plugin.name) {
                    throw new Error(`Plugin "${plugin.name}" is already registered`);
                }
            }
        }
    }

    /**
     * Check plugin dependencies
     */
    async checkDependencies(dependencies) {
        for (const dep of dependencies) {
            const isLoaded = Array.from(this.plugins.values())
                .some(p => p.name === dep && p.status === 'active');
            
            if (!isLoaded) {
                throw new Error(`Missing dependency: ${dep}`);
            }
        }
    }

    /**
     * Get plugin statistics
     */
    getStats() {
        const stats = {
            total: this.plugins.size,
            active: 0,
            error: 0,
            disabled: 0,
            totalHooks: 0,
            plugins: []
        };
        
        for (const [id, plugin] of this.plugins) {
            stats[plugin.status]++;
            stats.plugins.push({
                name: plugin.name,
                version: plugin.version,
                status: plugin.status,
                errorCount: plugin.metadata.errorCount
            });
        }
        
        for (const [hookName, handlers] of this.hooks) {
            stats.totalHooks += handlers.length;
        }
        
        return stats;
    }
}

// Singleton
const pluginEngine = new PluginEngine();

module.exports = pluginEngine;
