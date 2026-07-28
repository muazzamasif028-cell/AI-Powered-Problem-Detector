'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Root Cause Engine
 *
 * Takes a problem record plus detector findings and produces a ranked list of
 * candidate root causes. Each candidate accumulates evidence from independent
 * signal sources; agreement across sources becomes a consensus grade
 * (STRONG / MODERATE / WEAK) so operators know how much to trust the verdict.
 */

const { randomUUID } = require('crypto');

const CONSENSUS = Object.freeze({ STRONG: 'STRONG', MODERATE: 'MODERATE', WEAK: 'WEAK' });

const CATEGORIES = Object.freeze([
  'SECURITY',
  'PERFORMANCE',
  'AVAILABILITY',
  'RESOURCE',
  'CRASH',
  'DATA',
  'NETWORK',
  'APPLICATION',
  'CONFIGURATION',
]);

/**
 * Causal hypotheses. `signals` are weighted regexes evaluated against the
 * combined problem text; `categories` boosts a hypothesis when the detector
 * already classified the problem into a matching category.
 */
const HYPOTHESES = Object.freeze([
  {
    id: 'RC-DEPLOY-001',
    cause: 'Recent deployment introduced a regression',
    category: 'APPLICATION',
    signals: [
      [/after (the )?(deploy|release|rollout|push)/i, 5],
      [/regression|worked (before|yesterday|last week)/i, 4],
      [/since (the )?(new )?version|v\d+\.\d+/i, 3],
      [/rollback/i, 3],
    ],
    categories: ['APPLICATION', 'PERFORMANCE', 'CRASH'],
    verification: 'Compare the current release SHA against the last known-good release and bisect.',
  },
  {
    id: 'RC-CONFIG-002',
    cause: 'Misconfiguration or missing environment variable',
    category: 'CONFIGURATION',
    signals: [
      [/env(ironment)? (var|variable)|\.env\b/i, 5],
      [/misconfig|wrong (config|setting)|not (set|configured)/i, 4],
      [/undefined is not|cannot read (property|properties)/i, 2],
      [/secret|credential|key.*(missing|empty)/i, 3],
    ],
    categories: ['CONFIGURATION', 'SECURITY', 'APPLICATION'],
    verification: 'Diff the running config against the expected template and assert required keys exist.',
  },
  {
    id: 'RC-RESOURCE-003',
    cause: 'Resource exhaustion on the host or container',
    category: 'RESOURCE',
    signals: [
      [/out of memory|oom(killed)?|heap/i, 5],
      [/disk (full|pressure)|no space left/i, 5],
      [/cpu (at|above|pegged|100)/i, 4],
      [/too many open files|file descriptor/i, 4],
      [/leak/i, 3],
    ],
    categories: ['RESOURCE', 'CRASH', 'PERFORMANCE'],
    verification: 'Chart memory/CPU/disk against the incident window and confirm the ceiling was hit.',
  },
  {
    id: 'RC-DEPENDENCY-004',
    cause: 'Downstream dependency degraded or unavailable',
    category: 'AVAILABILITY',
    signals: [
      [/upstream|downstream|third[- ]party|external (api|service)/i, 5],
      [/502|503|504|gateway timeout/i, 4],
      [/connection (refused|reset)|econnrefused/i, 4],
      [/vendor|provider (is )?down/i, 3],
    ],
    categories: ['AVAILABILITY', 'NETWORK', 'PERFORMANCE'],
    verification: 'Check the dependency status page and compare its error rate with ours.',
  },
  {
    id: 'RC-DB-005',
    cause: 'Database contention, slow query or missing index',
    category: 'DATA',
    signals: [
      [/deadlock|lock wait|blocking (query|transaction)/i, 5],
      [/slow query|full table scan|missing index|seq scan/i, 5],
      [/replication lag|read replica/i, 4],
      [/connection pool (exhausted|full)/i, 4],
      [/query (took|timeout)/i, 3],
    ],
    categories: ['DATA', 'PERFORMANCE', 'AVAILABILITY'],
    verification: 'Pull the slow-query log for the window and EXPLAIN the top offenders.',
  },
  {
    id: 'RC-TRAFFIC-006',
    cause: 'Traffic spike exceeded provisioned capacity',
    category: 'PERFORMANCE',
    signals: [
      [/traffic (spike|surge)|load (spike|test)/i, 5],
      [/rate limit|throttl/i, 4],
      [/scal(e|ing) (up|out|event)/i, 3],
      [/black friday|campaign|viral|peak hour/i, 3],
      [/queue (backlog|depth)|consumer lag/i, 3],
    ],
    categories: ['PERFORMANCE', 'AVAILABILITY', 'RESOURCE'],
    verification: 'Overlay request volume with saturation metrics to confirm demand outran capacity.',
  },
  {
    id: 'RC-ATTACK-007',
    cause: 'Malicious activity or active attack',
    category: 'SECURITY',
    signals: [
      [/attack|exploit|injection|breach|hacked/i, 5],
      [/brute[- ]?force|credential stuffing|ddos/i, 5],
      [/suspicious (traffic|ip|request)/i, 4],
      [/unauthorized (access|attempt)/i, 4],
      [/malware|ransomware|backdoor/i, 5],
    ],
    categories: ['SECURITY'],
    verification: 'Correlate source IPs and user agents against the WAF log and block the offenders.',
  },
  {
    id: 'RC-CERT-008',
    cause: 'Expired certificate or TLS/DNS misconfiguration',
    category: 'NETWORK',
    signals: [
      [/certificate (expired|invalid|error)|cert expiry/i, 5],
      [/tls|ssl (error|handshake)/i, 4],
      [/dns (failure|resolution)|enotfound/i, 4],
      [/hostname mismatch/i, 3],
    ],
    categories: ['NETWORK', 'SECURITY', 'AVAILABILITY'],
    verification: 'Inspect the served chain with openssl and confirm notAfter is in the future.',
  },
  {
    id: 'RC-CODE-009',
    cause: 'Unhandled edge case in application logic',
    category: 'APPLICATION',
    signals: [
      [/unhandled|uncaught|null (pointer|reference)|undefined/i, 5],
      [/edge case|off by one|race condition/i, 4],
      [/validation (missing|failed)/i, 3],
      [/stack trace|typeerror|referenceerror/i, 4],
    ],
    categories: ['APPLICATION', 'CRASH'],
    verification: 'Reproduce with the failing input in a test and assert the guard now holds.',
  },
  {
    id: 'RC-INFRA-010',
    cause: 'Infrastructure or platform-level failure',
    category: 'AVAILABILITY',
    signals: [
      [/node (failure|drain)|host (down|failure)/i, 5],
      [/availability zone|region (outage|failure)/i, 5],
      [/kubernetes|k8s|crashloopbackoff|evicted/i, 4],
      [/load balancer|ingress/i, 3],
      [/network partition/i, 4],
    ],
    categories: ['AVAILABILITY', 'NETWORK', 'RESOURCE'],
    verification: 'Check cloud provider health plus node conditions and recent scheduling events.',
  },
]);

