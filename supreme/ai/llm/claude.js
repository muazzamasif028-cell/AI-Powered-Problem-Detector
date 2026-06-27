/**
 * ============================================================
 * SUPREME Planetary OS
 * Claude Provider Adapter
 * providers/claude.js
 * ============================================================
 */

const Anthropic = require("@anthropic-ai/sdk");

class ClaudeProvider {

    constructor() {

        this.client = new Anthropic({

            apiKey: process.env.ANTHROPIC_API_KEY

        });

    }

    async chat({

        model = "claude-sonnet-4",

        messages,

        temperature = 0.7,

        maxTokens = 4096

    }) {

        const system = messages.find(m => m.role === "system");

        const conversation = messages.filter(m => m.role !== "system");

        const response = await this.client.messages.create({

            model,

            system: system?.content,

            max_tokens: maxTokens,

            temperature,

            messages: conversation

        });

        return {

            provider: "Claude",

            model,

            content: response.content[0].text,

            usage: response.usage

        };

    }

}

module.exports = new ClaudeProvider();
