'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Main Server
 *
 * Boots all 10 engines, wires the REST surface and exposes a stats dashboard.
 * Engines are initialized before the HTTP listener binds, so the server never
 * accepts a request it cannot serve.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const { randomBytes } = require('crypto');

const { CoreProcessingEngine } = require('./execution-engine');
const { ProblemIntakeSystem } = require('./problem-intake');
const { BasicDetector } = require('./basic-detector');
const { RootCauseEngine } = require('./root-cause');
const { SolutionEngine } = require('./solution-engine');
const { ConfidenceScoringSystem } = require('./confidence-score');
const { LearningLoopEngine } = require('./learning-loop');
const { PricingModelEngine } = require('./pricing-model');
const { AuthSystem } = require('./auth-system');
const { SatelliteControlSystem } = require('./satellite-control');

const PLATFORM = Object.freeze({
  name: 'AI-Powered Problem Detector',
  platform: 'SUPREME PLATFORM',
  version: '14.0.0',
  codename: 'Planetary OS',
});

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || null;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin !== '');

const bootedAt = new Date();

// ---------------------------------------------------------------- the engines

const engines = {
  execution: new CoreProcessingEngine(),
  intake: new ProblemIntakeSystem(),
  detector: new BasicDetector(),
  rootCause: new RootCauseEngine(),
  solution: new SolutionEngine(),
  confidence: new ConfidenceScoringSystem(),
  learning: new LearningLoopEngine(),
  pricing: new PricingModelEngine(),
  auth: new AuthSystem({ jwtSecret: SESSION_SECRET }),
  satellite: new SatelliteControlSystem(),
};

const ENGINE_ORDER = Object.freeze([
  'execution',
  'auth',
  'intake',
  'detector',
  'rootCause',
  'solution',
  'confidence',
  'learning',
  'pricing',
  'satellite',
]);

async function initializeEngines() {
  console.log(`🤫 [server] booting ${PLATFORM.platform} v${PLATFORM.version} (${NODE_ENV})`);
  console.log(`🤫 [server] initializing ${ENGINE_ORDER.length} engine(s)...`);

  const report = [];

  for (const key of ENGINE_ORDER) {
    const engine = engines[key];
    const startedAt = Date.now();

    try {
      await engine.initialize();
      report.push({ engine: engine.name, key, ok: true, ms: Date.now() - startedAt });
    } catch (error) {
      report.push({ engine: engine.name, key, ok: false, ms: Date.now() - startedAt, error: error.message });
      console.log(`🤫 [server] engine "${key}" failed to initialize: ${error.message}`);
      throw error;
    }
  }

  console.log(`🤫 [server] all ${report.length} engine(s) initialized in ${report.reduce((sum, item) => sum + item.ms, 0)}ms`);
  return report;
}

