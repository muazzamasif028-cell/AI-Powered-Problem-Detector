/**
 * ============================================================
 * SUPREME Planetary OS
 * Application Configuration Loader
 * File:
 * app.config.js
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load Environment Variables
dotenv.config();

class ApplicationConfig {

    constructor() {

        this.root = process.cwd();

        this.systemConfigPath = path.join(
            this.root,
            "config",
            "system.json"
        );

        this.environment = process.env.NODE_ENV || "development";

        this.system = {};

        this.initialize();

    }

    // =========================================================
    // Initialize
    // =========================================================

    initialize() {

        this.loadSystemConfig();

        this.validate();

        this.mergeEnvironment();

        Object.freeze(this.system);

    }

    // =========================================================
    // Load JSON
    // =========================================================

    loadSystemConfig() {

        if (!fs.existsSync(this.systemConfigPath)) {

            throw new Error(
                `System configuration not found : ${this.systemConfigPath}`
            );

        }

        const raw = fs.readFileSync(
            this.systemConfigPath,
            "utf8"
        );

        this.system = JSON.parse(raw);

    }

    // =========================================================
    // Merge ENV
    // =========================================================

    mergeEnvironment() {

        this.system.environment = this.environment;

        this.system.server = {

            host:
                process.env.SERVER_HOST || "0.0.0.0",

            port:
                Number(process.env.PORT) || 5000

        };

        this.system.database.connection = {

            postgres:
                process.env.POSTGRES_URL || "",

            redis:
                process.env.REDIS_URL || "",

            mongodb:
                process.env.MONGODB_URI || "",

            qdrant:
                process.env.QDRANT_URL || "",

            elastic:
                process.env.ELASTICSEARCH_URL || ""

        };

        this.system.llm.credentials = {

            openai:
                process.env.OPENAI_API_KEY || "",

            claude:
                process.env.ANTHROPIC_API_KEY || "",

            gemini:
                process.env.GEMINI_API_KEY || "",

            azure:
                process.env.AZURE_OPENAI_KEY || "",

            deepseek:
                process.env.DEEPSEEK_API_KEY || "",

            qwen:
                process.env.QWEN_API_KEY || ""

        };

    }

    // =========================================================
    // Validate
    // =========================================================

    validate() {

        const required = [

            "platform",
            "runtime",
            "database",
            "llm",
            "security"

        ];

        for (const item of required) {

            if (!this.system[item]) {

                throw new Error(
                    `Missing configuration section : ${item}`
                );

            }

        }

    }

    // =========================================================
    // Get
    // =========================================================

    get(key) {

        return this.system[key];

    }

    // =========================================================
    // All
    // =========================================================

    all() {

        return this.system;

    }

}

module.exports = new ApplicationConfig();
