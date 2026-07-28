# 🧠 AI-Powered-Problem-Detector

**SUPREME PLATFORM v14.0.0**

[![Version](https://img.shields.io/badge/version-14.0.0-blue.svg)](https://github.com/muazzamasif028-cell/AI-Powered-Problem-Detector/releases)
[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](#-license)
[![Status](https://img.shields.io/badge/status-active%20development-brightgreen.svg)](https://github.com/muazzamasif028-cell/AI-Powered-Problem-Detector)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-4.18-000000.svg?logo=express&logoColor=white)](https://expressjs.com)

An AI-powered detection and diagnostics platform that ingests problems in plain language, runs pattern and metric detectors, and returns the root cause with a ranked, auto-appliable remediation plan.

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

- 📥 **Natural-Language Intake** — accepts reports over `CHAT`, `EMAIL`, `API` and `SYSTEM` channels, then categorises, extracts entities and infers severity.
- 🔍 **Pattern + Metric Detection** — 18 pattern rules and 6 metric rules across security, performance, availability, resource, crash, data, network and application, with fingerprinted alert deduplication.
- 🧠 **Root Cause Analysis** — scores 10 competing hypotheses from text, detector agreement and metrics, and reports `STRONG` / `MODERATE` / `WEAK` consensus with the evidence behind it.
- 💡 **Solution Engine** — maps each root cause to an ordered playbook and can auto-apply the safe steps for admins, always leaving risky steps for a human.
- 🎯 **Confidence Scoring** — weighted `HIGH` / `MEDIUM` / `LOW` verdict over detection, analysis and solution, with an explicit recommendation (`AUTO_APPLY`, `REVIEW`, `ESCALATE`, `GATHER_DATA`).
- 🔁 **8-Cycle Learning Loop** — feedback reweights detector patterns, grows the knowledge graph and tracks accuracy improvement against the baseline.
- 💰 **Usage-Based Pricing** — 5 tiers with automatic tier detection, volume/annual/nonprofit discounts and revenue tracking.
- 🔐 **Auth & Multi-Tenancy** — scrypt password hashing, HS256 JWT sessions, `SUPER_ADMIN` / `ADMIN` / `USER` roles, per-permission route guards, lockouts and an audit log.
- 🛰️ **Satellite Control** — 72-satellite constellation simulation with live orbit propagation, ground-station visibility and command dispatch.
- 📊 **Dashboard & Health** — one call returns platform-wide stats; `/api/health` reports per-engine readiness.

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | [Node.js](https://nodejs.org) `>=20` (CommonJS) |
| Web framework | [Express](https://expressjs.com) `^4.18` |
| Security | [Helmet](https://helmetjs.github.io) `^7.1`, [cors](https://www.npmjs.com/package/cors) `^2.8` |
| Auth | Node `crypto` — scrypt password hashing + HS256 JWTs (no external auth dependency) |
| Sessions | [express-session](https://www.npmjs.com/package/express-session) `^1.17` |
| Rate limiting | [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) `^7.1` |
| Performance | [compression](https://www.npmjs.com/package/compression) `^1.7` |
| Config | [dotenv](https://www.npmjs.com/package/dotenv) `^16.3` |

State is held in memory, so the backend runs with zero external services — no database, cache or broker required.

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
npm start          # production  (same as: node server.js)
npm run dev        # development, with file watching
```

The server listens on `PORT` (default `5000`). Verify it is up:

```bash
curl http://localhost:5000/api/health
# {"ok":true,"status":"HEALTHY","enginesReady":"10/10", ...}
```

All 10 engines are initialized **before** the port binds, so a successful boot log means the API is fully ready:

```
🤫 [server] all 10 engine(s) initialized in 2ms
🤫 [server] SUPREME PLATFORM v14.0.0 listening on http://localhost:5000
```

---

## 🔌 API Endpoints

🔓 = public · 🔒 = requires `Authorization: Bearer <token>`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | 🔓 | Platform info, engine readiness and endpoint index. |
| `GET` | `/dashboard` | 🔓 | Platform-wide stats: problems, detections, diagnostics, revenue, fleet. |
| `GET` | `/api/health` | 🔓 | Health check — `200` when all 10 engines are ready, `503` otherwise. |
| `GET` | `/api/system/status` | 🔓 | Full per-engine status, metrics and process info. |
| `POST` | `/api/auth/signup` | 🔓 | Register an account (first user of a new company becomes its `ADMIN`). |
| `POST` | `/api/auth/signin` | 🔓 | Authenticate and receive a JWT. |
| `POST` | `/api/auth/signout` | 🔒 | Revoke the current session. |
| `GET` | `/api/auth/me` | 🔒 | The authenticated user and their permissions. |
| `POST` | `/api/problems/intake` | 🔒 | Submit a problem in natural language. |
| `GET` | `/api/problems` | 🔒 | Intake history, filterable by category / severity / channel. |
| `POST` | `/api/detect/run` | 🔒 | Run pattern + metric detection. |
| `GET` | `/api/detect/alerts` | 🔒 | Active alerts, filterable by severity and category. |
| `POST` | `/api/detect/alerts/:alertId/resolve` | 🔒 | Resolve an active alert. |
| `POST` | `/api/diagnostics/full` | 🔒 | Full sweep: intake → detect → root cause → solution → confidence. |
| `POST` | `/api/diagnostics/root-cause` | 🔒 | Root-cause analysis on its own. |
| `POST` | `/api/solutions/:analysisId/generate` | 🔒 | Generate a remediation plan for an analysis. |
| `POST` | `/api/solutions/:solutionId/auto-apply` | 🔒 | Auto-apply the safe steps (`ADMIN`+). |
| `POST` | `/api/learning/feedback` | 🔒 | Feed an outcome back into the learning loop. |
| `GET` | `/api/pricing/tiers` | 🔓 | The 5 pricing tiers and their limits. |
| `POST` | `/api/pricing/quote` | 🔒 | Generate a quote with automatic tier detection. |
| `GET` | `/api/satellite/fleet` | 🔒 | Constellation health and all 72 satellites. |
| `GET` | `/api/satellite/track/:satelliteId` | 🔒 | Live position, telemetry and ground-station visibility. |
| `POST` | `/api/satellite/command` | 🔒 | Send a command; mutating commands need `satellite:command`. |

**Rate limits:** 300 requests / 15 min on `/api/*`, 20 failed attempts / 15 min on sign-in and sign-up, 60 requests / min on detection and diagnostics.

### Example: sign up, sign in, diagnose

```bash
BASE=http://localhost:5000

# 1. Register (returns the user; the first user of a company becomes ADMIN)
curl -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -d '{
  "email": "you@example.com",
  "password": "Sup3rSecret!2026",
  "companyName": "Supreme Technologies"
}'

# 2. Sign in and capture the JWT
TOKEN=$(curl -s -X POST $BASE/api/auth/signin -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"Sup3rSecret!2026"}' | jq -r .token)

# 3. Run a full diagnostic from a plain-language report
curl -X POST $BASE/api/diagnostics/full \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
    "description": "Production API is down after the deploy — users get 503 and pods are in CrashLoopBackOff with out of memory errors.",
    "metrics": { "memoryPct": 99, "errorRatePct": 42 }
  }'
```

The response carries the whole pipeline — `problem`, `detection`, `analysis`, `solution` and `confidence`:

```json
{
  "ok": true,
  "diagnostic": {
    "detection": { "findingCount": 8, "highestSeverity": "CRITICAL" },
    "analysis": { "rootCause": "Recent deployment introduced a regression", "consensus": "MODERATE", "confidencePct": 69.04 },
    "solution": { "playbookId": "RC-DEPLOY-001", "risk": "MEDIUM", "autoApplyEligible": true },
    "confidence": { "overallScore": 85.35, "level": "HIGH", "recommendation": "AUTO_APPLY" }
  }
}
```

---

## 📁 Project Structure

```
AI-Powered-Problem-Detector/
├── server.js               # Express app: boots all 10 engines, JWT auth, rate limits, routes
├── execution-engine.js     # CoreProcessingEngine     — concurrency, timeouts, retries, metrics
├── problem-intake.js       # ProblemIntakeSystem      — NL intake, categorisation, history
├── basic-detector.js       # BasicDetector            — pattern + metric rules, alert lifecycle
├── root-cause.js           # RootCauseEngine          — hypothesis scoring, consensus, evidence
├── solution-engine.js      # SolutionEngine           — playbooks, auto-apply, success rate
├── confidence-score.js     # ConfidenceScoringSystem  — weighted score, level, recommendation
├── learning-loop.js        # LearningLoopEngine       — 8 cycles, reweighting, knowledge graph
├── pricing-model.js        # PricingModelEngine       — 5 tiers, quotes, discounts, revenue
├── auth-system.js          # AuthSystem               — users, tenants, JWT, roles, audit log
├── satellite-control.js    # SatelliteControlSystem   — 72-satellite fleet, tracking, commands
├── package.json
├── .env.example            # Documented environment template
└── README.md
```

Every engine is a class exposing `initialize()`, `status()` and `shutdown()`, and is instantiated once in
`server.js`. Routes compose engines rather than reaching into each other, so the diagnostics pipeline is
just intake → detect → root cause → solution → confidence.

> **Note:** the repository also contains an earlier flat working tree (files with `— COMPLETE` style
> suffixes in their names). The files listed above are the live backend that `node server.js` runs.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and set the values for your environment. Never commit a real `.env`.

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `PORT` | no | Port the HTTP server binds to. | `5000` |
| `NODE_ENV` | no | Runtime mode — `production` enables Secure cookies and hides 5xx detail. | `development` |
| `SESSION_SECRET` | **yes** | Signs JWTs *and* the session cookie. If unset, an ephemeral key is generated at boot and every restart invalidates existing tokens. | `openssl rand -hex 48` |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist. Empty reflects the request origin (development only). | `http://localhost:5173,http://localhost:3000` |

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository and create a branch: `git checkout -b feature/my-change`
2. Make your change, keeping it focused and consistent with the surrounding style.
3. Verify the server still boots and `/api/health` reports `10/10` engines ready.
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
