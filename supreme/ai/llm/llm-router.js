/**
 * ============================================================
 * SUPREME Planetary OS
 * AI Layer
 * llm-router.js
 * Intelligent Multi-LLM Router
 * ============================================================
 */

const registry = require("./llm-registry");

class LLMRouter {

    constructor() {

        this.defaultFallback = [

            "openai",
            "anthropic",
            "google",
            "azure",
            "deepseek",
            "alibaba",
            "meta",
            "mistral",
            "cohere",
            "xai",
            "ai21",
            "custom"

        ];

    }

    // ======================================================
    // MAIN ROUTER
    // ======================================================

    async route(request = {}) {

        const {

            task = "general",

            budget = "medium",

            latency = "normal",

            vision = false,

            longContext = false,

            localOnly = false

        } = request;

        let candidates = registry.getAll();

        // Only available providers

        candidates = candidates.filter(p => p.available !== false);

        // Local only mode

        if (localOnly) {

            candidates = candidates.filter(p =>
                ["meta", "alibaba", "deepseek", "custom"].includes(p.id)
            );

        }

        // Capability filter

        candidates = candidates.filter(provider => {

            if (!provider.capabilities)
                return true;

            if (vision && !provider.capabilities.includes("vision"))
                return false;

            if (longContext && !provider.capabilities.includes("long-context"))
                return false;

            if (task && !provider.capabilities.includes(task))
                return false;

            return true;

        });

        // Cost optimization

        candidates.sort((a, b) => {

            if (budget === "low")
                return a.cost - b.cost;

            if (latency === "fast")
                return a.latency - b.latency;

            return a.priority - b.priority;

        });

        if (!candidates.length) {

            throw new Error("No compatible LLM provider found.");

        }

        return candidates[0];

    }

    // ======================================================
    // FAILOVER
    // ======================================================

    async failover(currentProvider) {

        const index = this.defaultFallback.indexOf(currentProvider);

        if (index === -1)
            return null;

        for (let i = index + 1; i < this.defaultFallback.length; i++) {

            const provider = registry.get(this.defaultFallback[i]);

            if (provider && provider.available !== false)
                return provider;

        }

        return null;

    }

    // ======================================================
    // EXECUTE
    // ======================================================

    async execute(request) {

        let provider = await this.route(request);

        try {

            console.log(
                `🧠 SUPREME Router → ${provider.name}`
            );

            return {

                success: true,

                provider: provider.name,

                model: provider.models[0],

                request

            };

        } catch (err) {

            console.warn(
                `${provider.name} failed. Switching...`
            );

            provider = await this.failover(provider.id);

            if (!provider)
                throw new Error("No fallback provider available.");

            console.log(
                `Fallback → ${provider.name}`
            );

            return {

                success: true,

                provider: provider.name,

                model: provider.models[0],

                request

            };

        }

    }

}

module.exports = new LLMRouter();
