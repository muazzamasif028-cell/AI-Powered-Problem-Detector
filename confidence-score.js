'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Confidence Scoring System
 *
 * Produces one number an operator can act on. The pipeline emits three
 * independent confidence signals (detection, analysis, solution); this engine
 * weights them, applies penalties for known-weak inputs, and returns a level
 * plus an explicit recommendation (AUTO_APPLY / REVIEW / ESCALATE / GATHER_DATA).
 */

const { randomUUID } = require('crypto');

const LEVEL = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });

const RECOMMENDATION = Object.freeze({
  AUTO_APPLY: 'AUTO_APPLY',
  REVIEW: 'REVIEW',
  ESCALATE: 'ESCALATE',
  GATHER_DATA: 'GATHER_DATA',
});

const DEFAULT_OPTIONS = {
  weights: { detection: 0.3, analysis: 0.45, solution: 0.25 },
  highThreshold: 80,
  mediumThreshold: 55,
  historyLimit: 500,
};

const CONSENSUS_MULTIPLIER = Object.freeze({ STRONG: 1, MODERATE: 0.8, WEAK: 0.5 });

const RISK_PENALTY = Object.freeze({ LOW: 0, MEDIUM: 5, HIGH: 15 });

class ConfidenceScoringSystem {
  constructor(options = {}) {
    this.name = 'ConfidenceScoringSystem';
    this.version = '14.0.0';
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      weights: { ...DEFAULT_OPTIONS.weights, ...(options.weights || {}) },
    };

    this.ready = false;
    this.startedAt = null;

    this.scores = new Map();
    this.history = [];

    this.stats = {
      totalScored: 0,
      byLevel: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      byRecommendation: { AUTO_APPLY: 0, REVIEW: 0, ESCALATE: 0, GATHER_DATA: 0 },
      totalScore: 0,
      avgScore: 0,
      minScore: null,
      maxScore: 0,
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [ConfidenceScoringSystem] calibrating scoring weights...');

    const { detection, analysis, solution } = this.options.weights;
    const total = detection + analysis + solution;

    if (Math.abs(total - 1) > 0.001) {
      console.log(`🤫 [ConfidenceScoringSystem] weights sum to ${total.toFixed(3)} — normalizing`);
      this.options.weights = {
        detection: detection / total,
        analysis: analysis / total,
        solution: solution / total,
      };
    }

    this.ready = true;
    this.startedAt = new Date();

    console.log(
      '🤫 [ConfidenceScoringSystem] ready — weights ' +
        `detection=${this.options.weights.detection.toFixed(2)} ` +
        `analysis=${this.options.weights.analysis.toFixed(2)} ` +
        `solution=${this.options.weights.solution.toFixed(2)}`
    );

    return this.status();
  }

