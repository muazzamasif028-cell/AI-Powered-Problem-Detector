// ============================================================
// 🎵 Suno AI Provider — AI Music Generation
// ============================================================
const axios = require('axios');

class SunoProvider {
    constructor() {
        this.apiKey = null;
        this.baseURL = 'https://api.suno.ai/v1';
        this.name = 'Suno AI';
    }

    async connect(credentials) {
        this.apiKey = credentials.apiKey;
        return true;
    }

    async generateMusic(params) {
        const {
            prompt,
            genre = 'pop',
            mood = 'uplifting',
            tempo = 'medium',
            duration = 120,
            vocals = true,
            instrumental = true
        } = params;

        const response = await axios.post(`${this.baseURL}/generate`, {
            prompt,
            genre,
            mood,
            tempo,
            duration_seconds: duration,
            generate_vocals: vocals,
            generate_instrumental: instrumental
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const jobId = response.data.job_id;

        // Poll for completion
        const result = await this.pollJob(jobId);
        
        return {
            jobId,
            audioUrl: result.audio_url,
            lyrics: result.lyrics,
            duration: result.duration,
            title: result.title,
            waveform: result.waveform_url
        };
    }

    async extendMusic(params) {
        const { audioId, prompt, duration = 60 } = params;

        const response = await axios.post(`${this.baseURL}/extend`, {
            audio_id: audioId,
            prompt,
            duration_seconds: duration
        }, {
            headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });

        const result = await this.pollJob(response.data.job_id);
        return { audioUrl: result.audio_url };
    }

    async pollJob(jobId, maxAttempts = 40) {
        for (let i = 0; i < maxAttempts; i++) {
            const response = await axios.get(`${this.baseURL}/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });

            if (response.data.status === 'completed') {
                return response.data;
            }

            if (response.data.status === 'failed') {
                throw new Error(`Suno generation failed: ${response.data.error}`);
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        throw new Error('Suno generation timeout');
    }

    async disconnect() {
        this.apiKey = null;
    }
}

module.exports = new SunoProvider();
