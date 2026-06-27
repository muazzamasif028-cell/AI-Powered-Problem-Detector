/**
 * ============================================================
 * SUPREME Planetary OS
 * Multi-LLM Registry
 * ============================================================
 */

class LLMRegistry {

    constructor() {

        this.providers = new Map();

        this.loadProviders();

    }

    loadProviders() {

        this.register({

            id: "openai",

            name: "OpenAI",

            models: [

                "gpt-4.1",
                "gpt-4o",
                "gpt-4o-mini",
                "o3",
                "o4-mini"

            ],

            apiEnv: "OPENAI_API_KEY",

            priority: 1

        });

        this.register({

            id: "anthropic",

            name: "Claude",

            models: [

                "claude-opus",
                "claude-sonnet",
                "claude-haiku"

            ],

            apiEnv: "ANTHROPIC_API_KEY",

            priority: 2

        });

        this.register({

            id: "google",

            name: "Gemini",

            models: [

                "gemini-2.5-pro",
                "gemini-2.5-flash"

            ],

            apiEnv: "GOOGLE_API_KEY",

            priority: 3

        });

        this.register({

            id: "azure",

            name: "Azure AI",

            models: [

                "azure-openai",
                "azure-ai-foundry"

            ],

            apiEnv: "AZURE_API_KEY",

            priority: 4

        });

        this.register({

            id: "meta",

            name: "Llama",

            models: [

                "llama-3",

                "llama-4"

            ],

            apiEnv: "LLAMA_API_KEY",

            priority: 5

        });

        this.register({

            id: "mistral",

            name: "Mistral AI",

            models: [

                "mistral-large",

                "mixtral"

            ],

            apiEnv: "MISTRAL_API_KEY",

            priority: 6

        });

        this.register({

            id: "deepseek",

            name: "DeepSeek",

            models: [

                "deepseek-chat",

                "deepseek-reasoner"

            ],

            apiEnv: "DEEPSEEK_API_KEY",

            priority: 7

        });

        this.register({

            id: "alibaba",

            name: "Qwen",

            models: [

                "qwen-max",

                "qwen-plus"

            ],

            apiEnv: "QWEN_API_KEY",

            priority: 8

        });

        this.register({

            id: "cohere",

            name: "Cohere",

            models: [

                "command-r",

                "command-r+"

            ],

            apiEnv: "COHERE_API_KEY",

            priority: 9

        });

        this.register({

            id: "xai",

            name: "xAI",

            models: [

                "grok"

            ],

            apiEnv: "XAI_API_KEY",

            priority: 10

        });

        this.register({

            id: "ai21",

            name: "AI21",

            models: [

                "jamba"

            ],

            apiEnv: "AI21_API_KEY",

            priority: 11

        });

        this.register({

            id: "custom",

            name: "Custom LLM",

            models: [

                "local-model"

            ],

            apiEnv: "CUSTOM_API_KEY",

            priority: 12

        });

    }

    register(provider) {

        this.providers.set(provider.id, provider);

    }

    get(id) {

        return this.providers.get(id);

    }

    getAll() {

        return [...this.providers.values()];

    }

}

module.exports = new LLMRegistry();
