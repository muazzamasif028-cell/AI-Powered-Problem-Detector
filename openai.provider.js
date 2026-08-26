// ============================================================
// 🤖 OpenAI Provider — ChatGPT, DALL-E, Whisper
// ============================================================
const OpenAI = require('openai');

class OpenAIProvider {
    constructor() {
        this.client = null;
        this.models = ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
        this.name = 'OpenAI';
    }

    async connect(credentials) {
        this.client = new OpenAI({ apiKey: credentials.apiKey });
        
        // Verify connection
        await this.client.models.list();
        return true;
    }

    async chat(params) {
        const { messages, model = 'gpt-4o', temperature = 0.7, maxTokens = 2000 } = params;
        
        const response = await this.client.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens
        });

        return {
            content: response.choices[0].message.content,
            model: response.model,
            usage: response.usage
        };
    }

    async generateImage(params) {
        const { prompt, size = '1024x1024', quality = 'standard', n = 1 } = params;
        
        const response = await this.client.images.generate({
            model: 'dall-e-3',
            prompt,
            size,
            quality,
            n
        });

        return {
            images: response.data.map(img => img.url),
            revisedPrompt: response.data[0].revised_prompt
        };
    }

    async speechToText(params) {
        const { audio, language = 'en' } = params;
        
        const response = await this.client.audio.transcriptions.create({
            model: 'whisper-1',
            file: audio,
            language
        });

        return { text: response.text };
    }

    async textToSpeech(params) {
        const { text, voice = 'alloy', speed = 1.0 } = params;
        
        const response = await this.client.audio.speech.create({
            model: 'tts-1',
            voice,
            input: text,
            speed
        });

        return { audio: Buffer.from(await response.arrayBuffer()) };
    }

    async disconnect() {
        this.client = null;
    }
}

module.exports = new OpenAIProvider();