// ----------------------------------------------------------------- middleware

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(
  session({
    name: 'supreme.sid',
    secret: SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`🤫 [server] ${req.method} ${req.originalUrl} → ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests — retry after the window resets' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { ok: false, error: 'Too many authentication attempts — retry later' },
});

const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Diagnostics rate limit reached — slow down' },
});

app.use('/api/', publicLimiter);

/** JWT authentication middleware. Attaches `req.user` and `req.token`. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: send an "Authorization: Bearer <token>" header',
      code: 'MISSING_BEARER_TOKEN',
    });
  }

  try {
    const { user } = engines.auth.authenticate(token);
    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      ok: false,
      error: error.message,
      code: error.code || 'INVALID_TOKEN',
    });
  }
}

/** Permission guard, used after `authenticate`. */
function requirePermission(permission) {
  return (req, res, next) => {
    try {
      engines.auth.requirePermission(req.user, permission);
      return next();
    } catch (error) {
      return res.status(error.statusCode || 403).json({
        ok: false,
        error: error.message,
        code: error.code || 'PERMISSION_DENIED',
      });
    }
  };
}

/** Wrap an async handler so rejections reach the error middleware. */
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// --------------------------------------------------------------------- routes

app.get('/', (req, res) => {
  res.json({
    ok: true,
    ...PLATFORM,
    description:
      'Detects problems from natural-language reports, finds the root cause and generates a remediation plan.',
    environment: NODE_ENV,
    uptimeSeconds: Math.floor((Date.now() - bootedAt.getTime()) / 1000),
    engines: ENGINE_ORDER.map((key) => ({ key, name: engines[key].name, ready: engines[key].ready })),
    endpoints: {
      dashboard: 'GET /dashboard',
      health: 'GET /api/health',
      signup: 'POST /api/auth/signup',
      signin: 'POST /api/auth/signin',
      intake: 'POST /api/problems/intake',
      detect: 'POST /api/detect/run',
      fullDiagnostic: 'POST /api/diagnostics/full',
      pricingQuote: 'POST /api/pricing/quote',
      satelliteFleet: 'GET /api/satellite/fleet',
      systemStatus: 'GET /api/system/status',
    },
    documentation: 'https://github.com/muazzamasif028-cell/AI-Powered-Problem-Detector#readme',
  });
});

app.get('/dashboard', (req, res) => {
  req.session.views = (req.session.views || 0) + 1;

  const intake = engines.intake.status();
  const detector = engines.detector.status();
  const rootCause = engines.rootCause.status();
  const solution = engines.solution.status();
  const confidence = engines.confidence.status();
  const learning = engines.learning.status();
  const pricing = engines.pricing.status();
  const auth = engines.auth.status();
  const fleet = engines.satellite.getFleetStatus();
  const execution = engines.execution.status();

  res.json({
    ok: true,
    dashboard: `${PLATFORM.platform} v${PLATFORM.version}`,
    generatedAt: new Date().toISOString(),
    session: { views: req.session.views },
    uptimeSeconds: Math.floor((Date.now() - bootedAt.getTime()) / 1000),
    stats: {
      problems: {
        received: intake.stats.totalIntakes,
        rejected: intake.stats.rejected,
        byCategory: intake.stats.byCategory,
        bySeverity: intake.stats.bySeverity,
      },
      detection: {
        runs: detector.stats.totalDetections,
        findings: detector.stats.totalMatches,
        activeAlerts: detector.alerts.active,
        criticalAlerts: detector.alerts.critical,
      },
      diagnostics: {
        analyses: rootCause.stats.totalAnalyses,
        inconclusive: rootCause.stats.inconclusive,
        byConsensus: rootCause.stats.byConsensus,
        avgConfidencePct: rootCause.stats.avgConfidencePct,
      },
      solutions: {
        generated: solution.stats.totalGenerated,
        autoApplied: solution.stats.autoApplied,
        successRatePct: solution.successRatePct,
      },
      confidence: {
        scored: confidence.stats.totalScored,
        avgScore: confidence.stats.avgScore,
        byLevel: confidence.stats.byLevel,
        byRecommendation: confidence.stats.byRecommendation,
      },
      learning: {
        feedbackProcessed: learning.stats.totalFeedback,
        accuracyPct: learning.accuracy.currentPct,
        improvementPct: learning.accuracy.improvementPct,
        patternsTracked: learning.knowledge.patternsTracked,
        graphNodes: learning.knowledge.graphNodes,
      },
      revenue: pricing.revenue,
      tenants: { users: auth.counts.users, companies: auth.counts.companies, activeSessions: auth.counts.activeSessions },
      satellites: {
        total: fleet.total,
        operational: fleet.operational,
        healthPct: fleet.healthPct,
        byState: fleet.byState,
      },
      execution: execution.metrics,
    },
  });
});

app.get('/api/health', (req, res) => {
  const notReady = ENGINE_ORDER.filter((key) => !engines[key].ready);
  const healthy = notReady.length === 0;

  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    status: healthy ? 'HEALTHY' : 'DEGRADED',
    version: PLATFORM.version,
    environment: NODE_ENV,
    uptimeSeconds: Math.floor((Date.now() - bootedAt.getTime()) / 1000),
    enginesReady: `${ENGINE_ORDER.length - notReady.length}/${ENGINE_ORDER.length}`,
    notReady,
    memoryMb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
    checkedAt: new Date().toISOString(),
  });
});

app.get('/api/system/status', (req, res) => {
  res.json({
    ok: true,
    platform: PLATFORM,
    environment: NODE_ENV,
    node: process.version,
    pid: process.pid,
    bootedAt: bootedAt.toISOString(),
    uptimeSeconds: Math.floor((Date.now() - bootedAt.getTime()) / 1000),
    memory: {
      heapUsedMb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
      rssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2)),
    },
    engines: ENGINE_ORDER.reduce((acc, key) => ({ ...acc, [key]: engines[key].status() }), {}),
  });
});

// ----------------------------------------------------------------------- auth

app.post(
  '/api/auth/signup',
  authLimiter,
  wrap(async (req, res) => {
    const user = await engines.auth.signup(req.body || {});
    res.status(201).json({ ok: true, user });
  })
);

app.post(
  '/api/auth/signin',
  authLimiter,
  wrap(async (req, res) => {
    const result = await engines.auth.signin(req.body || {}, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    res.json({ ok: true, ...result });
  })
);

app.post(
  '/api/auth/signout',
  authenticate,
  wrap(async (req, res) => {
    res.json({ ok: true, ...engines.auth.logout(req.token) });
  })
);

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// -------------------------------------------------------------------- intake

app.post(
  '/api/problems/intake',
  authenticate,
  requirePermission('problem:create'),
  wrap(async (req, res) => {
    const problem = await engines.execution
      .execute({
        task: 'problem.intake',
        payload: req.body,
        handler: () =>
          engines.intake.intake({
            ...(req.body || {}),
            reporter: (req.body && req.body.reporter) || req.user.email,
            tenantId: (req.body && req.body.tenantId) || req.user.companyId,
          }),
      })
      .then((run) => run.result);

    res.status(201).json({ ok: true, problem });
  })
);

app.get(
  '/api/problems',
  authenticate,
  requirePermission('problem:read'),
  wrap(async (req, res) => {
    res.json({
      ok: true,
      problems: engines.intake.getHistory(Number(req.query.limit) || 50, {
        category: req.query.category,
        severity: req.query.severity,
        channel: req.query.channel,
        tenantId: req.user.role === 'SUPER_ADMIN' ? req.query.tenantId : req.user.companyId,
      }),
    });
  })
);

// ------------------------------------------------------------------ detection

app.post(
  '/api/detect/run',
  authenticate,
  requirePermission('detection:run'),
  heavyLimiter,
  wrap(async (req, res) => {
    const body = req.body || {};
    const problem = body.problemId ? engines.intake.getProblem(body.problemId) : null;

    if (body.problemId && !problem) {
      return res.status(404).json({ ok: false, error: `Unknown problemId "${body.problemId}"`, code: 'PROBLEM_NOT_FOUND' });
    }

    const detection = await engines.execution
      .execute({
        task: 'detector.run',
        payload: body,
        handler: () =>
          engines.detector.detect({
            problemId: problem ? problem.problemId : null,
            description: body.description || (problem ? problem.description : ''),
            metrics: body.metrics,
            tenantId: req.user.companyId,
          }),
      })
      .then((run) => run.result);

    return res.json({ ok: true, detection });
  })
);

app.get(
  '/api/detect/alerts',
  authenticate,
  requirePermission('detection:run'),
  (req, res) => {
    res.json({
      ok: true,
      alerts: engines.detector.getActiveAlerts({
        severity: req.query.severity,
        category: req.query.category,
        minSeverity: req.query.minSeverity,
        tenantId: req.user.role === 'SUPER_ADMIN' ? req.query.tenantId : req.user.companyId,
      }),
    });
  }
);

app.post(
  '/api/detect/alerts/:alertId/resolve',
  authenticate,
  requirePermission('detection:run'),
  wrap(async (req, res) => {
    const alert = engines.detector.resolveAlert(req.params.alertId, {
      resolvedBy: req.user.email,
      note: (req.body || {}).note,
    });
    res.json({ ok: true, alert });
  })
);

// ---------------------------------------------------------------- diagnostics

/**
 * Full diagnostic sweep: detect → root cause → solution → confidence.
 * Every stage runs through the execution engine so one saturation limit and one
 * metrics view cover the whole pipeline.
 */
app.post(
  '/api/diagnostics/full',
  authenticate,
  requirePermission('diagnostics:run'),
  heavyLimiter,
  wrap(async (req, res) => {
    const body = req.body || {};

    let problem = body.problemId ? engines.intake.getProblem(body.problemId) : null;

    if (body.problemId && !problem) {
      return res.status(404).json({ ok: false, error: `Unknown problemId "${body.problemId}"`, code: 'PROBLEM_NOT_FOUND' });
    }

    if (!problem) {
      if (!body.description) {
        return res.status(400).json({
          ok: false,
          error: 'Provide either an existing "problemId" or a "description" to diagnose',
          code: 'NOTHING_TO_DIAGNOSE',
        });
      }

      problem = await engines.intake.intake({
        description: body.description,
        channel: body.channel || 'API',
        reporter: req.user.email,
        tenantId: req.user.companyId,
        severity: body.severity,
      });
    }

    const detection = await engines.execution
      .execute({
        task: 'diagnostics.detect',
        handler: () =>
          engines.detector.detect({
            problemId: problem.problemId,
            description: problem.description,
            metrics: body.metrics,
            tenantId: req.user.companyId,
          }),
      })
      .then((run) => run.result);

    const analysis = await engines.execution
      .execute({
        task: 'diagnostics.rootCause',
        handler: () =>
          engines.rootCause.analyze({
            problemId: problem.problemId,
            tenantId: req.user.companyId,
            description: problem.description,
            category: problem.category,
            severity: problem.severity,
            findings: detection.findings,
            metrics: body.metrics,
          }),
      })
      .then((run) => run.result);

    const solution = await engines.execution
      .execute({
        task: 'diagnostics.solution',
        handler: () => engines.solution.generateSolution(analysis, { user: req.user }),
      })
      .then((run) => run.result);

    const confidence = engines.confidence.calculateScore({ detection, analysis, solution });

    engines.intake.updateStatus(problem.problemId, 'DIAGNOSED');

    return res.json({
      ok: true,
      diagnostic: {
        problem,
        detection,
        analysis,
        solution,
        confidence,
        pipeline: ['intake', 'detect', 'rootCause', 'solution', 'confidence'],
        completedAt: new Date().toISOString(),
      },
    });
  })
);

app.post(
  '/api/diagnostics/root-cause',
  authenticate,
  requirePermission('diagnostics:run'),
  heavyLimiter,
  wrap(async (req, res) => {
    const analysis = await engines.rootCause.analyze({ ...(req.body || {}), tenantId: req.user.companyId });
    res.json({ ok: true, analysis });
  })
);

app.post(
  '/api/solutions/:analysisId/generate',
  authenticate,
  requirePermission('solution:read'),
  wrap(async (req, res) => {
    const analysis = engines.rootCause.getAnalysis(req.params.analysisId);

    if (!analysis) {
      return res.status(404).json({
        ok: false,
        error: `Unknown analysisId "${req.params.analysisId}"`,
        code: 'ANALYSIS_NOT_FOUND',
      });
    }

    const solution = await engines.solution.generateSolution(analysis, { user: req.user });
    return res.json({ ok: true, solution });
  })
);

app.post(
  '/api/solutions/:solutionId/auto-apply',
  authenticate,
  requirePermission('solution:auto-apply'),
  wrap(async (req, res) => {
    const report = await engines.solution.autoApply(req.params.solutionId, req.user);
    res.json({ ok: true, report });
  })
);

// ------------------------------------------------------------------- learning

app.post(
  '/api/learning/feedback',
  authenticate,
  requirePermission('problem:create'),
  wrap(async (req, res) => {
    const run = await engines.learning.processFeedback({
      ...(req.body || {}),
      reportedBy: req.user.email,
    });
    res.json({ ok: true, learning: run, accuracy: engines.learning.getAccuracy() });
  })
);

// -------------------------------------------------------------------- pricing

app.get('/api/pricing/tiers', (req, res) => {
  res.json({ ok: true, tiers: engines.pricing.listTiers() });
});

app.post(
  '/api/pricing/quote',
  authenticate,
  requirePermission('pricing:quote'),
  wrap(async (req, res) => {
    const body = req.body || {};
    const problem = body.problemId ? engines.intake.getProblem(body.problemId) : null;

    if (body.problemId && !problem) {
      return res.status(404).json({ ok: false, error: `Unknown problemId "${body.problemId}"`, code: 'PROBLEM_NOT_FOUND' });
    }

    const quote = engines.pricing.generateQuote({
      ...body,
      problem: problem || body.problem,
      tenantId: req.user.companyId,
    });

    return res.status(201).json({ ok: true, quote });
  })
);

// ------------------------------------------------------------------ satellite

app.get('/api/satellite/fleet', authenticate, requirePermission('satellite:read'), (req, res) => {
  res.json({
    ok: true,
    fleet: engines.satellite.getFleetStatus(),
    satellites: engines.satellite.listSatellites({ state: req.query.state, plane: req.query.plane }),
  });
});

app.get(
  '/api/satellite/track/:satelliteId',
  authenticate,
  requirePermission('satellite:read'),
  wrap(async (req, res) => {
    res.json({ ok: true, tracking: engines.satellite.track(req.params.satelliteId) });
  })
);

app.post(
  '/api/satellite/command',
  authenticate,
  requirePermission('satellite:read'),
  wrap(async (req, res) => {
    const command = await engines.satellite.sendCommand(req.body || {}, req.user);
    res.json({ ok: true, command });
  })
);

// ------------------------------------------------------------ error handling

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `No route for ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
    hint: 'GET / lists the available endpoints',
  });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.log(`🤫 [server] unhandled error on ${req.method} ${req.originalUrl}: ${error.stack || error.message}`);
  }

  res.status(statusCode).json({
    ok: false,
    error: statusCode >= 500 && NODE_ENV === 'production' ? 'Internal server error' : error.message,
    code: error.code || 'INTERNAL_ERROR',
  });
});

