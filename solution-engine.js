'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Solution Engine
 *
 * Converts a root-cause analysis into an executable remediation plan. Plans are
 * ordered, each step declares whether it is safe to automate, and `autoApply()`
 * will only execute steps marked automatable — and only for callers holding the
 * `solution:auto-apply` permission (admins and above).
 */

const { randomUUID } = require('crypto');

const RISK = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' });

const AUTO_APPLY_PERMISSION = 'solution:auto-apply';

/**
 * Playbooks keyed by root-cause hypothesis id, with a category-level fallback.
 * `automatable: false` marks steps that mutate data or need human judgement.
 */
const PLAYBOOKS = Object.freeze({
  'RC-DEPLOY-001': {
    strategy: 'Roll back to the last known-good release, then fix forward',
    risk: RISK.MEDIUM,
    estimatedMinutes: 15,
    steps: [
      { action: 'Identify the currently deployed release SHA', automatable: true, command: 'kubectl get deploy -o jsonpath="{.spec.template.spec.containers[0].image}"' },
      { action: 'Diff the current release against the last known-good release', automatable: true, command: 'git log --oneline <last-good>..<current>' },
      { action: 'Roll back the deployment', automatable: false, command: 'kubectl rollout undo deployment/<name>' },
      { action: 'Verify error rate returns to baseline for 10 minutes', automatable: true },
      { action: 'Bisect the suspect commit range and open a fix PR', automatable: false },
    ],
  },
  'RC-CONFIG-002': {
    strategy: 'Reconcile running configuration against the expected template',
    risk: RISK.LOW,
    estimatedMinutes: 10,
    steps: [
      { action: 'Dump the effective configuration of the failing instance', automatable: true },
      { action: 'Diff it against .env.example to find missing or empty keys', automatable: true },
      { action: 'Populate the missing keys in the secret store', automatable: false },
      { action: 'Restart the workload so it picks up the new configuration', automatable: false },
      { action: 'Assert the startup config validation passes', automatable: true },
    ],
  },
  'RC-RESOURCE-003': {
    strategy: 'Relieve the saturated resource, then remove the underlying leak',
    risk: RISK.MEDIUM,
    estimatedMinutes: 25,
    steps: [
      { action: 'Capture a heap snapshot / disk usage report before mitigating', automatable: true },
      { action: 'Raise the resource limit to buy headroom', automatable: false },
      { action: 'Prune reclaimable artifacts (old logs, caches, dangling images)', automatable: true },
      { action: 'Identify the top retaining path in the snapshot', automatable: true },
      { action: 'Patch the leak and add a regression guard on the metric', automatable: false },
    ],
  },
  'RC-DEPENDENCY-004': {
    strategy: 'Isolate the failing dependency and degrade gracefully',
    risk: RISK.MEDIUM,
    estimatedMinutes: 20,
    steps: [
      { action: 'Confirm the dependency is unhealthy independently of our stack', automatable: true },
      { action: 'Open the circuit breaker for the failing dependency', automatable: true },
      { action: 'Serve cached or default responses on the affected path', automatable: false },
      { action: 'Notify the vendor and subscribe to their incident channel', automatable: false },
      { action: 'Close the breaker once the dependency recovers', automatable: true },
    ],
  },
  'RC-DB-005': {
    strategy: 'Reduce contention and optimise the offending query path',
    risk: RISK.HIGH,
    estimatedMinutes: 40,
    steps: [
      { action: 'Pull the slow-query log for the incident window', automatable: true },
      { action: 'EXPLAIN the top offending queries', automatable: true },
      { action: 'Kill long-running blocking transactions', automatable: false },
      { action: 'Add the missing index in a non-blocking migration', automatable: false },
      { action: 'Verify p95 query time returns to baseline', automatable: true },
    ],
  },
  'RC-TRAFFIC-006': {
    strategy: 'Add capacity and shed non-critical load',
    risk: RISK.LOW,
    estimatedMinutes: 10,
    steps: [
      { action: 'Scale the affected tier horizontally', automatable: true },
      { action: 'Tighten rate limits on non-critical endpoints', automatable: true },
      { action: 'Warm caches for the hottest read paths', automatable: true },
      { action: 'Confirm saturation metrics fall below threshold', automatable: true },
      { action: 'Right-size the autoscaler baseline for future peaks', automatable: false },
    ],
  },
  'RC-ATTACK-007': {
    strategy: 'Contain the attacker, then close the entry point',
    risk: RISK.HIGH,
    estimatedMinutes: 45,
    steps: [
      { action: 'Snapshot logs and preserve forensic evidence', automatable: true },
      { action: 'Block the offending source IPs / user agents at the WAF', automatable: true },
      { action: 'Revoke and rotate every credential that may be compromised', automatable: false },
      { action: 'Force re-authentication for all active sessions', automatable: false },
      { action: 'Patch the exploited vector and add a detection rule', automatable: false },
      { action: 'File the incident report and notify the security officer', automatable: false },
    ],
  },
  'RC-CERT-008': {
    strategy: 'Re-issue the certificate and repair the trust chain',
    risk: RISK.LOW,
    estimatedMinutes: 15,
    steps: [
      { action: 'Inspect the served chain and read notAfter', automatable: true, command: 'openssl s_client -connect <host>:443 | openssl x509 -noout -dates' },
      { action: 'Re-issue the certificate via ACME', automatable: true },
      { action: 'Deploy the new chain to every terminating edge', automatable: false },
      { action: 'Verify TLS from an external probe', automatable: true },
      { action: 'Enable auto-renew with a 30-day expiry alert', automatable: true },
    ],
  },
  'RC-CODE-009': {
    strategy: 'Guard the unhandled path and cover it with a test',
    risk: RISK.LOW,
    estimatedMinutes: 30,
    steps: [
      { action: 'Extract the failing input from the stack trace', automatable: true },
      { action: 'Write a failing test that reproduces the crash', automatable: false },
      { action: 'Add the missing validation or null guard', automatable: false },
      { action: 'Ship the fix behind the normal release process', automatable: false },
      { action: 'Confirm the exception count drops to zero', automatable: true },
    ],
  },
  'RC-INFRA-010': {
    strategy: 'Drain the unhealthy infrastructure and fail over',
    risk: RISK.HIGH,
    estimatedMinutes: 30,
    steps: [
      { action: 'Check provider health and node conditions', automatable: true },
      { action: 'Cordon and drain the unhealthy nodes', automatable: false },
      { action: 'Shift traffic to a healthy zone or region', automatable: false },
      { action: 'Verify replica counts are satisfied post-failover', automatable: true },
      { action: 'Replace the failed capacity and rebalance', automatable: false },
    ],
  },
});

