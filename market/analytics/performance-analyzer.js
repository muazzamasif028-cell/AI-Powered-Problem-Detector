function analyzePerformance(trades) {
  if (!Array.isArray(trades)) {
    throw new TypeError('trades must be an array');
  }

  const closedTrades = trades.filter(
    (trade) =>
      trade &&
      ['WIN', 'LOSS'].includes(trade.result) &&
      Number.isFinite(Number(trade.pnl))
  );

  const wins = closedTrades.filter(
    (trade) => Number(trade.pnl) > 0
  );

  const losses = closedTrades.filter(
    (trade) => Number(trade.pnl) < 0
  );

  const grossProfit = wins.reduce(
    (sum, trade) => sum + Number(trade.pnl),
    0
  );

  const grossLoss = losses.reduce(
    (sum, trade) => sum + Math.abs(Number(trade.pnl)),
    0
  );

  const netPnl = closedTrades.reduce(
    (sum, trade) => sum + Number(trade.pnl),
    0
  );

  const totalTrades = closedTrades.length;

  const winRate =
    totalTrades === 0
      ? 0
      : (wins.length / totalTrades) * 100;

  const averagePnl =
    totalTrades === 0
      ? 0
      : netPnl / totalTrades;

  const profitFactor =
    grossLoss === 0
      ? grossProfit > 0
        ? Infinity
        : 0
      : grossProfit / grossLoss;

  return {
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    winRate: Number(winRate.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(8)),
    grossLoss: Number(grossLoss.toFixed(8)),
    netPnl: Number(netPnl.toFixed(8)),
    averagePnl: Number(averagePnl.toFixed(8)),
    profitFactor:
      Number.isFinite(profitFactor)
        ? Number(profitFactor.toFixed(4))
        : 'Infinity'
  };
}

module.exports = {
  analyzePerformance
};
