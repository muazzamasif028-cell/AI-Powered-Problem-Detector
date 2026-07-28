'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Basic Detector
 *
 * Pattern-matching detector layer. Runs a rule set over a problem record (or
 * raw text plus metrics) and raises alerts with severity levels. Alerts are
 * deduplicated by fingerprint so a flapping condition produces one alert with
 * an incrementing occurrence count rather than thousands of rows.
 */

const { createHash, randomUUID } = require('crypto');

const SEVERITY_RANK = Object.freeze({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 });

/**
 * Detection rules. `pattern` matches the text; `metric` rules evaluate numeric
 * telemetry. Each rule carries the remediation hint used downstream by the
 * solution engine.
 */
const RULES = Object.freeze([
  {
    id: 'SEC-SQLI-001',
    category: 'SECURITY',
    severity: 'CRITICAL',
    title: 'Possible SQL injection attempt',
    pattern: /(\bunion\s+select\b|\bor\s+1\s*=\s*1\b|;\s*drop\s+table\b|sql\s*injection)/i,
    remediation: 'Parameterize all queries and audit recent DB access logs for the affected endpoint.',
  },
  {
    id: 'SEC-XSS-002',
    category: 'SECURITY',
    severity: 'HIGH',
    title: 'Cross-site scripting indicator',
    pattern: /(<script\b|javascript:\s*|onerror\s*=|\bxss\b)/i,
    remediation: 'Escape user-controlled output and enable a strict Content-Security-Policy.',
  },
  {
    id: 'SEC-AUTH-003',
    category: 'SECURITY',
    severity: 'HIGH',
    title: 'Authentication or authorization failure burst',
    pattern: /(unauthorized|forbidden|401|403|invalid token|jwt (expired|malformed)|brute\s?force)/i,
    remediation: 'Rotate affected credentials, verify token TTLs and rate-limit the auth endpoints.',
  },
  {
    id: 'SEC-SECRET-004',
    category: 'SECURITY',
    severity: 'CRITICAL',
    title: 'Potential secret exposure',
    pattern: /(api[_-]?key\s*[:=]\s*\S{8,}|secret\s*[:=]\s*\S{8,}|BEGIN (RSA|OPENSSH) PRIVATE KEY|credential leak)/i,
    remediation: 'Revoke the exposed credential immediately, then purge it from logs and history.',
  },
  {
    id: 'AVL-OUTAGE-010',
    category: 'AVAILABILITY',
    severity: 'CRITICAL',
    title: 'Service outage detected',
    pattern: /(outage|service (is )?down|unreachable|connection refused|502|503|504)/i,
    remediation: 'Check upstream health, failover to a healthy region and verify load-balancer targets.',
  },
  {
    id: 'AVL-HEALTH-011',
    category: 'AVAILABILITY',
    severity: 'HIGH',
    title: 'Health check failing',
    pattern: /(health ?check (failing|failed)|readiness probe|liveness probe|unhealthy)/i,
    remediation: 'Inspect probe thresholds and dependency readiness before restarting the workload.',
  },
  {
    id: 'PRF-LATENCY-020',
    category: 'PERFORMANCE',
    severity: 'MEDIUM',
    title: 'Elevated latency',
    pattern: /(high latency|slow response|p9[59]|response time|takes too long|timeout)/i,
    remediation: 'Profile the slow path, add indexes or caching, and review downstream call fan-out.',
  },
  {
    id: 'PRF-QUEUE-021',
    category: 'PERFORMANCE',
    severity: 'HIGH',
    title: 'Queue backlog growing',
    pattern: /(queue (backlog|depth)|messages? piling|consumer lag|backpressure)/i,
    remediation: 'Scale consumers horizontally and confirm no poison message is blocking the head.',
  },
  {
    id: 'RES-OOM-030',
    category: 'RESOURCE',
    severity: 'CRITICAL',
    title: 'Memory exhaustion',
    pattern: /(out of memory|oom(killed)?|memory leak|heap (out of|limit))/i,
    remediation: 'Capture a heap snapshot, raise the memory limit temporarily and fix the retaining path.',
  },
  {
    id: 'RES-DISK-031',
    category: 'RESOURCE',
    severity: 'HIGH',
    title: 'Disk pressure',
    pattern: /(disk (is )?full|no space left|enospc|storage (full|exhausted))/i,
    remediation: 'Rotate and ship logs off-box, prune caches and expand the volume.',
  },
  {
    id: 'RES-FD-032',
    category: 'RESOURCE',
    severity: 'HIGH',
    title: 'File descriptor / socket exhaustion',
    pattern: /(too many open files|emfile|file descriptor|socket exhaust)/i,
    remediation: 'Raise the ulimit and close leaked handles — check for unclosed HTTP agents.',
  },
  {
    id: 'CRS-FATAL-040',
    category: 'CRASH',
    severity: 'CRITICAL',
    title: 'Process crash',
    pattern: /(segfault|segmentation fault|core dump|panic:|fatal error|crashloopbackoff|process exited)/i,
    remediation: 'Symbolize the crash dump, pin the failing frame and add a guard around the entry path.',
  },
  {
    id: 'CRS-UNHANDLED-041',
    category: 'CRASH',
    severity: 'HIGH',
    title: 'Unhandled exception or rejection',
    pattern: /(unhandled (rejection|exception)|uncaught (exception|typeerror)|stack trace)/i,
    remediation: 'Attach process-level handlers and wrap the failing async boundary in try/catch.',
  },
  {
    id: 'DAT-CORRUPT-050',
    category: 'DATA',
    severity: 'CRITICAL',
    title: 'Data corruption or loss',
    pattern: /(data (loss|corrupt)|corrupted (row|record|index)|checksum mismatch)/i,
    remediation: 'Freeze writes, restore from the last verified snapshot and run an integrity check.',
  },
  {
    id: 'DAT-DEADLOCK-051',
    category: 'DATA',
    severity: 'HIGH',
    title: 'Database contention',
    pattern: /(deadlock|lock wait timeout|replication lag|transaction aborted)/i,
    remediation: 'Shorten transactions, order writes consistently and review isolation level.',
  },
  {
    id: 'NET-DNS-060',
    category: 'NETWORK',
    severity: 'HIGH',
    title: 'DNS or TLS failure',
    pattern: /(dns (failure|resolution)|enotfound|certificate (expired|invalid)|tls handshake|ssl error)/i,
    remediation: 'Verify certificate expiry and resolver configuration, then re-issue if needed.',
  },
  {
    id: 'APP-REGRESSION-070',
    category: 'APPLICATION',
    severity: 'MEDIUM',
    title: 'Application regression',
    pattern: /(regression|worked (before|yesterday)|after (the )?(deploy|release)|broken since)/i,
    remediation: 'Diff the last release, bisect the suspect commit range and prepare a rollback.',
  },
  {
    id: 'APP-NOTFOUND-071',
    category: 'APPLICATION',
    severity: 'LOW',
    title: 'Missing resource',
    pattern: /(404|not found|broken link|missing (asset|route|page))/i,
    remediation: 'Add the missing route or redirect, and monitor for referrer-driven 404 spikes.',
  },
]);

