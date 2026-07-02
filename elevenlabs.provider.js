// ============================================================
// 🗣️ ElevenLabs Provider — AI Text-to-Speech
// ============================================================
const axios = require('axios');

class ElevenLabsProvider {
    constructor() {
        this.apiKey = null;
        this.baseURL = 'https://api.elevenlabs.io/v1';
        this.name = 'ElevenLabs';
    }

    async connect(credentials) {
        this.apiKey = credentials.apiKey;
        return true;
    }

    async textToSpeech(params) {
        const {
            text,
            voiceId = '21m00Tcm4TlvDq8ikWAM',
            stability = 0.5,
            similarityBoost = 0.75,
            style = 0,
            speakerBoost = true
        } = params;

        const response = await axios.post(
            `${this.baseURL}/text-to-speech/${voiceId}`,
            {
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability,
                    similarity_boost: similarityBoost,
                    style,
                    use_speaker_boost: speakerBoost
                }
            },
            {
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        return {
            audio: Buffer.from(response.data),
            format: 'mp3',
            duration: response.headers['content-length']
        };
    }

    async textToSpeechStream(params) {
        const { text, voiceId = '21m00Tcm4TlvDq8ikWAM' } = params;

        const response = await axios.post(
            `${this.baseURL}/text-to-speech/${voiceId}/stream`,
            { text, model_id: 'eleven_multilingual_v2' },
            {
                headers: { 'xi-api-key': this.apiKey },
                responseType: 'stream'
            }
        );

        return response.data;
    }

    async listVoices() {
        const response = await axios.get(`${this.baseURL}/voices`, {
            headers: { 'xi-api-key': this.apiKey }
        });

        return response.data.voices.map(v => ({
            id: v.voice_id,
            name: v.name,
            category: v.category,
            labels: v.labels,
            previewUrl: v.preview_url
        }));
    }

    async cloneVoice(params) {
        const { name, audioFiles, description } = params;

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description || '');
        
        audioFiles.forEach((file, index) => {
            formData.append('files', file, `sample_${index}.mp3`);
        });

        const response = await axios.post(`${this.baseURL}/voices/add`, formData, {
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'multipart/form-data'
            }
        });

        return response.data;
    }

    async disconnect() {
        this.apiKey = null;
    }
}

module.exports = new ElevenLabsProvider();
