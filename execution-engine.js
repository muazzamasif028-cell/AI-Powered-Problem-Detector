'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Core Processing Engine
 *
 * Central execution surface for the platform. Every diagnostic run in the
 * system is funnelled through `execute()` so that concurrency limits,
 * timeouts, retries and performance metrics are enforced in exactly one place.
 */

const { randomUUID } = require('crypto');

const DEFAULT_OPTIONS = {
  maxConcurrency: 64,
  defaultTimeoutMs: 30000,
  maxRetries: 2,
  retryBackoffMs: 250,
  historyLimit: 500,
  slowRunThresholdMs: 2500,
};

class CoreProcessingEngine {
  constructor(options = {}) {
    this.name = 'CoreProcessingEngine';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.activeRuns = new Map();
    this.queue = [];
    this.history = [];

    this.metrics = {
      totalRuns: 0,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
      retried: 0,
      rejected: 0,
      slowRuns: 0,
      totalDurationMs: 0,
      minDurationMs: null,
      maxDurationMs: 0,
      durations: [],
      byTask: {},
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [CoreProcessingEngine] initializing execution engine...');

    this.startedAt = new Date();
    this.ready = true;

    console.log(
      `🤫 [CoreProcessingEngine] ready — maxConcurrency=${this.options.maxConcurrency} ` +
        `timeout=${this.options.defaultTimeoutMs}ms retries=${this.options.maxRetries}`
    );

    return this.status();
  }

  /**
   * Run a task through the engine.
   *
   * @param {object} spec
   * @param {string} spec.task        Logical task name, used for per-task metrics.
   * @param {Function} spec.handler   Async function receiving `(context)`.
   * @param {object}  [spec.payload]  Arbitrary payload handed to the handler.
   * @param {number}  [spec.timeoutMs]
   * @param {number}  [spec.retries]
   */
  async execute(spec = {}) {
    if (!this.ready) {
      throw new Error('CoreProcessingEngine.execute called before initialize()');
    }

    const { task, handler, payload = {}, timeoutMs, retries } = spec;

    if (typeof task !== 'string' || task.trim() === '') {
      throw new TypeError('execute() requires a non-empty "task" string');
    }
    if (typeof handler !== 'function') {
      throw new TypeError(`execute("${task}") requires a "handler" function`);
    }

    if (this.activeRuns.size >= this.options.maxConcurrency) {
      this.metrics.rejected += 1;
      const error = new Error(
        `Engine saturated: ${this.activeRuns.size}/${this.options.maxConcurrency} runs in flight`
      );
      error.code = 'ENGINE_SATURATED';
      error.statusCode = 503;
      throw error;
    }

    const runId = randomUUID();
    const effectiveTimeout = Number.isFinite(timeoutMs) ? timeoutMs : this.options.defaultTimeoutMs;
    const maxAttempts = (Number.isFinite(retries) ? retries : this.options.maxRetries) + 1;

    const run = { runId, task, startedAt: Date.now() };
    this.activeRuns.set(runId, run);
    this.metrics.totalRuns += 1;

    const taskMetrics = this._taskMetrics(task);
    taskMetrics.runs += 1;

    let attempt = 0;
    let lastError = null;

    try {
      while (attempt < maxAttempts) {
        attempt += 1;

        if (attempt > 1) {
          this.metrics.retried += 1;
          taskMetrics.retried += 1;
          await this._sleep(this.options.retryBackoffMs * (attempt - 1));
          console.log(`🤫 [CoreProcessingEngine] retry ${attempt - 1} for task="${task}" run=${runId}`);
        }

        try {
          const result = await this._withTimeout(
            handler({ runId, task, payload, attempt, engine: this }),
            effectiveTimeout,
            task
          );

          const durationMs = Date.now() - run.startedAt;
          this._recordSuccess(task, durationMs);
          this._pushHistory({ runId, task, ok: true, attempt, durationMs });

          return {
            ok: true,
            runId,
            task,
            attempt,
            durationMs,
            result,
          };
        } catch (error) {
          lastError = error;

          if (error.code === 'ENGINE_TIMEOUT') {
            this.metrics.timedOut += 1;
            taskMetrics.timedOut += 1;
          }

          if (!this._isRetryable(error) || attempt >= maxAttempts) {
            break;
          }
        }
      }

      const durationMs = Date.now() - run.startedAt;
      this._recordFailure(task, durationMs);
      this._pushHistory({
        runId,
        task,
        ok: false,
        attempt,
        durationMs,
        error: lastError ? lastError.message : 'unknown error',
      });

      console.log(
        `🤫 [CoreProcessingEngine] task="${task}" run=${runId} failed after ${attempt} attempt(s): ` +
          `${lastError ? lastError.message : 'unknown error'}`
      );

      const failure = lastError instanceof Error ? lastError : new Error(String(lastError));
      failure.runId = runId;
      failure.task = task;
      failure.attempts = attempt;
      throw failure;
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  /**
   * Execute several specs and return one entry per spec, never throwing.
   * Used by the diagnostics pipeline where a single failing detector must not
   * abort the whole sweep.
   */
  async executeAll(specs = []) {
    const settled = await Promise.all(
      specs.map((spec) =>
        this.execute(spec).then(
          (value) => value,
          (error) => ({
            ok: false,
            task: spec && spec.task,
            error: error.message,
            code: error.code || 'EXECUTION_FAILED',
          })
        )
      )
    );

    return settled;
  }

  status() {
    const { metrics } = this;
    const completed = metrics.succeeded + metrics.failed;

    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      uptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
      inFlight: this.activeRuns.size,
      capacity: this.options.maxConcurrency,
      saturationPct: Number(((this.activeRuns.size / this.options.maxConcurrency) * 100).toFixed(2)),
      metrics: {
        totalRuns: metrics.totalRuns,
        succeeded: metrics.succeeded,
        failed: metrics.failed,
        timedOut: metrics.timedOut,
        retried: metrics.retried,
        rejected: metrics.rejected,
        slowRuns: metrics.slowRuns,
        successRatePct: completed === 0 ? 100 : Number(((metrics.succeeded / completed) * 100).toFixed(2)),
        avgDurationMs: completed === 0 ? 0 : Math.round(metrics.totalDurationMs / completed),
        p95DurationMs: this._percentile(95),
        minDurationMs: metrics.minDurationMs === null ? 0 : metrics.minDurationMs,
        maxDurationMs: metrics.maxDurationMs,
      },
      tasks: metrics.byTask,
    };
  }

  recentRuns(limit = 20) {
    return this.history.slice(0, Math.max(0, limit));
  }

  resetMetrics() {
    this.metrics = {
      totalRuns: 0,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
      retried: 0,
      rejected: 0,
      slowRuns: 0,
      totalDurationMs: 0,
      minDurationMs: null,
      maxDurationMs: 0,
      durations: [],
      byTask: {},
    };
    this.history = [];
    console.log('🤫 [CoreProcessingEngine] metrics reset');
    return this.status();
  }

  async shutdown() {
    console.log(`🤫 [CoreProcessingEngine] shutting down (${this.activeRuns.size} run(s) in flight)`);
    this.ready = false;
    this.queue = [];
    return { engine: this.name, stopped: true, abandonedRuns: this.activeRuns.size };
  }

  // ---------------------------------------------------------------- internals

  _taskMetrics(task) {
    if (!this.metrics.byTask[task]) {
      this.metrics.byTask[task] = {
        runs: 0,
        succeeded: 0,
        failed: 0,
        retried: 0,
        timedOut: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
      };
    }
    return this.metrics.byTask[task];
  }

  _recordSuccess(task, durationMs) {
    const taskMetrics = this._taskMetrics(task);
    taskMetrics.succeeded += 1;
    taskMetrics.totalDurationMs += durationMs;
    taskMetrics.avgDurationMs = Math.round(taskMetrics.totalDurationMs / taskMetrics.succeeded);

    this.metrics.succeeded += 1;
    this._recordDuration(durationMs);
  }

  _recordFailure(task, durationMs) {
    const taskMetrics = this._taskMetrics(task);
    taskMetrics.failed += 1;

    this.metrics.failed += 1;
    this._recordDuration(durationMs);
  }

  _recordDuration(durationMs) {
    this.metrics.totalDurationMs += durationMs;
    this.metrics.maxDurationMs = Math.max(this.metrics.maxDurationMs, durationMs);
    this.metrics.minDurationMs =
      this.metrics.minDurationMs === null ? durationMs : Math.min(this.metrics.minDurationMs, durationMs);

    if (durationMs >= this.options.slowRunThresholdMs) {
      this.metrics.slowRuns += 1;
    }

    this.metrics.durations.push(durationMs);
    if (this.metrics.durations.length > this.options.historyLimit) {
      this.metrics.durations.shift();
    }
  }

  _percentile(p) {
    const sorted = [...this.metrics.durations].sort((a, b) => a - b);
    if (sorted.length === 0) {
      return 0;
    }
    const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, index)];
  }

  _pushHistory(entry) {
    this.history.unshift({ ...entry, at: new Date().toISOString() });
    if (this.history.length > this.options.historyLimit) {
      this.history.pop();
    }
  }

  _isRetryable(error) {
    if (!error) {
      return false;
    }
    if (error.retryable === false) {
      return false;
    }
    if (error.code === 'ENGINE_TIMEOUT') {
      return true;
    }
    return error.retryable === true;
  }

  _withTimeout(promise, timeoutMs, task) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.resolve(promise);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(`Task "${task}" exceeded ${timeoutMs}ms`);
        error.code = 'ENGINE_TIMEOUT';
        error.statusCode = 504;
        reject(error);
      }, timeoutMs);

      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { CoreProcessingEngine };
module.exports.default = CoreProcessingEngine;
