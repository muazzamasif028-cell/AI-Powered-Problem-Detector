// ============================================================
// 📁 queue/worker.js — QUEUE WORKER
// ============================================================
const jobQueue = require('./job.queue');
const processor = require('./processor');

class Worker {
    constructor() {
        this.running = false;
        this.interval = null;
    }

    start() {
        this.running = true;
        console.log('👷 [WORKER] Started');

        // Register handlers
        jobQueue.registerHandler('execute-problem', processor.processProblem);
        jobQueue.registerHandler('send-alert', processor.processAlert);
        jobQueue.registerHandler('generate-report', processor.processReport);

        // Process queue every second
        this.interval = setInterval(() => {
            jobQueue.processNext();
        }, 1000);
    }

    stop() {
        this.running = false;
        if (this.interval) clearInterval(this.interval);
        console.log('👷 [WORKER] Stopped');
    }
}

module.exports = new Worker();
