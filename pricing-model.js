'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Pricing Model Engine
 *
 * Turns a problem into a priced quote. Tier selection is derived from the
 * problem itself (severity, category, blast radius, SLA) rather than asked for,
 * so a quote can be produced straight off an intake record.
 *
 * All money is handled in integer cents; only the presentation layer divides.
 */

const { randomUUID } = require('crypto');

const TIERS = Object.freeze({
  SMALL: {
    id: 'SMALL',
    label: 'Small',
    rank: 1,
    baseCents: 4900,
    perProblemCents: 900,
    includedProblems: 10,
    slaHours: 72,
    seats: 3,
    supportChannel: 'EMAIL',
    features: ['Basic detection', 'Root cause summary', 'Community support'],
  },
  MEDIUM: {
    id: 'MEDIUM',
    label: 'Medium',
    rank: 2,
    baseCents: 19900,
    perProblemCents: 700,
    includedProblems: 50,
    slaHours: 24,
    seats: 10,
    supportChannel: 'EMAIL',
    features: ['All detectors', 'Solution playbooks', 'Alert history', 'Email support'],
  },
  BUSINESS: {
    id: 'BUSINESS',
    label: 'Business',
    rank: 3,
    baseCents: 79900,
    perProblemCents: 500,
    includedProblems: 250,
    slaHours: 8,
    seats: 50,
    supportChannel: 'CHAT',
    features: [
      'All detectors',
      'Auto-apply for low-risk plans',
      'Learning loop feedback',
      'Priority chat support',
    ],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    label: 'Enterprise',
    rank: 4,
    baseCents: 299900,
    perProblemCents: 300,
    includedProblems: 2000,
    slaHours: 2,
    seats: 500,
    supportChannel: 'DEDICATED',
    features: [
      'Everything in Business',
      'Auto-apply for medium-risk plans',
      'Satellite telemetry access',
      'Named technical account manager',
      'Custom detection rules',
    ],
  },
  GLOBAL: {
    id: 'GLOBAL',
    label: 'Global',
    rank: 5,
    baseCents: 1499900,
    perProblemCents: 150,
    includedProblems: 25000,
    slaHours: 1,
    seats: -1,
    supportChannel: 'DEDICATED_24_7',
    features: [
      'Everything in Enterprise',
      'Unlimited seats',
      'Multi-region sovereign deployment',
      'Full satellite constellation access',
      '24/7 follow-the-sun incident command',
    ],
  },
});

const SEVERITY_MULTIPLIER = Object.freeze({ CRITICAL: 2, HIGH: 1.5, MEDIUM: 1.15, LOW: 1 });

const CATEGORY_MULTIPLIER = Object.freeze({
  SECURITY: 1.4,
  DATA: 1.35,
  AVAILABILITY: 1.3,
  CRASH: 1.2,
  RESOURCE: 1.1,
  PERFORMANCE: 1.1,
  NETWORK: 1.1,
  CONFIGURATION: 1,
  APPLICATION: 1,
  UNCLASSIFIED: 1,
});

const DISCOUNTS = Object.freeze([
  { code: 'ANNUAL', label: 'Annual prepay', pct: 20, applies: (ctx) => ctx.billingPeriod === 'ANNUAL' },
  { code: 'VOLUME_10K', label: 'Volume 10,000+ problems', pct: 15, applies: (ctx) => ctx.problemCount >= 10000 },
  { code: 'VOLUME_1K', label: 'Volume 1,000+ problems', pct: 10, applies: (ctx) => ctx.problemCount >= 1000 && ctx.problemCount < 10000 },
  { code: 'NONPROFIT', label: 'Non-profit', pct: 25, applies: (ctx) => ctx.nonprofit === true },
  { code: 'STARTUP', label: 'Early-stage startup', pct: 15, applies: (ctx) => ctx.startup === true },
  { code: 'MULTI_YEAR', label: 'Multi-year commitment', pct: 10, applies: (ctx) => ctx.commitmentYears >= 2 },
]);

