// ============================================================
// 🤖 src/services/ai-gateway.service.js
// SUPREME AI Gateway — Multi-Provider AI
// ============================================================
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class AIGateway {
    constructor() {
        this.providers = {};
        this.initProviders();
    }

    initProviders() {
        if (config.ai.openai.enabled && config.ai.openai.apiKey) {
            this.providers.openai = new OpenAI({ apiKey: config.ai.openai.apiKey });
        }
        if (config.ai.anthropic.enabled && config.ai.anthropic.apiKey) {
            this.providers.anthropic = new Anthropic({ apiKey: config.ai.anthropic.apiKey });
        }
    }

    /**
     * Chat completion — auto-selects provider
     */
    async chat(userId, messages, options = {}) {
        const { provider = 'openai', model, temperature = 0.7, maxTokens = 2000 } = options;
        
        // Check usage limits
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (!user.checkLimit('aiRequests')) {
            throw new Error('AI request limit reached. Upgrade your plan.');
        }

        let response;

        switch (provider) {
            case 'openai':
                response = await this.openaiChat(messages, model, temperature, maxTokens);
                break;
            case 'anthropic':
                response = await this.anthropicChat(messages, model, temperature, maxTokens);
                break;
            default:
                throw new Error(`Provider ${provider} not available`);
        }

        // Track usage
        user.usage.aiRequests++;
        await user.save();

        return {
            content: response.content,
            provider,
            model: response.model,
            usage: response.usage,
            remainingRequests: config.plans[user.plan].aiRequests - user.usage.aiRequests
        };
    }

    async openaiChat(messages, model, temperature, maxTokens) {
        const response = await this.providers.openai.chat.completions.create({
            model: model || 'gpt-3.5-turbo',
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

    async anthropicChat(messages, model, temperature, maxTokens) {
        // Convert messages format
        const systemMsg = messages.find(m => m.role === 'system')?.content;
        const userMsgs = messages.filter(m => m.role !== 'system');

        const response = await this.providers.anthropic.messages.create({
            model: model || 'claude-3-haiku-20240307',
            max_tokens: maxTokens,
            temperature,
            system: systemMsg,
            messages: userMsgs.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }))
        });

        return {
            content: response.content[0].text,
            model: response.model,
            usage: response.usage
        };
    }

    /**
     * List available models
     */
    getAvailableModels() {
        const models = [];
        
        if (this.providers.openai) {
            models.push(
                { provider: 'openai', model: 'gpt-4o', type: 'advanced' },
                { provider: 'openai', model: 'gpt-3.5-turbo', type: 'fast' }
            );
        }
        
        if (this.providers.anthropic) {
            models.push(
                { provider: 'anthropic', model: 'claude-3-opus-20240229', type: 'advanced' },
                { provider: 'anthropic', model: 'claude-3-haiku-20240307', type: 'fast' }
            );
        }

        return models;
    }

    /**
     * Quick chat (no user tracking)
     */
    async quickChat(messages) {
        return this.chat(null, messages, { provider: 'openai', model: 'gpt-3.5-turbo' });
    }
}

module.exports = new AIGateway();
