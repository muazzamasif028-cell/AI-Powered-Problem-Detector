# 🧠 AI-Powered-Problem-Detector

**SUPREME PLATFORM v14.0.0**

[![Version](https://img.shields.io/badge/version-14.0.0-blue.svg)](https://github.com/muazzamasif028-cell/AI-Powered-Problem-Detector/releases)
[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](#-license)
[![Status](https://img.shields.io/badge/status-active%20development-brightgreen.svg)](https://github.com/muazzamasif028-cell/AI-Powered-Problem-Detector)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-4.18-000000.svg?logo=express&logoColor=white)](https://expressjs.com)

An AI-powered detection and diagnostics platform that ingests problems, runs specialized detectors (security, performance, crash, resource, availability, application), and returns root causes with actionable solutions.

---

## 🏛️ Architecture

The platform is built on the **MPU Core** — a central processing brain that fans work out to specialized detectors and a knowledge graph.

| Dimension | Scale |
| --- | --- |
| 🗣️ Languages | **7,000+** |
| 🕸️ Nodes | **2.5T** |
| 🧬 Layers | **5.9B** |
| 🧩 Components | **500B** |

```
                          ┌──────────────────────────┐
                          │        API Gateway       │
                          │      (/api, Express)     │
                          └────────────┬─────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │         MPU CORE         │
                          │  7000+ langs · 2.5T nodes│
                          └────────────┬─────────────┘
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   ┌──────────▼─────────┐   ┌──────────▼─────────┐   ┌──────────▼─────────┐
   │  Problem Intake    │   │  Detector Swarm    │   │  Knowledge Graph   │
   │  normalize + queue │   │  security / perf / │   │  5.9B layers       │
   │                    │   │  crash / resource  │   │  500B components   │
   └──────────┬─────────┘   └──────────┬─────────┘   └──────────┬─────────┘
              └────────────────────────┼────────────────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │  Root Cause + Solution   │
                          │         Engine           │
                          └──────────────────────────┘
```

---

## ✨ Features

- 🔍 **Multi-Detector Engine** — security, performance, crash, resource, availability and application detectors behind one API.
- 🧠 **Root Cause Analysis** — traces a symptom back to its origin instead of reporting surface errors.
- 💡 **Solution Engine** — turns each detection into a concrete, ranked remediation plan.
- 🚨 **Smart Alerts** — deduplicated, severity-aware alerting with real-time delivery.
- 🔮 **Precognition Layer** — predictive scanning to surface problems before they become incidents.
- 🩺 **Full Diagnostics** — one-shot deep scan combining every detector into a single report.
- 🔐 **Hardened by Default** — Helmet, CORS, JWT auth and bcrypt password hashing out of the box.
- ⚡ **Lightweight Runtime** — plain Express + Node, no build step required to run.
- 📊 **Health & Status Endpoints** — readiness, version and orchestrator status for monitoring.
- 🌐 **Multi-Provider AI** — pluggable LLM providers under `supreme/ai/llm`.

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | [Node.js](https://nodejs.org) `>=20` (ES modules) |
| Web framework | [Express](https://expressjs.com) `^4.18` |
| Security | [Helmet](https://helmetjs.github.io) `^7.1`, [cors](https://www.npmjs.com/package/cors) `^2.8` |
| Auth | [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) `^9.0`, [bcryptjs](https://www.npmjs.com/package/bcryptjs) `^2.4` |
| Performance | [compression](https://www.npmjs.com/package/compression) `^1.7` |
| Config | [dotenv](https://www.npmjs.com/package/dotenv) `^16.3` |

---

## 🚀 Quick Start

**Prerequisites:** Node.js 20 or newer and npm 9 or newer.

```bash
# 1. Clone the repository
git clone https://github.com/muazzamasif028-cell/AI-Powered-Problem-Detector.git
cd AI-Powered-Problem-Detector

# 2. Install dependencies
npm install

# 3. Configure your environment
cp .env.example .env
#    then edit .env and fill in your own values

# 4. Run
npm start          # production
npm run dev        # development, with file watching
```

The server listens on `PORT` (default `4000`). Verify it is up:

```bash
curl http://localhost:4000/api/health
```

---

## 🔌 API Endpoints

All routes are served under the `/api` base path.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe for the platform. |
| `GET` | `/api/info` | Platform name, version and build metadata. |
| `GET` | `/api/status` | Aggregated subsystem status. |
| `POST` | `/api/auth/signup` | Register a new account. |
| `POST` | `/api/auth/signin` | Authenticate and receive a JWT. |
| `POST` | `/api/auth/signout` | Invalidate the current session. |
| `GET` | `/api/auth/verify` | Validate the supplied JWT. |
| `POST` | `/api/detect/run` | Run the detector swarm over a payload. |
| `GET` | `/api/detect/alerts` | List alerts raised by detectors. |
| `POST` | `/api/diagnostics/full` | Full multi-detector diagnostic sweep. |
| `POST` | `/api/diagnostics/root-cause` | Resolve the root cause of a problem. |
| `POST` | `/api/diagnostics/solution` | Generate a remediation plan. |
| `POST` | `/api/precognition/scan` | Predictive scan for emerging problems. |
| `GET` | `/api/orchestrator/status` | Orchestrator state and active jobs. |
| `POST` | `/api/orchestrator/run` | Trigger an orchestrated pipeline run. |
| `GET` | `/api/languages/categories` | Supported language categories. |
| `GET` | `/api/languages/search` | Search the language registry. |
| `GET` | `/api/payment/tiers` | Available pricing tiers. |
| `POST` | `/api/payment/process` | Process a payment. |
| `GET` | `/api/payment/transactions` | List transactions. |

Example:

```bash
curl -X POST http://localhost:4000/api/detect/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "target": "service-api", "detectors": ["security", "performance"] }'
```

---

## 📁 Project Structure

```
AI-Powered-Problem-Detector/
├── server.js                  # HTTP entry point
├── app.js                     # Express app, middleware and mounting
├── package.json
├── .env.example               # Documented environment template
├── config/
│   └── system.json            # Platform, API, database and feature config
├── routes/
│   ├── api.gateway.js         # Unified /api gateway
│   ├── auth.middleware.js     # JWT / security layer
│   └── database.config.js     # MongoDB + Redis wiring
├── supreme/
│   └── ai/
│       └── llm/               # Pluggable LLM providers
├── detectors/                 # security · performance · crash · resource ·
│                              # availability · application detectors
├── engines/                   # problem intake · root cause · solution ·
│                              # precognition · orchestrator
└── DEVOPS & CI/               # Docker, Kubernetes and CI definitions
```

> **Note:** the repository is currently a flat working tree — most modules live at the
> root rather than in the folders above. The layout shown is the target structure the
> files are being organised into.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and set the values for your environment. Never commit a real `.env`.

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | Port the HTTP server binds to. | `4000` |
| `NODE_ENV` | Runtime mode. | `development` |
| `HOST` | Bind host. | `localhost` |
| `BASE_URL` | Public base URL of the API. | `http://localhost:4000` |
| `MONGODB_URI` | MongoDB connection string. | `mongodb://localhost:27017/supreme-platform` |
| `REDIS_URL` | Redis connection string. | `redis://localhost:6379` |
| `JWT_SECRET` | Signing secret for JWTs (min. 32 chars). | `change-me` |
| `JWT_EXPIRY` | Access token lifetime. | `24h` |
| `SESSION_SECRET` | Session signing secret. | `change-me` |
| `BCRYPT_SALT_ROUNDS` | bcrypt cost factor. | `12` |
| `OPENAI_API_KEY` | OpenAI API key. | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key. | `sk-ant-...` |
| `CORS_ORIGIN` | Allowed origin(s) for CORS. | `http://localhost:5173` |
| `RATE_LIMIT_MAX` | Max requests per window. | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms. | `900000` |
| `LOG_LEVEL` | Logger verbosity. | `info` |

Additional optional groups documented in `.env.example`: payment gateways (Stripe, PayPal, SafePay, JazzCash, EasyPaisa), email/SMTP, Twilio SMS, AWS / Google Cloud / Azure, Firebase, Supabase, Elasticsearch and feature flags (`FEATURE_*`).

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository and create a branch: `git checkout -b feature/my-change`
2. Make your change, keeping it focused and consistent with the surrounding style.
3. Verify the server still boots and `/api/health` responds.
4. Commit with a clear message: `git commit -m "Add my change"`
5. Push and open a pull request describing what changed and why.

Please open an issue first for large or structural changes so the direction can be agreed up front.

---

## 📄 License

This project is **UNLICENSED** (proprietary). All rights reserved — see `package.json`.
No permission is granted to use, copy, modify or distribute this software without the
author's written consent.

---

## 📬 Contact

- **Author:** Muazzam Asif
- **Email:** [muazzamasif028@gmail.com](mailto:muazzamasif028@gmail.com)
- **GitHub:** [@muazzamasif028-cell](https://github.com/muazzamasif028-cell)
- **Issues:** [Report a bug or request a feature](https://github.com/muazzamasif028-cell/AI-Powered-Problem-Detector/issues)