  /**
   * Score a full pipeline result.
   *
   * @param {object} input
   * @param {object} [input.detection] Output of `BasicDetector.detect()`.
   * @param {object} [input.analysis]  Output of `RootCauseEngine.analyze()`.
   * @param {object} [input.solution]  Output of `SolutionEngine.generateSolution()`.
   */
  calculateScore(input = {}) {
    if (!this.ready) {
      throw new Error('ConfidenceScoringSystem.calculateScore called before initialize()');
    }

    if (input === null || typeof input !== 'object') {
      const error = new TypeError('calculateScore() requires an object payload');
      error.code = 'INVALID_PAYLOAD';
      error.statusCode = 400;
      throw error;
    }

    const { detection = null, analysis = null, solution = null } = input;

    if (!detection && !analysis && !solution) {
      const error = new Error('calculateScore() requires at least one of "detection", "analysis", "solution"');
      error.code = 'NOTHING_TO_SCORE';
      error.statusCode = 400;
      throw error;
    }

    const detectionScore = this._scoreDetection(detection);
    const analysisScore = this._scoreAnalysis(analysis);
    const solutionScore = this._scoreSolution(solution);

    const components = [detectionScore, analysisScore, solutionScore].filter((part) => part.available);
    const activeWeight = components.reduce((sum, part) => sum + part.weight, 0);

    const weighted =
      activeWeight === 0
        ? 0
        : components.reduce((sum, part) => sum + part.score * part.weight, 0) / activeWeight;

    const penalties = this._penalties({ detection, analysis, solution, components });
    const penaltyTotal = penalties.reduce((sum, penalty) => sum + penalty.points, 0);

    const overall = Math.max(0, Math.min(100, Number((weighted - penaltyTotal).toFixed(2))));
    const level = this._level(overall);
    const recommendation = this._recommend({ overall, level, analysis, solution, penalties });

    const record = {
      scoreId: `CNF-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      problemId: (analysis && analysis.problemId) || (detection && detection.problemId) || null,
      overallScore: overall,
      level,
      recommendation: recommendation.action,
      recommendationReason: recommendation.reason,
      nextSteps: recommendation.nextSteps,
      breakdown: {
        detection: detectionScore,
        analysis: analysisScore,
        solution: solutionScore,
      },
      completeness: {
        componentsAvailable: components.length,
        componentsExpected: 3,
        coveragePct: Number(((components.length / 3) * 100).toFixed(2)),
      },
      penalties,
      penaltyTotal: Number(penaltyTotal.toFixed(2)),
      weightedBeforePenalties: Number(weighted.toFixed(2)),
      scoredAt: new Date().toISOString(),
    };

    this.scores.set(record.scoreId, record);
    this._record(record);

    console.log(
      `🤫 [ConfidenceScoringSystem] ${record.scoreId} — score=${overall} level=${level} ` +
        `recommendation=${recommendation.action}`
    );

    return record;
  }

  getScore(scoreId) {
    return this.scores.get(scoreId) || null;
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
      weights: this.options.weights,
      thresholds: { high: this.options.highThreshold, medium: this.options.mediumThreshold },
      levels: Object.values(LEVEL),
      recommendations: Object.values(RECOMMENDATION),
      stored: this.scores.size,
      stats: {
        ...this.stats,
        minScore: this.stats.minScore === null ? 0 : this.stats.minScore,
      },
    };
  }

  async shutdown() {
    console.log(`🤫 [ConfidenceScoringSystem] shutting down — ${this.scores.size} score(s) retained`);
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _scoreDetection(detection) {
    if (!detection || typeof detection !== 'object') {
      return { available: false, score: 0, weight: 0, notes: ['no detection result supplied'] };
    }

    const notes = [];
    let score = 40;

    const findingCount = Number.isFinite(detection.findingCount)
      ? detection.findingCount
      : Array.isArray(detection.findings)
        ? detection.findings.length
        : 0;

    if (findingCount === 0) {
      score = 25;
      notes.push('detector found nothing — the symptom may be outside rule coverage');
    } else {
      score += Math.min(30, findingCount * 10);
      notes.push(`${findingCount} finding(s) matched`);
    }

    const severityBoost = { CRITICAL: 20, HIGH: 15, MEDIUM: 8, LOW: 3, INFO: 0 };
    if (detection.highestSeverity && severityBoost[detection.highestSeverity] !== undefined) {
      score += severityBoost[detection.highestSeverity];
      notes.push(`highest severity ${detection.highestSeverity}`);
    }

    const categories = Array.isArray(detection.categories) ? detection.categories.length : 0;
    if (categories > 2) {
      score -= 8;
      notes.push(`${categories} categories matched — signal is diffuse`);
    }

    return {
      available: true,
      score: Math.max(0, Math.min(100, Number(score.toFixed(2)))),
      weight: this.options.weights.detection,
      notes,
    };
  }

  _scoreAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') {
      return { available: false, score: 0, weight: 0, notes: ['no root-cause analysis supplied'] };
    }

    const notes = [];
    const base = Number.isFinite(analysis.confidencePct) ? analysis.confidencePct : 0;
    const multiplier = CONSENSUS_MULTIPLIER[analysis.consensus] ?? 0.5;

    let score = base * multiplier + 25;
    notes.push(`hypothesis confidence ${base}% x ${analysis.consensus || 'WEAK'} consensus (${multiplier})`);

    const sourceCount = Number.isFinite(analysis.evidenceSourceCount) ? analysis.evidenceSourceCount : 0;
    if (sourceCount >= 3) {
      score += 12;
      notes.push(`${sourceCount} independent evidence sources`);
    } else if (sourceCount <= 1) {
      score -= 10;
      notes.push('evidence comes from a single source');
    }

    if (analysis.conclusive === false) {
      score -= 25;
      notes.push('analysis was inconclusive');
    }

    return {
      available: true,
      score: Math.max(0, Math.min(100, Number(score.toFixed(2)))),
      weight: this.options.weights.analysis,
      notes,
    };
  }

  _scoreSolution(solution) {
    if (!solution || typeof solution !== 'object') {
      return { available: false, score: 0, weight: 0, notes: ['no solution supplied'] };
    }

    const notes = [];
    let score = 50;

    if (solution.playbookId && solution.playbookId !== 'GENERIC') {
      score += 20;
      notes.push(`matched playbook ${solution.playbookId}`);
    } else {
      score -= 15;
      notes.push('fell back to the generic evidence-gathering playbook');
    }

    const stepCount = Array.isArray(solution.steps) ? solution.steps.length : 0;
    const automatable = Number.isFinite(solution.automatableSteps) ? solution.automatableSteps : 0;

    if (stepCount > 0) {
      const automatablePct = (automatable / stepCount) * 100;
      score += Math.min(20, automatablePct / 5);
      notes.push(`${automatable}/${stepCount} step(s) automatable`);
    }

    if (RISK_PENALTY[solution.risk] !== undefined) {
      score -= RISK_PENALTY[solution.risk];
      notes.push(`plan risk ${solution.risk}`);
    }

    return {
      available: true,
      score: Math.max(0, Math.min(100, Number(score.toFixed(2)))),
      weight: this.options.weights.solution,
      notes,
    };
  }

  _penalties({ analysis, solution, components }) {
    const penalties = [];

    if (components.length < 3) {
      penalties.push({
        reason: `pipeline incomplete — ${components.length}/3 stages produced output`,
        points: (3 - components.length) * 5,
      });
    }

    if (analysis && analysis.consensus === 'WEAK') {
      penalties.push({ reason: 'root-cause consensus is WEAK', points: 8 });
    }

    if (solution && solution.risk === 'HIGH') {
      penalties.push({ reason: 'remediation plan carries HIGH risk', points: 6 });
    }

    return penalties;
  }

  _level(score) {
    if (score >= this.options.highThreshold) {
      return LEVEL.HIGH;
    }
    if (score >= this.options.mediumThreshold) {
      return LEVEL.MEDIUM;
    }
    return LEVEL.LOW;
  }

  _recommend({ overall, level, analysis, solution, penalties }) {
    const severity = analysis && analysis.severity ? String(analysis.severity).toUpperCase() : null;
    const risk = solution ? solution.risk : null;

    if (level === LEVEL.LOW) {
      return {
        action: RECOMMENDATION.GATHER_DATA,
        reason: `Confidence ${overall} is below the ${this.options.mediumThreshold} review threshold` +
          (penalties.length > 0 ? ` (${penalties.map((penalty) => penalty.reason).join('; ')})` : ''),
        nextSteps: [
          'Raise log verbosity on the affected component',
          'Collect a metrics snapshot spanning the incident window',
          'Re-run diagnostics once richer telemetry exists',
        ],
      };
    }

    if (severity === 'CRITICAL' || risk === 'HIGH') {
      return {
        action: RECOMMENDATION.ESCALATE,
        reason:
          severity === 'CRITICAL'
            ? 'Problem severity is CRITICAL — a human owner must sign off'
            : 'Remediation plan is HIGH risk — a human owner must sign off',
        nextSteps: [
          'Page the on-call owner for the affected service',
          'Walk the plan with a second reviewer before executing',
          'Open an incident channel and record every action',
        ],
      };
    }

    if (level === LEVEL.HIGH && solution && solution.autoApplyEligible) {
      return {
        action: RECOMMENDATION.AUTO_APPLY,
        reason: `Confidence ${overall} clears the ${this.options.highThreshold} bar and the plan is auto-apply eligible`,
        nextSteps: [
          'Execute the automatable steps via POST /api/solutions/:id/auto-apply',
          'Watch the verification step for 10 minutes',
          'Hand the remaining manual steps to the service owner',
        ],
      };
    }

    return {
      action: RECOMMENDATION.REVIEW,
      reason: `Confidence ${overall} supports the plan but it needs a human check before execution`,
      nextSteps: [
        'Review the ranked root-cause candidates for a better fit',
        'Confirm the verification step is measurable',
        'Apply manually and report the outcome back to the learning loop',
      ],
    };
  }

  _record(record) {
    this.stats.totalScored += 1;
    this.stats.byLevel[record.level] = (this.stats.byLevel[record.level] || 0) + 1;
    this.stats.byRecommendation[record.recommendation] =
      (this.stats.byRecommendation[record.recommendation] || 0) + 1;

    this.stats.totalScore += record.overallScore;
    this.stats.avgScore = Number((this.stats.totalScore / this.stats.totalScored).toFixed(2));
    this.stats.maxScore = Math.max(this.stats.maxScore, record.overallScore);
    this.stats.minScore =
      this.stats.minScore === null ? record.overallScore : Math.min(this.stats.minScore, record.overallScore);

    this.history.unshift({
      scoreId: record.scoreId,
      problemId: record.problemId,
      overallScore: record.overallScore,
      level: record.level,
      recommendation: record.recommendation,
      scoredAt: record.scoredAt,
    });

    if (this.history.length > this.options.historyLimit) {
      this.history.pop();
    }
  }
}

module.exports = { ConfidenceScoringSystem, LEVEL, RECOMMENDATION };
module.exports.default = ConfidenceScoringSystem;