const METRIC_RULES = Object.freeze([
  {
    id: 'MET-CPU-100',
    category: 'RESOURCE',
    metric: 'cpuPct',
    severity: 'HIGH',
    threshold: 90,
    compare: 'gte',
    title: 'CPU utilization critical',
    remediation: 'Scale out or profile the hot loop consuming CPU.',
  },
  {
    id: 'MET-MEM-101',
    category: 'RESOURCE',
    metric: 'memoryPct',
    severity: 'HIGH',
    threshold: 90,
    compare: 'gte',
    title: 'Memory utilization critical',
    remediation: 'Raise the memory ceiling and investigate retained objects.',
  },
  {
    id: 'MET-DISK-102',
    category: 'RESOURCE',
    metric: 'diskPct',
    severity: 'CRITICAL',
    threshold: 95,
    compare: 'gte',
    title: 'Disk almost full',
    remediation: 'Free space immediately — expand the volume and prune old artifacts.',
  },
  {
    id: 'MET-ERR-103',
    category: 'AVAILABILITY',
    metric: 'errorRatePct',
    severity: 'CRITICAL',
    threshold: 5,
    compare: 'gte',
    title: 'Error rate above SLO',
    remediation: 'Roll back the latest deploy and drain the unhealthy instances.',
  },
  {
    id: 'MET-LAT-104',
    category: 'PERFORMANCE',
    metric: 'p95LatencyMs',
    severity: 'MEDIUM',
    threshold: 1000,
    compare: 'gte',
    title: 'p95 latency above budget',
    remediation: 'Cache the hot read path and reduce sequential downstream calls.',
  },
  {
    id: 'MET-AVAIL-105',
    category: 'AVAILABILITY',
    metric: 'availabilityPct',
    severity: 'CRITICAL',
    threshold: 99,
    compare: 'lt',
    title: 'Availability below SLO',
    remediation: 'Fail over to a healthy region and open an incident.',
  },
]);

const DEFAULT_OPTIONS = {
  alertHistoryLimit: 1000,
  dedupeWindowMs: 5 * 60 * 1000,
  minSeverity: 'INFO',
};