const CATEGORY_FALLBACKS = Object.freeze({
  SECURITY: 'RC-ATTACK-007',
  PERFORMANCE: 'RC-TRAFFIC-006',
  AVAILABILITY: 'RC-DEPENDENCY-004',
  RESOURCE: 'RC-RESOURCE-003',
  CRASH: 'RC-CODE-009',
  DATA: 'RC-DB-005',
  NETWORK: 'RC-CERT-008',
  APPLICATION: 'RC-DEPLOY-001',
  CONFIGURATION: 'RC-CONFIG-002',
});

const GENERIC_PLAYBOOK = Object.freeze({
  strategy: 'Gather more evidence before mutating production',
  risk: RISK.LOW,
  estimatedMinutes: 20,
  steps: [
    { action: 'Increase log verbosity on the affected component', automatable: true },
    { action: 'Capture a metrics snapshot across the incident window', automatable: true },
    { action: 'Attempt a controlled reproduction in staging', automatable: false },
    { action: 'Re-run diagnostics once new telemetry is available', automatable: true },
  ],
});

const DEFAULT_OPTIONS = {
  historyLimit: 500,
  autoApplyMinConfidencePct: 60,
  autoApplyMaxRisk: RISK.MEDIUM,
};

const RISK_RANK = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });

class SolutionEngine {
  constructor(options = {}) {
    this.name = 'SolutionEngine';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.solutions = new Map();
    this.history = [];

    this.stats = {
      totalGenerated: 0,
      autoApplied: 0,
      autoApplyDenied: 0,
      manuallyApplied: 0,
      succeeded: 0,
      failed: 0,
      stepsExecuted: 0,
      stepsSkipped: 0,
      byStrategy: {},
      byRisk: { LOW: 0, MEDIUM: 0, HIGH: 0 },
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [SolutionEngine] loading remediation playbooks...');

    this.ready = true;
    this.startedAt = new Date();

    console.log(
      `🤫 [SolutionEngine] ready — ${Object.keys(PLAYBOOKS).length} playbook(s), ` +
        `autoApply<=${this.options.autoApplyMaxRisk} risk`
    );

    return this.status();
  }

  /**
   * Build a remediation plan from a root-cause analysis.
   *
   * @param {object} analysis Output of `RootCauseEngine.analyze()`.
   * @param {object} [context]
   * @param {object} [context.user] Caller, used to decide auto-apply eligibility.
   */
  async generateSolution(analysis = {}, context = {}) {
    if (!this.ready) {
      throw new Error('SolutionEngine.generateSolution called before initialize()');
    }

    if (analysis === null || typeof analysis !== 'object') {
      const error = new TypeError('generateSolution() requires the root-cause analysis object');
      error.code = 'INVALID_PAYLOAD';
      error.statusCode = 400;
      throw error;
    }

    const category = analysis.category ? String(analysis.category).toUpperCase() : 'UNCLASSIFIED';
    const playbookId =
      (analysis.hypothesisId && PLAYBOOKS[analysis.hypothesisId] && analysis.hypothesisId) ||
      CATEGORY_FALLBACKS[category] ||
      null;

    const playbook = playbookId ? PLAYBOOKS[playbookId] : GENERIC_PLAYBOOK;
    const confidencePct = Number.isFinite(analysis.confidencePct) ? analysis.confidencePct : 0;
    const consensus = analysis.consensus || 'WEAK';

    const steps = playbook.steps.map((step, index) => ({
      order: index + 1,
      action: step.action,
      command: step.command || null,
      automatable: Boolean(step.automatable),
      status: 'PENDING',
    }));

    const eligibility = this._autoApplyEligibility({
      risk: playbook.risk,
      confidencePct,
      consensus,
      user: context.user,
    });

    const solution = {
      solutionId: `SOL-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      problemId: analysis.problemId || null,
      analysisId: analysis.analysisId || null,
      tenantId: analysis.tenantId || 'default',
      playbookId: playbookId || 'GENERIC',
      rootCause: analysis.rootCause || 'unknown',
      category,
      strategy: playbook.strategy,
      risk: playbook.risk,
      estimatedMinutes: playbook.estimatedMinutes,
      sourceConfidencePct: confidencePct,
      sourceConsensus: consensus,
      steps,
      automatableSteps: steps.filter((step) => step.automatable).length,
      manualSteps: steps.filter((step) => !step.automatable).length,
      autoApplyEligible: eligibility.eligible,
      autoApplyBlockers: eligibility.blockers,
      status: 'PROPOSED',
      generatedAt: new Date().toISOString(),
    };

    this.solutions.set(solution.solutionId, solution);
    this._recordGeneration(solution);

    console.log(
      `🤫 [SolutionEngine] ${solution.solutionId} — playbook=${solution.playbookId} ` +
        `risk=${solution.risk} steps=${steps.length} autoApply=${solution.autoApplyEligible}`
    );

    return solution;
  }

  /**
   * Execute the automatable steps of a solution.
   *
   * Requires a user holding `solution:auto-apply` (ADMIN / SUPER_ADMIN).
   * Non-automatable steps are always left for a human and reported as SKIPPED.
   *
   * @param {string} solutionId
   * @param {object} user Caller with `role` and/or `permissions`.
   */
  async autoApply(solutionId, user = {}) {
    if (!this.ready) {
      throw new Error('SolutionEngine.autoApply called before initialize()');
    }

    const solution = this.solutions.get(solutionId);
    if (!solution) {
      const error = new Error(`Unknown solutionId "${solutionId}"`);
      error.code = 'SOLUTION_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    if (!this._canAutoApply(user)) {
      this.stats.autoApplyDenied += 1;
      const error = new Error(`Auto-apply requires the "${AUTO_APPLY_PERMISSION}" permission`);
      error.code = 'AUTO_APPLY_FORBIDDEN';
      error.statusCode = 403;
      console.log(
        `🤫 [SolutionEngine] auto-apply DENIED for ${solutionId} — user=${user.email || user.userId || 'anonymous'}`
      );
      throw error;
    }

    const eligibility = this._autoApplyEligibility({
      risk: solution.risk,
      confidencePct: solution.sourceConfidencePct,
      consensus: solution.sourceConsensus,
      user,
    });

    if (!eligibility.eligible) {
      this.stats.autoApplyDenied += 1;
      const error = new Error(`Solution is not auto-apply eligible: ${eligibility.blockers.join('; ')}`);
      error.code = 'AUTO_APPLY_NOT_ELIGIBLE';
      error.statusCode = 409;
      throw error;
    }

    solution.status = 'APPLYING';
    const startedAt = Date.now();
    const executed = [];
    const skipped = [];

    for (const step of solution.steps) {
      if (!step.automatable) {
        step.status = 'SKIPPED_MANUAL';
        skipped.push(step.order);
        this.stats.stepsSkipped += 1;
        continue;
      }

      try {
        await this._executeStep(solution, step);
        step.status = 'DONE';
        step.executedAt = new Date().toISOString();
        executed.push(step.order);
        this.stats.stepsExecuted += 1;
      } catch (error) {
        step.status = 'FAILED';
        step.error = error.message;
        solution.status = 'FAILED';
        solution.failedAt = new Date().toISOString();
        this.stats.failed += 1;

        console.log(`🤫 [SolutionEngine] ${solutionId} step ${step.order} failed: ${error.message}`);

        this._recordApplication(solution, {
          appliedBy: user.email || user.userId || 'system',
          mode: 'AUTO',
          ok: false,
          executed,
          skipped,
          durationMs: Date.now() - startedAt,
        });

        const failure = new Error(`Auto-apply failed at step ${step.order}: ${error.message}`);
        failure.code = 'AUTO_APPLY_STEP_FAILED';
        failure.statusCode = 500;
        failure.solutionId = solutionId;
        throw failure;
      }
    }

    solution.status = skipped.length > 0 ? 'PARTIALLY_APPLIED' : 'APPLIED';
    solution.appliedAt = new Date().toISOString();
    solution.appliedBy = user.email || user.userId || 'system';
    solution.appliedMode = 'AUTO';

    this.stats.autoApplied += 1;
    this.stats.succeeded += 1;

    const report = {
      solutionId,
      status: solution.status,
      executedSteps: executed,
      skippedSteps: skipped,
      remainingManualSteps: solution.steps.filter((step) => step.status === 'SKIPPED_MANUAL').map((step) => ({
        order: step.order,
        action: step.action,
      })),
      durationMs: Date.now() - startedAt,
      appliedBy: solution.appliedBy,
      appliedAt: solution.appliedAt,
    };

    this._recordApplication(solution, {
      appliedBy: solution.appliedBy,
      mode: 'AUTO',
      ok: true,
      executed,
      skipped,
      durationMs: report.durationMs,
    });

    console.log(
      `🤫 [SolutionEngine] ${solutionId} ${solution.status} — ` +
        `${executed.length} step(s) executed, ${skipped.length} left for a human`
    );

    return report;
  }

  /** Record that a human applied the plan, with the observed outcome. */
  markApplied(solutionId, { appliedBy = 'operator', successful = true, note = null } = {}) {
    const solution = this.solutions.get(solutionId);
    if (!solution) {
      const error = new Error(`Unknown solutionId "${solutionId}"`);
      error.code = 'SOLUTION_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    solution.status = successful ? 'APPLIED' : 'FAILED';
    solution.appliedAt = new Date().toISOString();
    solution.appliedBy = appliedBy;
    solution.appliedMode = 'MANUAL';
    solution.note = note;

    this.stats.manuallyApplied += 1;
    if (successful) {
      this.stats.succeeded += 1;
    } else {
      this.stats.failed += 1;
    }

    this._recordApplication(solution, {
      appliedBy,
      mode: 'MANUAL',
      ok: successful,
      executed: [],
      skipped: [],
      durationMs: 0,
    });

    console.log(`🤫 [SolutionEngine] ${solutionId} marked ${solution.status} by ${appliedBy}`);
    return solution;
  }

  getSolution(solutionId) {
    return this.solutions.get(solutionId) || null;
  }

  getHistory(limit = 50) {
    return this.history.slice(0, Math.max(0, limit));
  }

  /** Success rate across every applied solution. */
  successRate() {
    const applied = this.stats.succeeded + this.stats.failed;
    return applied === 0 ? 100 : Number(((this.stats.succeeded / applied) * 100).toFixed(2));
  }

  status() {
    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      playbooks: Object.keys(PLAYBOOKS).length,
      autoApply: {
        permission: AUTO_APPLY_PERMISSION,
        minConfidencePct: this.options.autoApplyMinConfidencePct,
        maxRisk: this.options.autoApplyMaxRisk,
      },
      stored: this.solutions.size,
      successRatePct: this.successRate(),
      stats: this.stats,
    };
  }

  async shutdown() {
    console.log(`🤫 [SolutionEngine] shutting down — ${this.solutions.size} solution(s) retained`);
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _canAutoApply(user) {
    if (!user || typeof user !== 'object') {
      return false;
    }
    if (Array.isArray(user.permissions) && user.permissions.includes(AUTO_APPLY_PERMISSION)) {
      return true;
    }
    return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  }

  _autoApplyEligibility({ risk, confidencePct, consensus, user }) {
    const blockers = [];

    if (RISK_RANK[risk] > RISK_RANK[this.options.autoApplyMaxRisk]) {
      blockers.push(`risk ${risk} exceeds the auto-apply ceiling ${this.options.autoApplyMaxRisk}`);
    }
    if (confidencePct < this.options.autoApplyMinConfidencePct) {
      blockers.push(
        `confidence ${confidencePct}% is below the ${this.options.autoApplyMinConfidencePct}% threshold`
      );
    }
    if (consensus === 'WEAK') {
      blockers.push('root-cause consensus is WEAK');
    }
    if (!this._canAutoApply(user)) {
      blockers.push(`caller lacks the "${AUTO_APPLY_PERMISSION}" permission`);
    }

    return { eligible: blockers.length === 0, blockers };
  }

  /**
   * Perform a single automatable step.
   *
   * Steps are intentionally simulated rather than shelling out: the platform
   * ships the plan, and the execution backend is wired per-deployment. Override
   * `options.stepExecutor` to bind a real runner.
   */
  async _executeStep(solution, step) {
    if (typeof this.options.stepExecutor === 'function') {
      return this.options.stepExecutor({ solution, step });
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
    return { simulated: true, action: step.action };
  }

  _recordGeneration(solution) {
    this.stats.totalGenerated += 1;
    this.stats.byRisk[solution.risk] = (this.stats.byRisk[solution.risk] || 0) + 1;
    this.stats.byStrategy[solution.playbookId] = (this.stats.byStrategy[solution.playbookId] || 0) + 1;

    this.history.unshift({
      solutionId: solution.solutionId,
      problemId: solution.problemId,
      playbookId: solution.playbookId,
      category: solution.category,
      risk: solution.risk,
      status: solution.status,
      generatedAt: solution.generatedAt,
    });

    if (this.history.length > this.options.historyLimit) {
      this.history.pop();
    }
  }

  _recordApplication(solution, detail) {
    const entry = this.history.find((item) => item.solutionId === solution.solutionId);
    if (entry) {
      entry.status = solution.status;
      entry.appliedBy = detail.appliedBy;
      entry.mode = detail.mode;
      entry.ok = detail.ok;
      entry.durationMs = detail.durationMs;
      entry.appliedAt = new Date().toISOString();
    }
  }
}

module.exports = { SolutionEngine, PLAYBOOKS, RISK, AUTO_APPLY_PERMISSION };
module.exports.default = SolutionEngine;
