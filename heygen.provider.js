// ============================================================
// 🎬 HeyGen Provider — AI Video Generation
// ============================================================
const axios = require('axios');

class HeyGenProvider {
    constructor() {
        this.apiKey = null;
        this.baseURL = 'https://api.heygen.com/v2';
        this.name = 'HeyGen';
    }

    async connect(credentials) {
        this.apiKey = credentials.apiKey;
        return true;
    }

    async generateVideo(params) {
        const {
            avatarId,
            voiceId,
            text,
            background = '#ffffff',
            width = 1920,
            height = 1080
        } = params;

        const response = await axios.post(`${this.baseURL}/video/generate`, {
            video_inputs: [{
                character: {
                    type: 'avatar',
                    avatar_id: avatarId,
                    avatar_style: 'normal'
                },
                voice: {
                    type: 'text',
                    input_text: text,
                    voice_id: voiceId
                },
                background: {
                    type: 'color',
                    value: background
                }
            }],
            dimension: { width, height }
        }, {
            headers: {
                'X-Api-Key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });

        const videoId = response.data.data.video_id;

        // Poll for completion
        const videoUrl = await this.pollVideo(videoId);
        
        return {
            videoId,
            videoUrl,
            duration: response.data.data.duration
        };
    }

    async pollVideo(videoId, maxAttempts = 60) {
        for (let i = 0; i < maxAttempts; i++) {
            const response = await axios.get(`${this.baseURL}/video/status?video_id=${videoId}`, {
                headers: { 'X-Api-Key': this.apiKey }
            });

            const status = response.data.data.status;

            if (status === 'completed') {
                return response.data.data.video_url;
            }

            if (status === 'failed') {
                throw new Error(`HeyGen video generation failed: ${response.data.data.error}`);
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        throw new Error('HeyGen video generation timeout');
    }

    async listAvatars() {
        const response = await axios.get(`${this.baseURL}/avatars`, {
            headers: { 'X-Api-Key': this.apiKey }
        });
        return response.data.data.avatars;
    }

    async listVoices() {
        const response = await axios.get(`${this.baseURL}/voices`, {
            headers: { 'X-Api-Key': this.apiKey }
        });
        return response.data.data.voices;
    }

    async disconnect() {
        this.apiKey = null;
    }
}

module.exports = new HeyGenProvider();
