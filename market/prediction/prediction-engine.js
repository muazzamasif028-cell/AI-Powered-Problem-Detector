const {
  calculateIndicators
} = require('../indicators/technical-indicators');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function generatePrediction(candles) {
  if (!Array.isArray(candles) || candles.length < 50) {
    throw new Error(
      'At least 50 candles are required for prediction'
    );
  }

  const indicators = calculateIndicators(candles);

  const {
    price,
    sma20,
    ema9,
    ema21,
    rsi14,
    macd,
    volumeRatio20
  } = indicators;

  if (
    !Number.isFinite(price) ||
    !Number.isFinite(sma20) ||
    !Number.isFinite(ema9) ||
    !Number.isFinite(ema21) ||
    !Number.isFinite(rsi14) ||
    !macd
  ) {
    throw new Error(
      'Insufficient indicator data for prediction'
    );
  }

  let score = 0;
  const reasons = [];

  // Trend
  if (price > ema21) {
    score += 2;
    reasons.push('Price is above EMA21');
  } else {
    score -= 2;
    reasons.push('Price is below EMA21');
  }

  if (ema9 > ema21) {
    score += 2;
    reasons.push('EMA9 is above EMA21');
  } else {
    score -= 2;
    reasons.push('EMA9 is below EMA21');
  }

  // SMA confirmation
  if (price > sma20) {
    score += 1;
    reasons.push('Price is above SMA20');
  } else {
    score -= 1;
    reasons.push('Price is below SMA20');
  }

  // MACD momentum
  if (macd.histogram > 0) {
    score += 2;
    reasons.push('MACD histogram is positive');
  } else {
    score -= 2;
    reasons.push('MACD histogram is negative');
  }

  // RSI
  if (rsi14 >= 50 && rsi14 < 70) {
    score += 1;
    reasons.push('RSI supports bullish momentum');
  } else if (rsi14 > 30 && rsi14 < 50) {
    score -= 1;
    reasons.push('RSI supports bearish momentum');
  } else if (rsi14 >= 70) {
    reasons.push('RSI is overbought');
  } else if (rsi14 <= 30) {
    reasons.push('RSI is oversold');
  }

  // Volume confirmation
  if (Number.isFinite(volumeRatio20)) {
    if (volumeRatio20 >= 1.2) {
      if (score > 0) {
        score += 1;
        reasons.push('Volume confirms the current direction');
      } else if (score < 0) {
        score -= 1;
        reasons.push('Volume confirms the current direction');
      }
    } else {
      reasons.push('Volume confirmation is weak');
    }
  }

  let signal = 'HOLD';

  if (score >= 4) {
    signal = 'BUY';
  } else if (score <= -4) {
    signal = 'SELL';
  }

  const maxScore = 9;

  const confidence = clamp(
    50 + (Math.abs(score) / maxScore) * 45,
    50,
    95
  );

  return {
    signal,
    score,
    confidence: Number(confidence.toFixed(2)),
    price,
    indicators,
    reasons,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  generatePrediction
};
