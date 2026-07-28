'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Learning Loop Engine
 *
 * Closes the feedback loop. Every resolved problem is fed back in as an
 * observation; observations flow through 8 fixed learning cycles that update
 * pattern weights, the knowledge graph and the running accuracy estimate.
 *
 * The 8 cycles run in order — each one consumes the output of the previous:
 *   1 OBSERVE      collect the outcome record
 *   2 NORMALIZE    canonicalize categories, causes and outcome labels
 *   3 CORRELATE    link the observation to existing knowledge-graph nodes
 *   4 EVALUATE     score prediction vs. reality
 *   5 REWEIGHT     move pattern weights toward what actually worked
 *   6 GENERALIZE   promote repeated specifics into a reusable pattern
 *   7 CONSOLIDATE  write the result into the knowledge graph
 *   8 PUBLISH      expose updated accuracy and recommendations
 */

const { createHash, randomUUID } = require('crypto');

const CYCLES = Object.freeze([
  'OBSERVE',
  'NORMALIZE',
  'CORRELATE',
  'EVALUATE',
  'REWEIGHT',
  'GENERALIZE',
  'CONSOLIDATE',
  'PUBLISH',
]);

const OUTCOMES = Object.freeze(['RESOLVED', 'NOT_RESOLVED', 'PARTIAL', 'FALSE_POSITIVE', 'UNKNOWN']);

const DEFAULT_OPTIONS = {
  historyLimit: 1000,
  learningRate: 0.15,
  minWeight: 0.1,
  maxWeight: 5,
  generalizationThreshold: 3,
  baselineAccuracyPct: 72,
};

