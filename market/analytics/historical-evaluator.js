const { generatePrediction } = require('../prediction/prediction-engine');
const { simulateTrade } = require('../paper/paper-trade-engine');
const { analyzePerformance } = require('./performance-analyzer');

function evaluateHistoricalCandles({
  candles,
  maxTrades = 10,
  stopLossPercent = 0.01,
  takeProfitPercent = 0.02
}) {
  if (!Array.isArray(candles) || candles.length < 60) {
    throw new Error('At least 60 candles are required');
  }

  if (!Number.isInteger(maxTrades) || maxTrades <= 0) {
    throw new Error('maxTrades must be a positive integer');
  }

  const trades = [];
  let nextAvailableSignalIndex = 49;

  for (
    let signalIndex = 49;
    signalIndex < candles.length - 1;
    signalIndex += 1
  ) {
    if (trades.length >= maxTrades) {
      break;
    }

    // Do not open another position while the previous one is active.
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

    trades.push({
      ...trade,
      predictionScore: prediction.score,
      predictionConfidence: prediction.confidence,
      predictionReasons: prediction.reasons
    });

    // The next signal can only occur after this trade has closed.
    nextAvailableSignalIndex = trade.exitIndex + 1;
  }

  return {
    trades,
    performance: analyzePerformance(trades)
  };
}

module.exports = {
  evaluateHistoricalCandles
};