// ------------------------------------------------------------------ lifecycle

let server = null;

async function start() {
  await initializeEngines();

  await new Promise((resolve, reject) => {
    server = app.listen(PORT, (error) => (error ? reject(error) : resolve()));
    server.on('error', reject);
  });

  console.log(`🤫 [server] ${PLATFORM.platform} v${PLATFORM.version} listening on http://localhost:${PORT}`);
  console.log(`🤫 [server] dashboard → http://localhost:${PORT}/dashboard`);

  if (!SESSION_SECRET) {
    console.log('🤫 [server] WARNING: SESSION_SECRET is unset — sessions and tokens reset on every restart');
  }

  return server;
}

async function stop() {
  console.log('🤫 [server] shutdown requested');

  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }

  for (const key of [...ENGINE_ORDER].reverse()) {
    try {
      await engines[key].shutdown();
    } catch (error) {
      console.log(`🤫 [server] engine "${key}" shutdown error: ${error.message}`);
    }
  }

  console.log('🤫 [server] shutdown complete');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`🤫 [server] received ${signal}`);
    stop()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}

process.on('unhandledRejection', (reason) => {
  console.log(`🤫 [server] unhandled rejection: ${reason instanceof Error ? reason.stack : reason}`);
});

process.on('uncaughtException', (error) => {
  console.log(`🤫 [server] uncaught exception: ${error.stack || error.message}`);
  stop()
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
});

if (require.main === module) {
  start().catch((error) => {
    console.log(`🤫 [server] failed to start: ${error.stack || error.message}`);
    process.exit(1);
  });
}

module.exports = { app, engines, start, stop, PLATFORM };
