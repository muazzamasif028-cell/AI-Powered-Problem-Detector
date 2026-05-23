// ============================================================
// 📁 queue/job.queue.js — JOB QUEUE
// ============================================================
class JobQueue {
    constructor() {
        this.jobs = new Map();
        this.waiting = [];
        this.active = new Map();
        this.completed = [];
        this.failed = [];
        this.handlers = new Map();
    }

    async add(type, data, options = {}) {
        const job = {
            id: 'JOB-' + Date.now().toString(36),
            type,
            data,
            options,
            status: 'WAITING',
            progress: 0,
            createdAt: new Date().toISOString(),
            returnvalue: null,
            error: null
        };

        this.jobs.set(job.id, job);
        this.waiting.push(job.id);

        console.log(`📋 [QUEUE] Job ${job.id} added: ${type}`);
        
        // Process immediately
        setTimeout(() => this.processNext(), 100);

        return job;
    }

    async getJob(jobId) {
        return this.jobs.get(jobId);
    }

    registerHandler(type, handler) {
        this.handlers.set(type, handler);
    }

    async processNext() {
        if (this.waiting.length === 0) return;

        const jobId = this.waiting.shift();
        const job = this.jobs.get(jobId);
        
        if (!job || !this.handlers.has(job.type)) {
            this.failed.push(jobId);
            return;
        }

        job.status = 'ACTIVE';
        this.active.set(jobId, job);

        try {
            const handler = this.handlers.get(job.type);
            job.returnvalue = await handler(job.data);
            job.status = 'COMPLETED';
            job.progress = 100;
            this.completed.push(jobId);
        } catch (err) {
            job.status = 'FAILED';
            job.error = err.message;
            this.failed.push(jobId);
        }

        this.active.delete(jobId);
    }

    getStats() {
        return {
            waiting: this.waiting.length,
            active: this.active.size,
            completed: this.completed.length,
            failed: this.failed.length,
            total: this.jobs.size
        };
    }
}

module.exports = new JobQueue();
