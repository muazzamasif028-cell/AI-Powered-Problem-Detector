/**
 * ============================================================
 * SUPREME Planetary OS
 * OpenAI Provider Adapter
 * providers/openai.js
 * ============================================================
 */

const OpenAI = require("openai");

class OpenAIProvider {

    constructor() {

        this.client = new OpenAI({

            apiKey: process.env.OPENAI_API_KEY

        });

    }

    async chat({

        model = "gpt-4.1",

        messages,

        temperature = 0.7,

        maxTokens = 4096

    }) {

        const response = await this.client.chat.completions.create({

            model,

            messages,

            temperature,

            max_completion_tokens: maxTokens

        });

        return {

            provider: "OpenAI",

            model,

            content: response.choices[0].message.content,

            usage: response.usage

        };

    }

}

module.exports = new OpenAIProvider();