class LearningLoopEngine {
  constructor(options = {}) {
    this.name = 'LearningLoopEngine';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.cycles = [...CYCLES];

    /** patternKey -> learned weight and hit/miss counters. */
    this.patternWeights = new Map();
    /** nodeId -> knowledge graph node. */
    this.knowledgeGraph = new Map();
    /** generalized patterns promoted out of repeated observations. */
    this.generalizations = new Map();

    this.feedbackHistory = [];
    this.cycleRuns = [];

    this.accuracy = {
      baselinePct: this.options.baselineAccuracyPct,
      currentPct: this.options.baselineAccuracyPct,
      improvementPct: 0,
      correctPredictions: 0,
      incorrectPredictions: 0,
      samples: 0,
      trend: [],
    };

    this.stats = {
      totalFeedback: 0,
      totalCycleRuns: 0,
      byOutcome: OUTCOMES.reduce((acc, outcome) => ({ ...acc, [outcome]: 0 }), {}),
      byCycle: CYCLES.reduce((acc, cycle) => ({ ...acc, [cycle]: 0 }), {}),
      patternsTracked: 0,
      patternsPromoted: 0,
      graphNodes: 0,
      graphEdges: 0,
      falsePositiveRatePct: 0,
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [LearningLoopEngine] initializing learning loop...');

    for (const cycle of this.cycles) {
      console.log(`🤫 [LearningLoopEngine]   cycle ${this.cycles.indexOf(cycle) + 1}/8 ${cycle} armed`);
    }

    this.ready = true;
    this.startedAt = new Date();

    console.log(
      `🤫 [LearningLoopEngine] ready — ${this.cycles.length} cycles, ` +
        `learningRate=${this.options.learningRate}, baseline accuracy=${this.accuracy.baselinePct}%`
    );

    return this.status();
  }

  /**
   * Feed one resolved problem back into the loop and run all 8 cycles.
   *
   * @param {object} feedback
   * @param {string} [feedback.problemId]
   * @param {string} [feedback.predictedCause]  What the platform said.
   * @param {string} [feedback.actualCause]     What it actually was.
   * @param {string} [feedback.category]
   * @param {string} [feedback.outcome]         One of OUTCOMES.
   * @param {Array}  [feedback.matchedRuleIds]  Detector rules that fired.
   * @param {number} [feedback.confidencePct]   Confidence the platform reported.
   * @param {string} [feedback.reportedBy]
   */
  async processFeedback(feedback = {}) {
    if (!this.ready) {
      throw new Error('LearningLoopEngine.processFeedback called before initialize()');
    }

    const normalizedInput = this._validate(feedback);
    const runId = `LRN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const startedAt = Date.now();

    const context = {
      runId,
      input: normalizedInput,
      cycleResults: [],
    };

    for (const cycle of this.cycles) {
      const cycleStarted = Date.now();
      try {
        const output = await this._runCycle(cycle, context);
        context.cycleResults.push({
          cycle,
          ok: true,
          durationMs: Date.now() - cycleStarted,
          output,
        });
        this.stats.byCycle[cycle] += 1;
      } catch (error) {
        context.cycleResults.push({
          cycle,
          ok: false,
          durationMs: Date.now() - cycleStarted,
          error: error.message,
        });

        console.log(`🤫 [LearningLoopEngine] cycle ${cycle} failed for ${runId}: ${error.message}`);

        const failure = new Error(`Learning cycle "${cycle}" failed: ${error.message}`);
        failure.code = 'LEARNING_CYCLE_FAILED';
        failure.statusCode = 500;
        failure.runId = runId;
        failure.completedCycles = context.cycleResults.filter((result) => result.ok).map((result) => result.cycle);
        throw failure;
      }
    }

    const run = {
      runId,
      problemId: normalizedInput.problemId,
      outcome: normalizedInput.outcome,
      predictionCorrect: context.predictionCorrect,
      accuracyPctAfter: this.accuracy.currentPct,
      improvementPct: this.accuracy.improvementPct,
      cyclesCompleted: context.cycleResults.length,
      cycles: context.cycleResults.map((result) => ({
        cycle: result.cycle,
        ok: result.ok,
        durationMs: result.durationMs,
        summary: result.output && result.output.summary,
      })),
      patternsUpdated: context.patternsUpdated || [],
      graphNodeId: context.graphNodeId || null,
      promotedPattern: context.promotedPattern || null,
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
    };

    this.stats.totalCycleRuns += 1;
    this.cycleRuns.unshift(run);
    if (this.cycleRuns.length > this.options.historyLimit) {
      this.cycleRuns.pop();
    }

    console.log(
      `🤫 [LearningLoopEngine] ${runId} — 8/8 cycles done, ` +
        `accuracy=${this.accuracy.currentPct}% (${this.accuracy.improvementPct >= 0 ? '+' : ''}${this.accuracy.improvementPct} vs baseline)`
    );

    return run;
  }

  /** Alias kept for callers that think of this as "learning" rather than feedback. */
  async learn(feedback) {
    return this.processFeedback(feedback);
  }

  /** Learned weight for a detector rule; 1 means "no adjustment yet". */
  getPatternWeight(patternKey) {
    const entry = this.patternWeights.get(patternKey);
    return entry ? entry.weight : 1;
  }

  getPatterns(limit = 50) {
    return [...this.patternWeights.entries()]
      .map(([key, value]) => ({ pattern: key, ...value }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.max(0, limit));
  }

  getKnowledgeGraph(limit = 50) {
    return [...this.knowledgeGraph.values()]
      .sort((a, b) => b.observations - a.observations)
      .slice(0, Math.max(0, limit));
  }

  getGeneralizations() {
    return [...this.generalizations.values()].sort((a, b) => b.support - a.support);
  }

  getFeedbackHistory(limit = 50) {
    return this.feedbackHistory.slice(0, Math.max(0, limit));
  }

  getAccuracy() {
    return { ...this.accuracy, trend: this.accuracy.trend.slice(-20) };
  }

  status() {
    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      cycles: this.cycles,
      cycleCount: this.cycles.length,
      learningRate: this.options.learningRate,
      accuracy: this.getAccuracy(),
      knowledge: {
        patternsTracked: this.patternWeights.size,
        patternsPromoted: this.generalizations.size,
        graphNodes: this.knowledgeGraph.size,
        graphEdges: this.stats.graphEdges,
      },
      stats: this.stats,
    };
  }

  async shutdown() {
    console.log(
      `🤫 [LearningLoopEngine] shutting down — ${this.patternWeights.size} pattern(s), ` +
        `${this.knowledgeGraph.size} graph node(s)`
    );
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _validate(feedback) {
    if (feedback === null || typeof feedback !== 'object') {
      const error = new TypeError('processFeedback() requires an object payload');
      error.code = 'INVALID_PAYLOAD';
      error.statusCode = 400;
      throw error;
    }

    const outcome = String(feedback.outcome || 'UNKNOWN').toUpperCase();
    if (!OUTCOMES.includes(outcome)) {
      const error = new Error(`Unsupported outcome "${outcome}". Expected one of ${OUTCOMES.join(', ')}`);
      error.code = 'UNSUPPORTED_OUTCOME';
      error.statusCode = 400;
      throw error;
    }

    if (!feedback.problemId && !feedback.predictedCause && !feedback.actualCause) {
      const error = new Error('processFeedback() requires "problemId", "predictedCause" or "actualCause"');
      error.code = 'INSUFFICIENT_FEEDBACK';
      error.statusCode = 400;
      throw error;
    }

    return {
      problemId: feedback.problemId || null,
      category: feedback.category ? String(feedback.category).toUpperCase() : 'UNCLASSIFIED',
      predictedCause: feedback.predictedCause || null,
      actualCause: feedback.actualCause || null,
      outcome,
      matchedRuleIds: Array.isArray(feedback.matchedRuleIds) ? feedback.matchedRuleIds.slice(0, 50) : [],
      confidencePct: Number.isFinite(feedback.confidencePct) ? feedback.confidencePct : null,
      reportedBy: feedback.reportedBy || 'system',
      note: typeof feedback.note === 'string' ? feedback.note.slice(0, 2000) : null,
    };
  }

  async _runCycle(cycle, context) {
    switch (cycle) {
      case 'OBSERVE':
        return this._cycleObserve(context);
      case 'NORMALIZE':
        return this._cycleNormalize(context);
      case 'CORRELATE':
        return this._cycleCorrelate(context);
      case 'EVALUATE':
        return this._cycleEvaluate(context);
      case 'REWEIGHT':
        return this._cycleReweight(context);
      case 'GENERALIZE':
        return this._cycleGeneralize(context);
      case 'CONSOLIDATE':
        return this._cycleConsolidate(context);
      case 'PUBLISH':
        return this._cyclePublish(context);
      default: {
        const error = new Error(`Unknown learning cycle "${cycle}"`);
        error.code = 'UNKNOWN_CYCLE';
        throw error;
      }
    }
  }

  _cycleObserve(context) {
    const { input } = context;

    this.stats.totalFeedback += 1;
    this.stats.byOutcome[input.outcome] += 1;

    const entry = {
      runId: context.runId,
      problemId: input.problemId,
      category: input.category,
      outcome: input.outcome,
      predictedCause: input.predictedCause,
      actualCause: input.actualCause,
      confidencePct: input.confidencePct,
      reportedBy: input.reportedBy,
      receivedAt: new Date().toISOString(),
    };

    this.feedbackHistory.unshift(entry);
    if (this.feedbackHistory.length > this.options.historyLimit) {
      this.feedbackHistory.pop();
    }

    context.observation = entry;
    return { summary: `observed outcome=${input.outcome} for problem=${input.problemId || 'n/a'}` };
  }

  _cycleNormalize(context) {
    const { input } = context;

    const canonical = (value) =>
      typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : null;

    context.normalized = {
      category: input.category,
      predictedCause: canonical(input.predictedCause),
      actualCause: canonical(input.actualCause),
      outcome: input.outcome,
      ruleIds: [...new Set(input.matchedRuleIds.map((id) => String(id).toUpperCase()))],
    };

    return {
      summary: `normalized ${context.normalized.ruleIds.length} rule id(s) and cause labels`,
    };
  }

  _cycleCorrelate(context) {
    const { normalized } = context;
    const nodeKey = createHash('sha1')
      .update([normalized.category, normalized.actualCause || normalized.predictedCause || 'unknown'].join('|'))
      .digest('hex')
      .slice(0, 16);

    context.nodeKey = nodeKey;
    context.existingNode = this.knowledgeGraph.get(nodeKey) || null;

    return {
      summary: context.existingNode
        ? `correlated with existing graph node ${nodeKey} (${context.existingNode.observations} prior observation(s))`
        : `no prior node — will create ${nodeKey}`,
    };
  }

  _cycleEvaluate(context) {
    const { normalized } = context;

    let correct;
    if (normalized.outcome === 'FALSE_POSITIVE') {
      correct = false;
    } else if (normalized.actualCause && normalized.predictedCause) {
      correct = normalized.actualCause === normalized.predictedCause;
    } else {
      correct = normalized.outcome === 'RESOLVED';
    }

    context.predictionCorrect = correct;

    this.accuracy.samples += 1;
    if (correct) {
      this.accuracy.correctPredictions += 1;
    } else {
      this.accuracy.incorrectPredictions += 1;
    }

    const observed = (this.accuracy.correctPredictions / this.accuracy.samples) * 100;
    // Blend the observed rate with the baseline so a handful of samples cannot
    // swing the reported accuracy wildly.
    const blendWeight = Math.min(1, this.accuracy.samples / 25);
    this.accuracy.currentPct = Number(
      (this.accuracy.baselinePct * (1 - blendWeight) + observed * blendWeight).toFixed(2)
    );
    this.accuracy.improvementPct = Number(
      (this.accuracy.currentPct - this.accuracy.baselinePct).toFixed(2)
    );

    this.accuracy.trend.push({
      at: new Date().toISOString(),
      accuracyPct: this.accuracy.currentPct,
      samples: this.accuracy.samples,
    });
    if (this.accuracy.trend.length > 200) {
      this.accuracy.trend.shift();
    }

    const falsePositives = this.stats.byOutcome.FALSE_POSITIVE;
    this.stats.falsePositiveRatePct =
      this.stats.totalFeedback === 0
        ? 0
        : Number(((falsePositives / this.stats.totalFeedback) * 100).toFixed(2));

    return {
      summary: `prediction ${correct ? 'CORRECT' : 'INCORRECT'} — accuracy now ${this.accuracy.currentPct}%`,
    };
  }

  _cycleReweight(context) {
    const { normalized, predictionCorrect } = context;
    const updated = [];

    const keys = normalized.ruleIds.length > 0
      ? normalized.ruleIds
      : [`CATEGORY:${normalized.category}`];

    for (const key of keys) {
      const entry = this.patternWeights.get(key) || { weight: 1, hits: 0, misses: 0, updatedAt: null };

      const delta = predictionCorrect ? this.options.learningRate : -this.options.learningRate;
      entry.weight = Number(
        Math.max(this.options.minWeight, Math.min(this.options.maxWeight, entry.weight + delta)).toFixed(4)
      );
      if (predictionCorrect) {
        entry.hits += 1;
      } else {
        entry.misses += 1;
      }
      entry.updatedAt = new Date().toISOString();

      this.patternWeights.set(key, entry);
      updated.push({ pattern: key, weight: entry.weight, hits: entry.hits, misses: entry.misses });
    }

    this.stats.patternsTracked = this.patternWeights.size;
    context.patternsUpdated = updated;

    return { summary: `reweighted ${updated.length} pattern(s)` };
  }

  _cycleGeneralize(context) {
    const { normalized } = context;
    const cause = normalized.actualCause || normalized.predictedCause;

    if (!cause) {
      return { summary: 'nothing to generalize — no cause label present' };
    }

    const key = `${normalized.category}::${cause}`;
    const entry = this.generalizations.get(key) || {
      key,
      category: normalized.category,
      cause,
      support: 0,
      ruleIds: [],
      promoted: false,
      firstSeenAt: new Date().toISOString(),
    };

    entry.support += 1;
    entry.ruleIds = [...new Set([...entry.ruleIds, ...normalized.ruleIds])].slice(0, 25);
    entry.lastSeenAt = new Date().toISOString();

    if (!entry.promoted && entry.support >= this.options.generalizationThreshold) {
      entry.promoted = true;
      entry.promotedAt = entry.lastSeenAt;
      this.stats.patternsPromoted += 1;
      context.promotedPattern = key;
      console.log(
        `🤫 [LearningLoopEngine] promoted generalization "${key}" after ${entry.support} observation(s)`
      );
    }

    this.generalizations.set(key, entry);

    return {
      summary: entry.promoted
        ? `generalization "${key}" is promoted (support=${entry.support})`
        : `generalization "${key}" support=${entry.support}/${this.options.generalizationThreshold}`,
    };
  }

  _cycleConsolidate(context) {
    const { normalized, nodeKey, predictionCorrect } = context;

    const node = this.knowledgeGraph.get(nodeKey) || {
      nodeId: nodeKey,
      category: normalized.category,
      cause: normalized.actualCause || normalized.predictedCause || 'unknown',
      observations: 0,
      resolvedCount: 0,
      falsePositiveCount: 0,
      relatedRuleIds: [],
      edges: [],
      createdAt: new Date().toISOString(),
    };

    node.observations += 1;
    if (normalized.outcome === 'RESOLVED') {
      node.resolvedCount += 1;
    }
    if (normalized.outcome === 'FALSE_POSITIVE') {
      node.falsePositiveCount += 1;
    }
    node.relatedRuleIds = [...new Set([...node.relatedRuleIds, ...normalized.ruleIds])].slice(0, 50);
    node.reliabilityPct = Number(((node.resolvedCount / node.observations) * 100).toFixed(2));
    node.lastPredictionCorrect = predictionCorrect;
    node.updatedAt = new Date().toISOString();

    // Link causes that share a category so the graph stays traversable.
    for (const other of this.knowledgeGraph.values()) {
      if (other.nodeId === node.nodeId || other.category !== node.category) {
        continue;
      }
      if (!node.edges.includes(other.nodeId)) {
        node.edges.push(other.nodeId);
        this.stats.graphEdges += 1;
      }
      if (!other.edges.includes(node.nodeId)) {
        other.edges.push(node.nodeId);
      }
    }

    this.knowledgeGraph.set(nodeKey, node);
    this.stats.graphNodes = this.knowledgeGraph.size;
    context.graphNodeId = nodeKey;

    return {
      summary: `graph node ${nodeKey} now has ${node.observations} observation(s), ` +
        `reliability=${node.reliabilityPct}%`,
    };
  }

  _cyclePublish(context) {
    const summary = {
      accuracyPct: this.accuracy.currentPct,
      improvementPct: this.accuracy.improvementPct,
      patternsTracked: this.patternWeights.size,
      graphNodes: this.knowledgeGraph.size,
      falsePositiveRatePct: this.stats.falsePositiveRatePct,
    };

    context.published = summary;

    return {
      summary: `published accuracy=${summary.accuracyPct}% patterns=${summary.patternsTracked} nodes=${summary.graphNodes}`,
    };
  }
}

module.exports = { LearningLoopEngine, CYCLES, OUTCOMES };
module.exports.default = LearningLoopEngine;