const MAX_TOTAL_DISCOUNT_PCT = 40;

const DEFAULT_OPTIONS = {
  currency: 'USD',
  taxRatePct: 0,
  historyLimit: 500,
  quoteValidDays: 30,
};

class PricingModelEngine {
  constructor(options = {}) {
    this.name = 'PricingModelEngine';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.tiers = TIERS;
    this.quotes = new Map();
    this.history = [];

    this.revenue = {
      currency: this.options.currency,
      quotedCents: 0,
      bookedCents: 0,
      discountedCents: 0,
      taxCents: 0,
      byTierCents: Object.keys(TIERS).reduce((acc, tier) => ({ ...acc, [tier]: 0 }), {}),
    };

    this.stats = {
      totalQuotes: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      byTier: Object.keys(TIERS).reduce((acc, tier) => ({ ...acc, [tier]: 0 }), {}),
      avgQuoteCents: 0,
      largestQuoteCents: 0,
      discountsApplied: 0,
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [PricingModelEngine] loading pricing tiers...');

    for (const tier of Object.values(TIERS)) {
      console.log(
        `🤫 [PricingModelEngine]   ${tier.id} — base $${(tier.baseCents / 100).toFixed(2)}, ` +
          `${tier.includedProblems} problems included, ${tier.slaHours}h SLA`
      );
    }

    this.ready = true;
    this.startedAt = new Date();

    console.log(
      `🤫 [PricingModelEngine] ready — ${Object.keys(TIERS).length} tier(s), ` +
        `${DISCOUNTS.length} discount rule(s), currency=${this.options.currency}`
    );

    return this.status();
  }

  /**
   * Generate a quote.
   *
   * @param {object} input
   * @param {string} [input.tier]           Explicit tier; otherwise detected.
   * @param {object} [input.problem]        Intake record used for tier detection.
   * @param {number} [input.problemCount]   Expected monthly problem volume.
   * @param {string} [input.billingPeriod]  'MONTHLY' | 'ANNUAL'.
   * @param {number} [input.commitmentYears]
   * @param {boolean}[input.nonprofit]
   * @param {boolean}[input.startup]
   */
  generateQuote(input = {}) {
    if (!this.ready) {
      throw new Error('PricingModelEngine.generateQuote called before initialize()');
    }

    if (input === null || typeof input !== 'object') {
      const error = new TypeError('generateQuote() requires an object payload');
      error.code = 'INVALID_PAYLOAD';
      error.statusCode = 400;
      throw error;
    }

    const problem = input.problem && typeof input.problem === 'object' ? input.problem : {};
    const detection = input.tier ? this._explicitTier(input.tier) : this.detectTier(problem, input);
    const tier = TIERS[detection.tier];

    const problemCount = this._positiveInt(input.problemCount, tier.includedProblems);
    const billingPeriod = String(input.billingPeriod || 'MONTHLY').toUpperCase();

    if (!['MONTHLY', 'ANNUAL'].includes(billingPeriod)) {
      const error = new Error(`Unsupported billingPeriod "${billingPeriod}". Expected MONTHLY or ANNUAL`);
      error.code = 'UNSUPPORTED_BILLING_PERIOD';
      error.statusCode = 400;
      throw error;
    }

    const severity = problem.severity ? String(problem.severity).toUpperCase() : 'MEDIUM';
    const category = problem.category ? String(problem.category).toUpperCase() : 'UNCLASSIFIED';

    const severityMultiplier = SEVERITY_MULTIPLIER[severity] ?? 1;
    const categoryMultiplier = CATEGORY_MULTIPLIER[category] ?? 1;

    const overage = Math.max(0, problemCount - tier.includedProblems);
    const overageCents = overage * tier.perProblemCents;

    const periodMultiplier = billingPeriod === 'ANNUAL' ? 12 : 1;
    const baseCents = tier.baseCents * periodMultiplier;

    const urgencyCents = Math.round(baseCents * (severityMultiplier - 1));
    const complexityCents = Math.round(baseCents * (categoryMultiplier - 1));

    const subtotalCents = baseCents + overageCents + urgencyCents + complexityCents;

    const discountContext = {
      billingPeriod,
      problemCount,
      nonprofit: input.nonprofit === true,
      startup: input.startup === true,
      commitmentYears: this._positiveInt(input.commitmentYears, 1),
    };
    const discount = this._calculateDiscount(subtotalCents, discountContext);

    const afterDiscountCents = subtotalCents - discount.amountCents;
    const taxCents = Math.round(afterDiscountCents * (this.options.taxRatePct / 100));
    const totalCents = afterDiscountCents + taxCents;

    const validUntil = new Date(Date.now() + this.options.quoteValidDays * 24 * 60 * 60 * 1000);

    const quote = {
      quoteId: `QTE-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      problemId: problem.problemId || input.problemId || null,
      tenantId: problem.tenantId || input.tenantId || 'default',
      currency: this.options.currency,
      tier: {
        id: tier.id,
        label: tier.label,
        slaHours: tier.slaHours,
        seats: tier.seats === -1 ? 'unlimited' : tier.seats,
        supportChannel: tier.supportChannel,
        includedProblems: tier.includedProblems,
        features: tier.features,
      },
      tierDetection: detection,
      billingPeriod,
      problemCount,
      lineItems: [
        { label: `${tier.label} platform fee (${billingPeriod.toLowerCase()})`, amountCents: baseCents },
        {
          label: `Overage — ${overage} problem(s) beyond ${tier.includedProblems} included`,
          amountCents: overageCents,
        },
        { label: `Severity uplift (${severity} x${severityMultiplier})`, amountCents: urgencyCents },
        { label: `Category uplift (${category} x${categoryMultiplier})`, amountCents: complexityCents },
      ].filter((item) => item.amountCents !== 0),
      subtotalCents,
      discount,
      taxRatePct: this.options.taxRatePct,
      taxCents,
      totalCents,
      total: Number((totalCents / 100).toFixed(2)),
      status: 'QUOTED',
      validUntil: validUntil.toISOString(),
      generatedAt: new Date().toISOString(),
    };

    this.quotes.set(quote.quoteId, quote);
    this._recordQuote(quote);

    console.log(
      `🤫 [PricingModelEngine] ${quote.quoteId} — tier=${tier.id} ` +
        `total=${quote.currency} ${quote.total} (discount ${discount.totalPct}%)`
    );

    return quote;
  }

  /**
   * Pick a tier from the problem's own characteristics.
   *
   * Signals: severity, category weight, blast radius (affected users/systems),
   * requested SLA and expected volume.
   */
  detectTier(problem = {}, input = {}) {
    const reasons = [];
    let score = 0;

    const severity = problem.severity ? String(problem.severity).toUpperCase() : null;
    if (severity === 'CRITICAL') {
      score += 40;
      reasons.push('CRITICAL severity');
    } else if (severity === 'HIGH') {
      score += 25;
      reasons.push('HIGH severity');
    } else if (severity === 'MEDIUM') {
      score += 10;
      reasons.push('MEDIUM severity');
    }

    const category = problem.category ? String(problem.category).toUpperCase() : null;
    if (category && ['SECURITY', 'DATA', 'AVAILABILITY'].includes(category)) {
      score += 20;
      reasons.push(`${category} category carries regulatory / revenue exposure`);
    }

    const affectedUsers = this._positiveInt(problem.affectedUsers ?? input.affectedUsers, 0);
    if (affectedUsers >= 1000000) {
      score += 40;
      reasons.push(`${affectedUsers.toLocaleString()} affected users`);
    } else if (affectedUsers >= 10000) {
      score += 25;
      reasons.push(`${affectedUsers.toLocaleString()} affected users`);
    } else if (affectedUsers >= 100) {
      score += 10;
      reasons.push(`${affectedUsers.toLocaleString()} affected users`);
    }

    const problemCount = this._positiveInt(input.problemCount, 0);
    if (problemCount >= 10000) {
      score += 35;
      reasons.push(`${problemCount.toLocaleString()} problems/month volume`);
    } else if (problemCount >= 1000) {
      score += 22;
      reasons.push(`${problemCount.toLocaleString()} problems/month volume`);
    } else if (problemCount >= 100) {
      score += 12;
      reasons.push(`${problemCount.toLocaleString()} problems/month volume`);
    }

    const requestedSlaHours = Number(input.requestedSlaHours);
    if (Number.isFinite(requestedSlaHours)) {
      if (requestedSlaHours <= 1) {
        score += 35;
        reasons.push('1h SLA requested');
      } else if (requestedSlaHours <= 4) {
        score += 20;
        reasons.push(`${requestedSlaHours}h SLA requested`);
      } else if (requestedSlaHours <= 24) {
        score += 8;
        reasons.push(`${requestedSlaHours}h SLA requested`);
      }
    }

    if (input.multiRegion === true) {
      score += 25;
      reasons.push('multi-region deployment required');
    }

    let tier;
    if (score >= 110) {
      tier = 'GLOBAL';
    } else if (score >= 75) {
      tier = 'ENTERPRISE';
    } else if (score >= 45) {
      tier = 'BUSINESS';
    } else if (score >= 20) {
      tier = 'MEDIUM';
    } else {
      tier = 'SMALL';
    }

    if (reasons.length === 0) {
      reasons.push('no escalating signals present — defaulted to entry tier');
    }

    return { tier, score, reasons, source: 'DETECTED' };
  }

  /** Mark a quote as accepted and book the revenue. */
  acceptQuote(quoteId, { acceptedBy = 'customer' } = {}) {
    const quote = this._requireQuote(quoteId);

    if (quote.status !== 'QUOTED') {
      const error = new Error(`Quote "${quoteId}" is ${quote.status} and cannot be accepted`);
      error.code = 'QUOTE_NOT_OPEN';
      error.statusCode = 409;
      throw error;
    }

    if (new Date(quote.validUntil) < new Date()) {
      quote.status = 'EXPIRED';
      this.stats.expired += 1;
      const error = new Error(`Quote "${quoteId}" expired on ${quote.validUntil}`);
      error.code = 'QUOTE_EXPIRED';
      error.statusCode = 409;
      throw error;
    }

    quote.status = 'ACCEPTED';
    quote.acceptedAt = new Date().toISOString();
    quote.acceptedBy = acceptedBy;

    this.stats.accepted += 1;
    this.revenue.bookedCents += quote.totalCents;
    this.revenue.byTierCents[quote.tier.id] += quote.totalCents;
    this.revenue.taxCents += quote.taxCents;
    this.revenue.discountedCents += quote.discount.amountCents;

    console.log(
      `🤫 [PricingModelEngine] ${quoteId} ACCEPTED — booked ${quote.currency} ${quote.total} ` +
        `(total booked ${(this.revenue.bookedCents / 100).toFixed(2)})`
    );

    return quote;
  }

  rejectQuote(quoteId, { reason = null } = {}) {
    const quote = this._requireQuote(quoteId);
    quote.status = 'REJECTED';
    quote.rejectedAt = new Date().toISOString();
    quote.rejectionReason = reason;
    this.stats.rejected += 1;

    console.log(`🤫 [PricingModelEngine] ${quoteId} REJECTED${reason ? ` — ${reason}` : ''}`);
    return quote;
  }

  getQuote(quoteId) {
    return this.quotes.get(quoteId) || null;
  }

  getHistory(limit = 50) {
    return this.history.slice(0, Math.max(0, limit));
  }

  listTiers() {
    return Object.values(TIERS).map((tier) => ({
      ...tier,
      basePrice: Number((tier.baseCents / 100).toFixed(2)),
      perProblemPrice: Number((tier.perProblemCents / 100).toFixed(2)),
      seats: tier.seats === -1 ? 'unlimited' : tier.seats,
      currency: this.options.currency,
    }));
  }

  getRevenue() {
    return {
      ...this.revenue,
      quoted: Number((this.revenue.quotedCents / 100).toFixed(2)),
      booked: Number((this.revenue.bookedCents / 100).toFixed(2)),
      conversionRatePct:
        this.stats.totalQuotes === 0
          ? 0
          : Number(((this.stats.accepted / this.stats.totalQuotes) * 100).toFixed(2)),
      byTier: Object.entries(this.revenue.byTierCents).reduce(
        (acc, [tier, cents]) => ({ ...acc, [tier]: Number((cents / 100).toFixed(2)) }),
        {}
      ),
    };
  }

  status() {
    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      currency: this.options.currency,
      tiers: Object.keys(TIERS),
      discountRules: DISCOUNTS.map((discount) => ({ code: discount.code, label: discount.label, pct: discount.pct })),
      maxTotalDiscountPct: MAX_TOTAL_DISCOUNT_PCT,
      stored: this.quotes.size,
      revenue: this.getRevenue(),
      stats: this.stats,
    };
  }

  async shutdown() {
    console.log(`🤫 [PricingModelEngine] shutting down — ${this.quotes.size} quote(s) retained`);
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _explicitTier(tierId) {
    const normalized = String(tierId).toUpperCase();
    if (!TIERS[normalized]) {
      const error = new Error(
        `Unknown tier "${normalized}". Expected one of ${Object.keys(TIERS).join(', ')}`
      );
      error.code = 'UNKNOWN_TIER';
      error.statusCode = 400;
      throw error;
    }
    return { tier: normalized, score: null, reasons: ['tier explicitly requested'], source: 'EXPLICIT' };
  }

  _calculateDiscount(subtotalCents, context) {
    const applied = DISCOUNTS.filter((discount) => {
      try {
        return discount.applies(context);
      } catch {
        return false;
      }
    }).map((discount) => ({ code: discount.code, label: discount.label, pct: discount.pct }));

    const rawPct = applied.reduce((sum, discount) => sum + discount.pct, 0);
    const totalPct = Math.min(MAX_TOTAL_DISCOUNT_PCT, rawPct);
    const amountCents = Math.round(subtotalCents * (totalPct / 100));

    if (applied.length > 0) {
      this.stats.discountsApplied += 1;
    }

    return {
      applied,
      rawPct,
      totalPct,
      cappedAtPct: rawPct > MAX_TOTAL_DISCOUNT_PCT ? MAX_TOTAL_DISCOUNT_PCT : null,
      amountCents,
      amount: Number((amountCents / 100).toFixed(2)),
    };
  }

  _requireQuote(quoteId) {
    const quote = this.quotes.get(quoteId);
    if (!quote) {
      const error = new Error(`Unknown quoteId "${quoteId}"`);
      error.code = 'QUOTE_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
    return quote;
  }

  _positiveInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }

  _recordQuote(quote) {
    this.stats.totalQuotes += 1;
    this.stats.byTier[quote.tier.id] += 1;
    this.stats.largestQuoteCents = Math.max(this.stats.largestQuoteCents, quote.totalCents);

    this.revenue.quotedCents += quote.totalCents;
    this.stats.avgQuoteCents = Math.round(this.revenue.quotedCents / this.stats.totalQuotes);

    this.history.unshift({
      quoteId: quote.quoteId,
      problemId: quote.problemId,
      tenantId: quote.tenantId,
      tier: quote.tier.id,
      totalCents: quote.totalCents,
      total: quote.total,
      status: quote.status,
      generatedAt: quote.generatedAt,
    });

    if (this.history.length > this.options.historyLimit) {
      this.history.pop();
    }
  }
}

module.exports = { PricingModelEngine, TIERS, DISCOUNTS };
module.exports.default = PricingModelEngine;
