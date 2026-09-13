function toNumbers(values) {
  if (!Array.isArray(values)) {
    throw new TypeError('values must be an array');
  }

  const numbers = values.map(Number);

  if (numbers.some((value) => !Number.isFinite(value))) {
    throw new Error('values must contain only finite numbers');
  }

  return numbers;
}

function sma(values, period) {
  const numbers = toNumbers(values);

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (numbers.length < period) {
    return null;
  }

  const slice = numbers.slice(-period);

  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function ema(values, period) {
  const numbers = toNumbers(values);

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (numbers.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);

  let current =
    numbers
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < numbers.length; i += 1) {
    current =
      (numbers[i] - current) * multiplier + current;
  }

  return current;
}

function rsi(values, period = 14) {
  const numbers = toNumbers(values);

  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer');
  }

  if (numbers.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = numbers[i] - numbers[i - 1];

    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let i = period + 1; i < numbers.length; i += 1) {
    const change = numbers[i] - numbers[i - 1];

    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    averageGain =
      ((averageGain * (period - 1)) + gain) / period;

    averageLoss =
      ((averageLoss * (period - 1)) + loss) / period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;

  return 100 - (100 / (1 + relativeStrength));
}

function macd(
  values,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  const numbers = toNumbers(values);

  if (
    numbers.length < slowPeriod + signalPeriod
  ) {
    return null;
  }

  const multiplierFast = 2 / (fastPeriod + 1);
  const multiplierSlow = 2 / (slowPeriod + 1);

  let fastEma =
    numbers
      .slice(0, fastPeriod)
      .reduce((sum, value) => sum + value, 0) /
    fastPeriod;

  let slowEma =
    numbers
      .slice(0, slowPeriod)
      .reduce((sum, value) => sum + value, 0) /
    slowPeriod;

  const macdValues = [];

  for (let i = fastPeriod; i < slowPeriod; i += 1) {
    fastEma =
      (numbers[i] - fastEma) * multiplierFast + fastEma;
  }

  for (let i = slowPeriod; i < numbers.length; i += 1) {
    fastEma =
      (numbers[i] - fastEma) * multiplierFast + fastEma;

    slowEma =
      (numbers[i] - slowEma) * multiplierSlow + slowEma;

    macdValues.push(fastEma - slowEma);
  }

  if (macdValues.length < signalPeriod) {
    return null;
  }

  const signal = ema(macdValues, signalPeriod);
  const macdLine = macdValues[macdValues.length - 1];

  return {
    macd: macdLine,
    signal,
    histogram: macdLine - signal
  };
}

function volatility(candles, period = 20) {
  if (!Array.isArray(candles)) {
    throw new TypeError('candles must be an array');
  }

  if (candles.length < period) {
    return null;
  }

  const recent = candles.slice(-period);

  const returns = [];

  for (let i = 1; i < recent.length; i += 1) {
    const previousClose = Number(recent[i - 1].close);
    const currentClose = Number(recent[i].close);

    if (
      !Number.isFinite(previousClose) ||
      !Number.isFinite(currentClose) ||
      previousClose <= 0
    ) {
      throw new Error('Invalid candle close value');
    }

    returns.push((currentClose - previousClose) / previousClose);
  }

  const mean =
    returns.reduce((sum, value) => sum + value, 0) /
    returns.length;

  const variance =
    returns.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0
    ) / returns.length;

  return Math.sqrt(variance);
}

function volumeRatio(candles, period = 20) {
  if (!Array.isArray(candles)) {
    throw new TypeError('candles must be an array');
  }

  if (candles.length < period + 1) {
    return null;
  }

  const currentVolume = Number(
    candles[candles.length - 1].volume
  );

  const previous = candles
    .slice(-(period + 1), -1)
    .map((candle) => Number(candle.volume));

  if (
    !Number.isFinite(currentVolume) ||
    previous.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('Invalid candle volume value');
  }

  const averageVolume =
    previous.reduce((sum, value) => sum + value, 0) /
    previous.length;

  if (averageVolume === 0) {
    return null;
  }

  return currentVolume / averageVolume;
}

function calculateIndicators(candles) {
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error('candles must be a non-empty array');
  }

  const closes = candles.map((candle) => Number(candle.close));

  return {
    price: closes[closes.length - 1],
    sma20: sma(closes, 20),
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    volatility20: volatility(candles, 20),
    volumeRatio20: volumeRatio(candles, 20)
  };
}

module.exports = {
  sma,
  ema,
  rsi,
  macd,
  volatility,
  volumeRatio,
  calculateIndicators
};
