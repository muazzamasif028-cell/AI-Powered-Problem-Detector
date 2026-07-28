'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Problem Intake System
 *
 * Front door of the platform. Accepts a free-form problem description from any
 * supported channel, normalizes it, extracts signals (category, severity,
 * entities, keywords) and emits a structured problem record that the detector
 * and diagnostics pipelines consume.
 */

const { randomUUID } = require('crypto');

const CHANNELS = Object.freeze(['CHAT', 'EMAIL', 'API', 'SYSTEM']);

const SEVERITIES = Object.freeze(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

/**
 * Category rules. Order matters only for tie-breaking; scoring decides the
 * winner. Weights let a strong signal ("sql injection") outrank a weak,
 * ambiguous one ("slow").
 */
const CATEGORY_RULES = Object.freeze([
  {
    category: 'SECURITY',
    keywords: [
      ['sql injection', 5],
      ['xss', 5],
      ['csrf', 4],
      ['breach', 5],
      ['unauthorized', 4],
      ['exploit', 4],
      ['vulnerability', 4],
      ['malware', 5],
      ['ransomware', 5],
      ['brute force', 4],
      ['credential', 3],
      ['token leak', 4],
      ['privilege', 3],
      ['attack', 3],
      ['hacked', 5],
      ['security', 2],
    ],
  },
  {
    category: 'PERFORMANCE',
    keywords: [
      ['latency', 4],
      ['timeout', 4],
      ['slow', 2],
      ['degraded', 3],
      ['throughput', 3],
      ['bottleneck', 4],
      ['p95', 3],
      ['p99', 3],
      ['response time', 4],
      ['lag', 2],
      ['queue backlog', 4],
      ['throttl', 3],
    ],
  },
  {
    category: 'AVAILABILITY',
    keywords: [
      ['outage', 5],
      ['down', 3],
      ['unreachable', 4],
      ['5xx', 4],
      ['503', 4],
      ['502', 4],
      ['unavailable', 4],
      ['offline', 4],
      ['cannot connect', 4],
      ['connection refused', 4],
      ['health check failing', 4],
    ],
  },
  {
    category: 'RESOURCE',
    keywords: [
      ['out of memory', 5],
      ['oom', 5],
      ['memory leak', 5],
      ['disk full', 5],
      ['cpu', 3],
      ['quota', 3],
      ['no space', 4],
      ['file descriptor', 4],
      ['exhausted', 4],
      ['saturat', 3],
      ['limit reached', 3],
    ],
  },
  {
    category: 'CRASH',
    keywords: [
      ['crash', 5],
      ['segfault', 5],
      ['panic', 4],
      ['stack trace', 4],
      ['exception', 3],
      ['core dump', 5],
      ['restart loop', 4],
      ['crashloopbackoff', 5],
      ['fatal', 4],
      ['unhandled rejection', 4],
    ],
  },
  {
    category: 'DATA',
    keywords: [
      ['corrupt', 5],
      ['data loss', 5],
      ['inconsistent', 3],
      ['duplicate record', 3],
      ['migration failed', 4],
      ['replication lag', 4],
      ['deadlock', 4],
      ['constraint violation', 3],
      ['integrity', 3],
    ],
  },
  {
    category: 'APPLICATION',
    keywords: [
      ['bug', 3],
      ['regression', 4],
      ['wrong result', 3],
      ['ui', 2],
      ['button', 2],
      ['form', 2],
      ['validation', 2],
      ['404', 3],
      ['broken link', 3],
      ['not rendering', 3],
    ],
  },
  {
    category: 'NETWORK',
    keywords: [
      ['dns', 4],
      ['packet loss', 4],
      ['tls', 3],
      ['ssl', 3],
      ['certificate', 3],
      ['firewall', 3],
      ['routing', 3],
      ['bandwidth', 3],
      ['handshake', 3],
    ],
  },
]);

const SEVERITY_SIGNALS = Object.freeze([
  { severity: 'CRITICAL', weight: 100, keywords: ['production down', 'data loss', 'breach', 'outage', 'ransomware', 'all users', 'revenue impact', 'sev1', 'p0'] },
  { severity: 'HIGH', weight: 60, keywords: ['crash', 'failing', 'cannot', 'blocked', 'many users', 'urgent', 'sev2', 'p1', 'oom', 'corrupt'] },
  { severity: 'MEDIUM', weight: 30, keywords: ['slow', 'degraded', 'intermittent', 'sometimes', 'warning', 'sev3', 'p2'] },
  { severity: 'LOW', weight: 10, keywords: ['cosmetic', 'typo', 'minor', 'question', 'suggestion', 'nit', 'p3'] },
]);

const ENTITY_PATTERNS = Object.freeze({
  urls: /\bhttps?:\/\/[^\s<>"')]+/gi,
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  emails: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi,
  httpStatus: /\b[45]\d{2}\b/g,
  errorCodes: /\b(?:E[A-Z]{3,}|ERR_[A-Z_]+|[A-Z]{2,}_[A-Z_]{2,}_ERROR)\b/g,
  services: /\b(?:service|svc|api|worker|job|pod|container|db|database)[-_:\s]?([a-z0-9][a-z0-9-_]{1,40})\b/gi,
});

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our',
  'out', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'did',
  'get', 'that', 'this', 'with', 'from', 'they', 'have', 'been', 'when', 'what', 'were', 'will', 'would',
  'there', 'their', 'about', 'which', 'while', 'after', 'before', 'into', 'over', 'some', 'then', 'than',
  'very', 'just', 'also', 'because', 'seems', 'seem', 'like', 'when', 'we', 'it', 'is', 'to', 'of', 'in',
  'on', 'at', 'as', 'a', 'an', 'be', 'do', 'or', 'if', 'my', 'me', 'i',
]);