const DEFAULT_OPTIONS = {
  historyLimit: 500,
  maxCandidates: 5,
  strongThreshold: 75,
  moderateThreshold: 45,
  // Score at which a hypothesis is treated as carrying all the evidence it needs.
  saturationScore: 25,
};

class RootCauseEngine {
  constructor(options = {}) {
    this.name = 'RootCauseEngine';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.hypotheses = [...HYPOTHESES];
    this.analyses = new Map();
    this.history = [];

    this.stats = {
      totalAnalyses: 0,
      inconclusive: 0,
      byConsensus: { STRONG: 0, MODERATE: 0, WEAK: 0 },
      byCategory: {},
      byCause: {},
      totalConfidence: 0,
      avgConfidencePct: 0,
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [RootCauseEngine] loading causal hypothesis graph...');

    this.ready = true;
    this.startedAt = new Date();

    console.log(
      `🤫 [RootCauseEngine] ready — ${this.hypotheses.length} hypothes(es) across ${CATEGORIES.length} categories`
    );

    return this.status();
  }

  /**
   * Analyze a problem for its root cause.
   *
   * @param {object} input
   * @param {string} [input.description]
   * @param {string} [input.problemId]
   * @param {string} [input.category]   Category from intake, used as a prior.
   * @param {string} [input.severity]
   * @param {Array}  [input.findings]   Detector findings.
   * @param {object} [input.metrics]
   */
  async analyze(input = {}) {
    if (!this.ready) {
      throw new Error('RootCauseEngine.analyze called before initialize()');
    }

    if (input === null || typeof input !== 'object') {
      const error = new TypeError('analyze() requires an object payload');
      error.code = 'INVALID_PAYLOAD';
      error.statusCode = 400;
      throw error;
    }

    const startedAt = Date.now();
    const text = this._collectText(input);
    const findings = Array.isArray(input.findings) ? input.findings : [];
    const metrics = input.metrics && typeof input.metrics === 'object' ? input.metrics : {};

    if (text.trim() === '' && findings.length === 0) {
      const error = new Error('analyze() requires "description" text or detector "findings"');
      error.code = 'NOTHING_TO_ANALYZE';
      error.statusCode = 400;
      throw error;
    }

    const priorCategory = input.category ? String(input.category).toUpperCase() : null;
    const candidates = this._scoreHypotheses({ text, findings, metrics, priorCategory });
    const top = candidates[0] || null;

    const consensus = top ? this._consensus(top, candidates) : CONSENSUS.WEAK;
    const category = top ? top.category : priorCategory || 'UNCLASSIFIED';

    const analysis = {
      analysisId: `RCA-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      problemId: input.problemId || null,
      tenantId: input.tenantId || 'default',
      conclusive: Boolean(top),
      category,
      severity: input.severity ? String(input.severity).toUpperCase() : null,
      rootCause: top ? top.cause : 'Root cause could not be determined from the available signals',
      hypothesisId: top ? top.id : null,
      confidencePct: top ? top.confidencePct : 0,
      consensus,
      consensusExplanation: this._explainConsensus(consensus, top, candidates),
      evidence: top ? top.evidence : [],
      evidenceSourceCount: top ? top.sourceCount : 0,
      verification: top ? top.verification : 'Gather more telemetry: logs, metrics and a reproduction case.',
      candidates: candidates.slice(0, this.options.maxCandidates).map((candidate) => ({
        hypothesisId: candidate.id,
        cause: candidate.cause,
        category: candidate.category,
        score: candidate.score,
        confidencePct: candidate.confidencePct,
        sharePct: candidate.sharePct,
        evidenceCount: candidate.evidence.length,
      })),
      contributingFindings: findings.map((finding) => ({
        ruleId: finding.ruleId,
        category: finding.category,
        severity: finding.severity,
        title: finding.title,
      })),
      durationMs: Date.now() - startedAt,
      analyzedAt: new Date().toISOString(),
    };

    this.analyses.set(analysis.analysisId, analysis);
    this._record(analysis);

    console.log(
      `🤫 [RootCauseEngine] ${analysis.analysisId} — ${analysis.consensus} consensus, ` +
        `${analysis.confidencePct}% confidence, cause="${analysis.rootCause}"`
    );

    return analysis;
  }

  getAnalysis(analysisId) {
    return this.analyses.get(analysisId) || null;
  }

  getHistory(limit = 50) {
    return this.history.slice(0, Math.max(0, limit));
  }

  status() {
    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      hypotheses: this.hypotheses.length,
      categories: CATEGORIES,
      consensusThresholds: {
        strong: this.options.strongThreshold,
        moderate: this.options.moderateThreshold,
        saturationScore: this.options.saturationScore,
      },
      stored: this.analyses.size,
      stats: this.stats,
    };
  }

  async shutdown() {
    console.log(`🤫 [RootCauseEngine] shutting down — ${this.analyses.size} analysis record(s) retained`);
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _collectText(input) {
    const findingText = Array.isArray(input.findings)
      ? input.findings.map((finding) => `${finding.title || ''} ${finding.evidence || ''}`).join('\n')
      : '';

    return [input.description, input.title, input.log, input.stackTrace, findingText]
      .filter((part) => typeof part === 'string' && part.trim() !== '')
      .join('\n');
  }

  _scoreHypotheses({ text, findings, metrics, priorCategory }) {
    const candidates = [];

    for (const hypothesis of this.hypotheses) {
      const evidence = [];
      let score = 0;

      // Source 1: textual signals.
      for (const [pattern, weight] of hypothesis.signals) {
        const match = pattern.exec(text);
        if (match) {
          score += weight;
          evidence.push({
            source: 'TEXT_SIGNAL',
            weight,
            detail: `matched "${match[0]}"`,
          });
        }
      }

      // Source 2: detector category agreement.
      const matchingFindings = findings.filter(
        (finding) => finding.category && hypothesis.categories.includes(String(finding.category).toUpperCase())
      );
      if (matchingFindings.length > 0) {
        const weight = Math.min(10, 3 * matchingFindings.length);
        score += weight;
        evidence.push({
          source: 'DETECTOR_FINDING',
          weight,
          detail: `${matchingFindings.length} detector finding(s) in ${[
            ...new Set(matchingFindings.map((finding) => finding.category)),
          ].join(', ')}`,
        });
      }

      // Source 3: intake category prior.
      if (priorCategory && hypothesis.categories.includes(priorCategory)) {
        score += 4;
        evidence.push({
          source: 'INTAKE_CATEGORY',
          weight: 4,
          detail: `intake classified the problem as ${priorCategory}`,
        });
      }

      // Source 4: metric corroboration.
      const metricEvidence = this._metricEvidence(hypothesis, metrics);
      if (metricEvidence) {
        score += metricEvidence.weight;
        evidence.push(metricEvidence);
      }

      if (score <= 0) {
        continue;
      }

      candidates.push({
        id: hypothesis.id,
        cause: hypothesis.cause,
        category: hypothesis.category,
        verification: hypothesis.verification,
        score,
        evidence,
        sourceCount: new Set(evidence.map((item) => item.source)).size,
      });
    }

    const totalScore = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
    const ranked = [...candidates].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    return ranked.map((candidate) => {
      const bestRival = ranked.find((other) => other.id !== candidate.id);
      const rivalScore = bestRival ? bestRival.score : 0;

      // Two independent notions of confidence, blended:
      //   dominance — how far clear of the next-best hypothesis it is
      //   strength  — how much absolute evidence it accumulated
      // A plain share-of-total would punish a hypothesis just because the text
      // was rich enough to touch many other hypotheses too.
      const dominance = candidate.score / (candidate.score + rivalScore || 1);
      const strength = Math.min(1, candidate.score / this.options.saturationScore);

      return {
        ...candidate,
        sharePct: totalScore === 0 ? 0 : Number(((candidate.score / totalScore) * 100).toFixed(2)),
        confidencePct: Number(((0.6 * dominance + 0.4 * strength) * 100).toFixed(2)),
      };
    });
  }

  _metricEvidence(hypothesis, metrics) {
    const checks = [
      { metric: 'memoryPct', threshold: 85, categories: ['RESOURCE'], label: 'memory saturation' },
      { metric: 'cpuPct', threshold: 85, categories: ['RESOURCE', 'PERFORMANCE'], label: 'CPU saturation' },
      { metric: 'diskPct', threshold: 90, categories: ['RESOURCE'], label: 'disk saturation' },
      { metric: 'errorRatePct', threshold: 5, categories: ['AVAILABILITY', 'APPLICATION'], label: 'elevated error rate' },
      { metric: 'p95LatencyMs', threshold: 1000, categories: ['PERFORMANCE', 'DATA'], label: 'latency budget breach' },
      { metric: 'requestsPerSec', threshold: 1000, categories: ['PERFORMANCE'], label: 'high request volume' },
    ];

    for (const check of checks) {
      const value = metrics[check.metric];
      if (typeof value !== 'number' || Number.isNaN(value) || value < check.threshold) {
        continue;
      }
      if (!check.categories.some((category) => hypothesis.categories.includes(category))) {
        continue;
      }

      return {
        source: 'METRIC',
        weight: 5,
        detail: `${check.label} — ${check.metric}=${value} (>= ${check.threshold})`,
      };
    }

    return null;
  }

  _consensus(top, candidates) {
    const runnerUp = candidates[1];
    const margin = runnerUp ? top.score - runnerUp.score : top.score;
    const dominant = top.confidencePct >= this.options.strongThreshold;

    if (dominant && top.sourceCount >= 3 && margin >= 5) {
      return CONSENSUS.STRONG;
    }
    if (
      (top.confidencePct >= this.options.moderateThreshold && top.sourceCount >= 2) ||
      (dominant && top.sourceCount >= 2)
    ) {
      return CONSENSUS.MODERATE;
    }
    return CONSENSUS.WEAK;
  }

  _explainConsensus(consensus, top, candidates) {
    if (!top) {
      return 'No hypothesis matched the available signals.';
    }

    const runnerUp = candidates[1];
    const margin = runnerUp ? (top.score - runnerUp.score).toFixed(0) : 'n/a';

    if (consensus === CONSENSUS.STRONG) {
      return `${top.sourceCount} independent signal source(s) agree and the leading hypothesis is ahead by ${margin} point(s).`;
    }
    if (consensus === CONSENSUS.MODERATE) {
      return `${top.sourceCount} signal source(s) agree, but the margin over the next hypothesis is only ${margin} point(s) — corroborate before acting.`;
    }
    return `Only ${top.sourceCount} signal source(s) support this hypothesis; treat it as a lead, not a conclusion.`;
  }

  _record(analysis) {
    this.stats.totalAnalyses += 1;
    if (!analysis.conclusive) {
      this.stats.inconclusive += 1;
    }

    this.stats.byConsensus[analysis.consensus] = (this.stats.byConsensus[analysis.consensus] || 0) + 1;
    this.stats.byCategory[analysis.category] = (this.stats.byCategory[analysis.category] || 0) + 1;
    if (analysis.hypothesisId) {
      this.stats.byCause[analysis.hypothesisId] = (this.stats.byCause[analysis.hypothesisId] || 0) + 1;
    }

    this.stats.totalConfidence += analysis.confidencePct;
    this.stats.avgConfidencePct = Number(
      (this.stats.totalConfidence / this.stats.totalAnalyses).toFixed(2)
    );

    this.history.unshift({
      analysisId: analysis.analysisId,
      problemId: analysis.problemId,
      category: analysis.category,
      rootCause: analysis.rootCause,
      consensus: analysis.consensus,
      confidencePct: analysis.confidencePct,
      analyzedAt: analysis.analyzedAt,
    });

    if (this.history.length > this.options.historyLimit) {
      this.history.pop();
    }
  }
}

module.exports = { RootCauseEngine, HYPOTHESES, CONSENSUS, CATEGORIES };
module.exports.default = RootCauseEngine;
