const { evaluateHistoricalCandles } = require('./historical-evaluator');

function optimizeStrategy({
  candles,
  maxTrades = 10,
  stopLossOptions = [0.005, 0.0075, 0.01, 0.0125, 0.015],
  takeProfitOptions = [0.01, 0.015, 0.02, 0.025, 0.03]
}) {
  if (!Array.isArray(candles) || candles.length < 60) {
    throw new Error('At least 60 candles are required');
  }

  const results = [];

  for (const stopLossPercent of stopLossOptions) {
    for (const takeProfitPercent of takeProfitOptions) {
      if (takeProfitPercent <= stopLossPercent) {
        continue;
      }

      const evaluation = evaluateHistoricalCandles({
        candles,
        maxTrades,
        stopLossPercent,
        takeProfitPercent
      });

      results.push({
        stopLossPercent,
        takeProfitPercent,
        ...evaluation.performance
      });
    }
  }

  results.sort((a, b) => {
    if (b.netPnl !== a.netPnl) {
      return b.netPnl - a.netPnl;
    }

    if (b.profitFactor !== a.profitFactor) {
      return b.profitFactor - a.profitFactor;
    }

    return b.winRate - a.winRate;
  });

  return {
    testedConfigurations: results.length,
    best: results[0] || null,
    results
  };
}

module.exports = {
  optimizeStrategy
};
