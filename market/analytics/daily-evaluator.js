const { generatePrediction } = require('../prediction/prediction-engine');
const { simulateTrade } = require('../paper/paper-trade-engine');
const { analyzePerformance } = require('./performance-analyzer');

function evaluateDailyCandles({
  candles,
  date,
  maxTrades = 10,
  stopLossPercent = 0.01,
  takeProfitPercent = 0.02
}) {
  if (!Array.isArray(candles) || candles.length < 60) {
    throw new Error('At least 60 candles are required');
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('date must use YYYY-MM-DD format');
  }

  if (!Number.isInteger(maxTrades) || maxTrades <= 0) {
    throw new Error('maxTrades must be a positive integer');
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const dayStartIndex = candles.findIndex(
    (candle) => new Date(candle.openTime) >= dayStart
  );

  const dayEndIndex = candles.findIndex(
    (candle) => new Date(candle.openTime) >= nextDay
  );

  const startIndex =
    dayStartIndex === -1 ? candles.length : dayStartIndex;

  const endIndex =
    dayEndIndex === -1 ? candles.length : dayEndIndex;

  const trades = [];
  let nextAvailableSignalIndex = Math.max(49, startIndex);

  for (
    let signalIndex = Math.max(49, startIndex);
    signalIndex < endIndex - 1;
    signalIndex += 1
  ) {
    if (trades.length >= maxTrades) {
      break;
    }

    if (signalIndex < nextAvailableSignalIndex) {
      continue;
    }

    const history = candles.slice(0, signalIndex + 1);
    const prediction = generatePrediction(history);

    if (!['BUY', 'SELL'].includes(prediction.signal)) {
      continue;
    }

    const trade = simulateTrade({
      candles,
      signal: prediction.signal,
      signalIndex,
      stopLossPercent,
      takeProfitPercent
    });

    if (trade.result !== 'WIN' && trade.result !== 'LOSS') {
      continue;
    }

    // Keep only trades whose entry belongs to the requested UTC day.
    const entryDate = trade.entryTime
      ? new Date(trade.entryTime).toISOString().slice(0, 10)
      : null;

    if (entryDate !== date) {
      continue;
    }

    trades.push({
      ...trade,
      predictionScore: prediction.score,
      predictionConfidence: prediction.confidence,
      predictionReasons: prediction.reasons
    });

    nextAvailableSignalIndex = trade.exitIndex + 1;
  }

  return {
    symbol: 'XAU/USD',
    interval: '5min',
    date,
    maxTrades,
    trades,
    performance: analyzePerformance(trades)
  };
}

module.exports = {
  evaluateDailyCandles
};
