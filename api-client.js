// ============================================================
// 🎨 src/kernel/api-client.js
// SUPREME Universal API Client
// ============================================================
import axios from 'axios';
import { useAuthStore } from '../stores/auth-store';

class SupremeAPIClient {
    constructor() {
        this.client = axios.create({
            baseURL: import.meta.env.VITE_API_URL || 'https://api.supreme-os.com',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Platform': 'dashboard',
                'X-Client-Version': '13.0.0'
            }
        });
        
        this.setupInterceptors();
    }

    setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                const authStore = useAuthStore.getState();
                if (authStore.accessToken) {
                    config.headers.Authorization = `Bearer ${authStore.accessToken}`;
                }
                config.headers['X-Request-ID'] = crypto.randomUUID();
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => response.data,
            async (error) => {
                const originalRequest = error.config;

                // Token expired — try refresh
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    
                    try {
                        const authStore = useAuthStore.getState();
                        const newToken = await authStore.refreshToken();
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        return this.client(originalRequest);
                    } catch (refreshError) {
                        useAuthStore.getState().logout();
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error.response?.data || error);
            }
        );
    }

    // =============================================
    // 🧠 AI OS APIs
    // =============================================
    ai = {
        chat: (messages, model) => this.client.post('/api/ai/chat', { messages, model }),
        streamChat: (messages, model) => this.client.post('/api/ai/chat/stream', { messages, model }, { responseType: 'stream' }),
        generateImage: (prompt) => this.client.post('/api/ai/image/generate', { prompt }),
        getAgents: () => this.client.get('/api/ai/agents'),
        createAgent: (data) => this.client.post('/api/ai/agents', data),
        deployAgent: (id) => this.client.post(`/api/ai/agents/${id}/deploy`)
    };

    // =============================================
    // ☁️ CLOUD OS APIs
    // =============================================
    cloud = {
        getInstances: () => this.client.get('/api/cloud/instances'),
        createInstance: (data) => this.client.post('/api/cloud/instances', data),
        getStorage: () => this.client.get('/api/cloud/storage'),
        uploadFile: (file, path) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', path);
            return this.client.post('/api/cloud/storage/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        },
        getDatabases: () => this.client.get('/api/cloud/databases'),
        getFunctions: () => this.client.get('/api/cloud/functions')
    };

    // =============================================
    // 🌐 DOMAIN OS APIs
    // =============================================
    domain = {
        search: (domain) => this.client.post('/api/domain/search', { domain }),
        register: (data) => this.client.post('/api/domain/register', data),
        getMyDomains: () => this.client.get('/api/domain/my-domains'),
        getDNS: (id) => this.client.get(`/api/domain/${id}/dns`),
        addDNSRecord: (id, record) => this.client.post(`/api/domain/${id}/dns`, record),
        getSSL: (id) => this.client.get(`/api/domain/${id}/ssl`),
        issueSSL: (id) => this.client.post(`/api/domain/${id}/ssl/issue`),
        oneClickDeploy: (id) => this.client.post(`/api/domain/${id}/deploy`)
    };

    // =============================================
    // 💻 DEVELOPER OS APIs
    // =============================================
    developer = {
        getRepos: () => this.client.get('/api/dev/repos'),
        getIDE: () => this.client.get('/api/dev/ide'),
        getAPIs: () => this.client.get('/api/dev/apis'),
        createAPIKey: (data) => this.client.post('/api/dev/api-keys', data),
        getCIJobs: () => this.client.get('/api/dev/ci/jobs')
    };

    // =============================================
    // 🔐 AUTH APIs
    // =============================================
    auth = {
        login: (credentials) => this.client.post('/api/auth/signin', credentials),
        register: (data) => this.client.post('/api/auth/signup', data),
        logout: () => this.client.post('/api/auth/signout'),
        verify: () => this.client.get('/api/auth/verify'),
        refreshToken: (token) => this.client.post('/api/auth/refresh', { refreshToken: token }),
        enableMFA: () => this.client.post('/api/auth/mfa/enable'),
        verifyMFA: (code) => this.client.post('/api/auth/mfa/verify', { code })
    };

    // =============================================
    // 👤 UNIVERSAL IDENTITY APIs
    // =============================================
    identity = {
        get: () => this.client.get('/api/universal/identity'),
        update: (data) => this.client.put('/api/universal/identity', data),
        linkProvider: (provider) => this.client.post(`/api/universal/identity/link/${provider}`),
        getMemory: () => this.client.get('/api/universal/memory'),
        updateMemory: (data) => this.client.post('/api/universal/memory', data)
    };

    // =============================================
    // 💳 BILLING APIs
    // =============================================
    billing = {
        getOverview: () => this.client.get('/api/billing/overview'),
        getInvoices: () => this.client.get('/api/billing/invoices'),
        getPaymentMethods: () => this.client.get('/api/billing/payment-methods'),
        addPaymentMethod: (data) => this.client.post('/api/billing/payment-methods', data)
    };

    // =============================================
    // 📊 ANALYTICS APIs
    // =============================================
    analytics = {
        getDashboard: () => this.client.get('/api/analytics/dashboard'),
        getMetrics: (period) => this.client.get(`/api/analytics/metrics?period=${period}`),
        getLogs: (filters) => this.client.get('/api/analytics/logs', { params: filters })
    };
}
// =============================================
// 📡 SYSTEM MONITORING APIs
// =============================================
monitoring = {
    getHealth: () => this.client.get('/api/health'),
    getSystemStatus: () => this.client.get('/api/system/status')
};
// Singleton
export const api = new SupremeAPIClient();
export default api;
