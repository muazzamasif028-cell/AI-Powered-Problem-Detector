// ============================================================
// 🎨 Midjourney Provider — AI Image Generation
// ============================================================
const axios = require('axios');

class MidjourneyProvider {
    constructor() {
        this.apiKey = null;
        this.baseURL = 'https://api.midjourney.com/v1';
        this.name = 'Midjourney';
    }

    async connect(credentials) {
        this.apiKey = credentials.apiKey;
        
        // Verify connection
        await axios.get(`${this.baseURL}/account`, {
            headers: { Authorization: `Bearer ${this.apiKey}` }
        });
        
        return true;
    }

    async generateImage(params) {
        const { prompt, aspectRatio = '16:9', stylize = 100, chaos = 0 } = params;

        const response = await axios.post(`${this.baseURL}/imagine`, {
            prompt,
            aspect_ratio: aspectRatio,
            stylize,
            chaos,
            process_mode: 'relax'
        }, {
            headers: { Authorization: `Bearer ${this.apiKey}` }
        });

        const jobId = response.data.job_id;

        // Poll for completion
        const result = await this.pollJob(jobId);
        
        return {
            imageUrl: result.image_url,
            jobId,
            prompt,
            variations: result.variations || []
        };
    }

    async upscale(jobId, index) {
        const response = await axios.post(`${this.baseURL}/upscale`, {
            job_id: jobId,
            index
        }, {
            headers: { Authorization: `Bearer ${this.apiKey}` }
        });

        const result = await this.pollJob(response.data.job_id);
        return { imageUrl: result.image_url };
    }

    async variation(jobId, index) {
        const response = await axios.post(`${this.baseURL}/variation`, {
            job_id: jobId,
            index
        }, {
            headers: { Authorization: `Bearer ${this.apiKey}` }
        });

        const result = await this.pollJob(response.data.job_id);
        return { imageUrl: result.image_url };
    }

    async pollJob(jobId, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            const response = await axios.get(`${this.baseURL}/job/${jobId}`, {
                headers: { Authorization: `Bearer ${this.apiKey}` }
            });

            if (response.data.status === 'completed') {
                return response.data;
            }

            if (response.data.status === 'failed') {
                throw new Error(`Midjourney job failed: ${response.data.error}`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error('Midjourney job timeout');
    }

    async disconnect() {
        this.apiKey = null;
    }
}

module.exports = new MidjourneyProvider();