class BasicDetector {
  constructor(options = {}) {
    this.name = 'BasicDetector';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.rules = [...RULES];
    this.metricRules = [...METRIC_RULES];

    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.fingerprintIndex = new Map();

    this.stats = {
      totalDetections: 0,
      totalMatches: 0,
      alertsRaised: 0,
      alertsDeduped: 0,
      alertsResolved: 0,
      cleanRuns: 0,
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
      byCategory: {},
      byRule: {},
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [BasicDetector] loading detection rules...');

    this.ready = true;
    this.startedAt = new Date();

    console.log(
      `🤫 [BasicDetector] ready — ${this.rules.length} pattern rule(s), ` +
        `${this.metricRules.length} metric rule(s)`
    );

    return this.status();
  }

  /**
   * Run detection over a problem record or raw input.
   *
   * @param {object} input
   * @param {string} [input.description] Free text to scan.
   * @param {string} [input.problemId]
   * @param {object} [input.metrics]     Numeric telemetry, e.g. `{ cpuPct: 97 }`.
   * @param {string} [input.tenantId]
   */
  async detect(input = {}) {
    if (!this.ready) {
      throw new Error('BasicDetector.detect called before initialize()');
    }

    if (input === null || typeof input !== 'object') {
      const error = new TypeError('detect() requires an object payload');
      error.code = 'INVALID_PAYLOAD';
      error.statusCode = 400;
      throw error;
    }

    const startedAt = Date.now();
    const text = this._collectText(input);
    const metrics = input.metrics && typeof input.metrics === 'object' ? input.metrics : {};

    if (text.trim() === '' && Object.keys(metrics).length === 0) {
      const error = new Error('detect() requires "description" text or a "metrics" object');
      error.code = 'NOTHING_TO_SCAN';
      error.statusCode = 400;
      throw error;
    }

    const detectionId = `DET-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const findings = [
      ...this._matchPatterns(text),
      ...this._matchMetrics(metrics),
    ].filter((finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[this.options.minSeverity]);

    const alerts = findings.map((finding) =>
      this._raiseAlert({
        finding,
        detectionId,
        problemId: input.problemId || null,
        tenantId: input.tenantId || 'default',
      })
    );

    const highest = findings.reduce(
      (worst, finding) => (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[worst] ? finding.severity : worst),
      'INFO'
    );

    this.stats.totalDetections += 1;
    this.stats.totalMatches += findings.length;
    if (findings.length === 0) {
      this.stats.cleanRuns += 1;
    }

    const result = {
      detectionId,
      problemId: input.problemId || null,
      tenantId: input.tenantId || 'default',
      detector: this.name,
      clean: findings.length === 0,
      findingCount: findings.length,
      highestSeverity: highest,
      categories: [...new Set(findings.map((finding) => finding.category))],
      findings,
      alerts,
      durationMs: Date.now() - startedAt,
      detectedAt: new Date().toISOString(),
    };

    console.log(
      `🤫 [BasicDetector] ${detectionId} — ${findings.length} finding(s), ` +
        `highest=${highest}, ${result.durationMs}ms`
    );

    return result;
  }

  /** Currently unresolved alerts, worst severity first. */
  getActiveAlerts(filter = {}) {
    let alerts = [...this.activeAlerts.values()];

    if (filter.severity) {
      const wanted = String(filter.severity).toUpperCase();
      alerts = alerts.filter((alert) => alert.severity === wanted);
    }
    if (filter.category) {
      const wanted = String(filter.category).toUpperCase();
      alerts = alerts.filter((alert) => alert.category === wanted);
    }
    if (filter.tenantId) {
      alerts = alerts.filter((alert) => alert.tenantId === filter.tenantId);
    }
    if (filter.minSeverity) {
      const floor = SEVERITY_RANK[String(filter.minSeverity).toUpperCase()] ?? 0;
      alerts = alerts.filter((alert) => SEVERITY_RANK[alert.severity] >= floor);
    }

    return alerts.sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        new Date(b.lastSeenAt) - new Date(a.lastSeenAt)
    );
  }

  getAlert(alertId) {
    return this.activeAlerts.get(alertId) || this.alertHistory.find((alert) => alert.alertId === alertId) || null;
  }

  /**
   * Resolve an alert.
   *
   * @param {string} alertId
   * @param {object} [resolution]
   * @param {string} [resolution.resolvedBy]
   * @param {string} [resolution.note]
   */
  resolveAlert(alertId, resolution = {}) {
    const alert = this.activeAlerts.get(alertId);

    if (!alert) {
      const error = new Error(`No active alert with id "${alertId}"`);
      error.code = 'ALERT_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolution.resolvedBy || 'system';
    alert.resolutionNote = resolution.note || null;
    alert.timeToResolveMs = new Date(alert.resolvedAt) - new Date(alert.firstSeenAt);

    this.activeAlerts.delete(alertId);
    this.fingerprintIndex.delete(alert.fingerprint);
    this.stats.alertsResolved += 1;

    console.log(`🤫 [BasicDetector] alert ${alertId} resolved by ${alert.resolvedBy}`);

    return alert;
  }

  resolveAllForCategory(category, resolution = {}) {
    const wanted = String(category).toUpperCase();
    const resolved = this.getActiveAlerts({ category: wanted }).map((alert) =>
      this.resolveAlert(alert.alertId, resolution)
    );

    console.log(`🤫 [BasicDetector] resolved ${resolved.length} alert(s) in category=${wanted}`);
    return resolved;
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(0, Math.max(0, limit));
  }

  status() {
    const active = [...this.activeAlerts.values()];

    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      rules: { pattern: this.rules.length, metric: this.metricRules.length },
      alerts: {
        active: active.length,
        critical: active.filter((alert) => alert.severity === 'CRITICAL').length,
        high: active.filter((alert) => alert.severity === 'HIGH').length,
        medium: active.filter((alert) => alert.severity === 'MEDIUM').length,
        low: active.filter((alert) => alert.severity === 'LOW').length,
      },
      stats: this.stats,
    };
  }

  async shutdown() {
    console.log(`🤫 [BasicDetector] shutting down — ${this.activeAlerts.size} active alert(s)`);
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _collectText(input) {
    return [input.description, input.title, input.log, input.stackTrace, input.message]
      .filter((part) => typeof part === 'string')
      .join('\n');
  }

  _matchPatterns(text) {
    if (text.trim() === '') {
      return [];
    }

    const findings = [];

    for (const rule of this.rules) {
      const match = rule.pattern.exec(text);
      if (!match) {
        continue;
      }

      findings.push({
        ruleId: rule.id,
        type: 'PATTERN',
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        evidence: this._snippet(text, match.index, match[0].length),
        matched: match[0],
        remediation: rule.remediation,
      });
    }

    return findings;
  }

  _matchMetrics(metrics) {
    const findings = [];

    for (const rule of this.metricRules) {
      const value = metrics[rule.metric];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        continue;
      }

      const breached = rule.compare === 'lt' ? value < rule.threshold : value >= rule.threshold;
      if (!breached) {
        continue;
      }

      findings.push({
        ruleId: rule.id,
        type: 'METRIC',
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        evidence: `${rule.metric}=${value} (threshold ${rule.compare === 'lt' ? '<' : '>='} ${rule.threshold})`,
        matched: `${rule.metric}=${value}`,
        remediation: rule.remediation,
      });
    }

    return findings;
  }

  _raiseAlert({ finding, detectionId, problemId, tenantId }) {
    const fingerprint = createHash('sha1')
      .update([tenantId, finding.ruleId, finding.matched].join('|'))
      .digest('hex')
      .slice(0, 16);

    const existingId = this.fingerprintIndex.get(fingerprint);
    const now = new Date().toISOString();

    if (existingId && this.activeAlerts.has(existingId)) {
      const alert = this.activeAlerts.get(existingId);
      alert.occurrences += 1;
      alert.lastSeenAt = now;
      alert.detectionIds.push(detectionId);
      if (alert.detectionIds.length > 50) {
        alert.detectionIds.shift();
      }

      this.stats.alertsDeduped += 1;
      return { ...alert, deduped: true };
    }

    const alert = {
      alertId: `ALT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      fingerprint,
      ruleId: finding.ruleId,
      type: finding.type,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      evidence: finding.evidence,
      remediation: finding.remediation,
      problemId,
      tenantId,
      detectionIds: [detectionId],
      occurrences: 1,
      status: 'ACTIVE',
      firstSeenAt: now,
      lastSeenAt: now,
    };

    this.activeAlerts.set(alert.alertId, alert);
    this.fingerprintIndex.set(fingerprint, alert.alertId);

    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.options.alertHistoryLimit) {
      this.alertHistory.pop();
    }

    this.stats.alertsRaised += 1;
    this.stats.bySeverity[finding.severity] = (this.stats.bySeverity[finding.severity] || 0) + 1;
    this.stats.byCategory[finding.category] = (this.stats.byCategory[finding.category] || 0) + 1;
    this.stats.byRule[finding.ruleId] = (this.stats.byRule[finding.ruleId] || 0) + 1;

    console.log(
      `🤫 [BasicDetector] ALERT ${alert.alertId} [${alert.severity}] ${alert.ruleId} — ${alert.title}`
    );

    return { ...alert, deduped: false };
  }

  _snippet(text, index, length, padding = 60) {
    const start = Math.max(0, index - padding);
    const end = Math.min(text.length, index + length + padding);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';
    return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
  }
}

module.exports = { BasicDetector, RULES, METRIC_RULES, SEVERITY_RANK };
module.exports.default = BasicDetector;