const DEFAULT_OPTIONS = {
  historyLimit: 1000,
  maxDescriptionLength: 20000,
  minDescriptionLength: 3,
};

class ProblemIntakeSystem {
  constructor(options = {}) {
    this.name = 'ProblemIntakeSystem';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.problems = new Map();
    this.history = [];

    this.stats = {
      totalIntakes: 0,
      rejected: 0,
      byChannel: CHANNELS.reduce((acc, channel) => ({ ...acc, [channel]: 0 }), {}),
      byCategory: {},
      bySeverity: SEVERITIES.reduce((acc, severity) => ({ ...acc, [severity]: 0 }), {}),
      avgConfidencePct: 0,
      totalConfidence: 0,
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [ProblemIntakeSystem] initializing intake channels...');

    this.startedAt = new Date();
    this.ready = true;

    console.log(
      `🤫 [ProblemIntakeSystem] ready — channels=${CHANNELS.join('/')} ` +
        `categories=${CATEGORY_RULES.length}`
    );

    return this.status();
  }

  /**
   * Ingest a problem.
   *
   * @param {object} input
   * @param {string} input.description   Natural-language problem description.
   * @param {string} [input.channel]     One of CHANNELS. Defaults to 'API'.
   * @param {string} [input.title]
   * @param {string} [input.reporter]
   * @param {string} [input.tenantId]
   * @param {string} [input.severity]    Explicit override.
   * @param {object} [input.metadata]
   */
  async intake(input = {}) {
    if (!this.ready) {
      throw new Error('ProblemIntakeSystem.intake called before initialize()');
    }

    let normalized;
    try {
      normalized = this._validate(input);
    } catch (error) {
      this.stats.rejected += 1;
      throw error;
    }

    const { description, channel, title, reporter, tenantId, metadata, severityOverride } = normalized;

    const text = description.toLowerCase();
    const classification = this._classify(text);
    const severity = severityOverride || this._deriveSeverity(text, classification.category);
    const entities = this._extractEntities(description);
    const keywords = this._extractKeywords(text);

    const problem = {
      problemId: `PRB-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: title || this._deriveTitle(description),
      description,
      channel,
      reporter: reporter || 'anonymous',
      tenantId: tenantId || 'default',
      category: classification.category,
      categoryScores: classification.scores,
      categoryConfidencePct: classification.confidencePct,
      severity,
      keywords,
      entities,
      signals: {
        wordCount: description.trim().split(/\s+/).length,
        hasStackTrace: /\bat\s+[\w.$]+\s*\(|Traceback \(most recent call last\)/.test(description),
        hasNumbers: /\d/.test(description),
        mentionsProduction: /\bprod(uction)?\b/i.test(description),
        urgencyMarkers: (description.match(/!|urgent|asap|immediately/gi) || []).length,
      },
      status: 'INTAKEN',
      metadata: metadata || {},
      receivedAt: new Date().toISOString(),
    };

    this.problems.set(problem.problemId, problem);
    this._record(problem);

    console.log(
      `🤫 [ProblemIntakeSystem] intake ${problem.problemId} channel=${channel} ` +
        `category=${problem.category} severity=${problem.severity} ` +
        `confidence=${problem.categoryConfidencePct}%`
    );

    return problem;
  }

  /** Ingest many problems, isolating per-item failures. */
  async intakeBatch(inputs = []) {
    const accepted = [];
    const rejected = [];

    for (const input of inputs) {
      try {
        accepted.push(await this.intake(input));
      } catch (error) {
        rejected.push({ input, error: error.message, code: error.code || 'INTAKE_REJECTED' });
      }
    }

    console.log(`🤫 [ProblemIntakeSystem] batch intake — accepted=${accepted.length} rejected=${rejected.length}`);
    return { accepted, rejected };
  }

  getProblem(problemId) {
    return this.problems.get(problemId) || null;
  }

  updateStatus(problemId, status) {
    const problem = this.problems.get(problemId);
    if (!problem) {
      const error = new Error(`Unknown problemId "${problemId}"`);
      error.code = 'PROBLEM_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    problem.status = status;
    problem.updatedAt = new Date().toISOString();
    return problem;
  }

  /** Most recent intake records, newest first. */
  getHistory(limit = 50, filter = {}) {
    let entries = this.history;

    if (filter.channel) {
      entries = entries.filter((entry) => entry.channel === String(filter.channel).toUpperCase());
    }
    if (filter.category) {
      entries = entries.filter((entry) => entry.category === String(filter.category).toUpperCase());
    }
    if (filter.severity) {
      entries = entries.filter((entry) => entry.severity === String(filter.severity).toUpperCase());
    }
    if (filter.tenantId) {
      entries = entries.filter((entry) => entry.tenantId === filter.tenantId);
    }

    return entries.slice(0, Math.max(0, limit));
  }

  status() {
    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      channels: CHANNELS,
      categories: CATEGORY_RULES.map((rule) => rule.category),
      severities: SEVERITIES,
      stored: this.problems.size,
      stats: {
        totalIntakes: this.stats.totalIntakes,
        rejected: this.stats.rejected,
        byChannel: this.stats.byChannel,
        byCategory: this.stats.byCategory,
        bySeverity: this.stats.bySeverity,
        avgConfidencePct: this.stats.avgConfidencePct,
      },
    };
  }

  async shutdown() {
    console.log(`🤫 [ProblemIntakeSystem] shutting down — ${this.problems.size} problem(s) retained`);
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _validate(input) {
    if (input === null || typeof input !== 'object') {
      const error = new TypeError('intake() requires an object payload');
      error.code = 'INVALID_PAYLOAD';
      error.statusCode = 400;
      throw error;
    }

    const description = typeof input.description === 'string' ? input.description.trim() : '';

    if (description.length < this.options.minDescriptionLength) {
      const error = new Error(
        `"description" must be at least ${this.options.minDescriptionLength} characters`
      );
      error.code = 'DESCRIPTION_TOO_SHORT';
      error.statusCode = 400;
      throw error;
    }

    if (description.length > this.options.maxDescriptionLength) {
      const error = new Error(
        `"description" exceeds ${this.options.maxDescriptionLength} characters`
      );
      error.code = 'DESCRIPTION_TOO_LONG';
      error.statusCode = 413;
      throw error;
    }

    const channel = String(input.channel || 'API').toUpperCase();
    if (!CHANNELS.includes(channel)) {
      const error = new Error(`Unsupported channel "${channel}". Expected one of ${CHANNELS.join(', ')}`);
      error.code = 'UNSUPPORTED_CHANNEL';
      error.statusCode = 400;
      throw error;
    }

    let severityOverride = null;
    if (input.severity !== undefined && input.severity !== null) {
      severityOverride = String(input.severity).toUpperCase();
      if (!SEVERITIES.includes(severityOverride)) {
        const error = new Error(
          `Unsupported severity "${severityOverride}". Expected one of ${SEVERITIES.join(', ')}`
        );
        error.code = 'UNSUPPORTED_SEVERITY';
        error.statusCode = 400;
        throw error;
      }
    }

    return {
      description,
      channel,
      severityOverride,
      title: typeof input.title === 'string' ? input.title.trim().slice(0, 200) : null,
      reporter: typeof input.reporter === 'string' ? input.reporter.trim().slice(0, 200) : null,
      tenantId: typeof input.tenantId === 'string' ? input.tenantId.trim().slice(0, 100) : null,
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : null,
    };
  }

  _classify(text) {
    const scores = {};
    let total = 0;

    for (const rule of CATEGORY_RULES) {
      let score = 0;
      for (const [keyword, weight] of rule.keywords) {
        if (text.includes(keyword)) {
          score += weight;
        }
      }
      if (score > 0) {
        scores[rule.category] = score;
        total += score;
      }
    }

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    if (ranked.length === 0) {
      return { category: 'UNCLASSIFIED', scores: {}, confidencePct: 0 };
    }

    const [category, topScore] = ranked[0];
    const confidencePct = Number(((topScore / total) * 100).toFixed(2));

    return { category, scores, confidencePct };
  }

  _deriveSeverity(text, category) {
    for (const signal of SEVERITY_SIGNALS) {
      if (signal.keywords.some((keyword) => text.includes(keyword))) {
        return signal.severity;
      }
    }

    if (category === 'SECURITY' || category === 'AVAILABILITY' || category === 'DATA') {
      return 'HIGH';
    }
    if (category === 'UNCLASSIFIED') {
      return 'LOW';
    }
    return 'MEDIUM';
  }

  _extractEntities(description) {
    const entities = {};

    for (const [key, pattern] of Object.entries(ENTITY_PATTERNS)) {
      const matches = description.match(pattern);
      if (matches && matches.length > 0) {
        entities[key] = [...new Set(matches.map((match) => match.trim()))].slice(0, 25);
      }
    }

    return entities;
  }

  _extractKeywords(text, limit = 12) {
    const counts = new Map();

    for (const rawToken of text.split(/[^a-z0-9_-]+/)) {
      const token = rawToken.trim();
      if (token.length < 3 || STOP_WORDS.has(token) || /^\d+$/.test(token)) {
        continue;
      }
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([term, count]) => ({ term, count }));
  }

  _deriveTitle(description) {
    const firstSentence = description.split(/(?<=[.!?])\s/)[0] || description;
    const title = firstSentence.replace(/\s+/g, ' ').trim();
    return title.length > 120 ? `${title.slice(0, 117)}...` : title;
  }

  _record(problem) {
    this.stats.totalIntakes += 1;
    this.stats.byChannel[problem.channel] = (this.stats.byChannel[problem.channel] || 0) + 1;
    this.stats.byCategory[problem.category] = (this.stats.byCategory[problem.category] || 0) + 1;
    this.stats.bySeverity[problem.severity] = (this.stats.bySeverity[problem.severity] || 0) + 1;

    this.stats.totalConfidence += problem.categoryConfidencePct;
    this.stats.avgConfidencePct = Number(
      (this.stats.totalConfidence / this.stats.totalIntakes).toFixed(2)
    );

    this.history.unshift({
      problemId: problem.problemId,
      title: problem.title,
      channel: problem.channel,
      category: problem.category,
      severity: problem.severity,
      tenantId: problem.tenantId,
      reporter: problem.reporter,
      receivedAt: problem.receivedAt,
    });

    if (this.history.length > this.options.historyLimit) {
      this.history.pop();
    }
  }
}

module.exports = { ProblemIntakeSystem, CHANNELS, SEVERITIES };
module.exports.default = ProblemIntakeSystem;
