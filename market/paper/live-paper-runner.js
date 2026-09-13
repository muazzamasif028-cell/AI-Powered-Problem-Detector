require('dotenv').config();

const {
  LivePaperEngine
} = require('./live-paper-engine');

const MAX_TRADES = 10;
const POLL_MS = 30000;

async function runSession() {
  const engine = new LivePaperEngine({
    pollMs: POLL_MS,
    maxHistory: 100,
    stopLossPercent: 0.01,
    takeProfitPercent: 0.02
  });

  console.log('======================================');
  console.log(' LIVE XAU/USD PAPER SESSION');
  console.log('======================================');
  console.log(`Maximum closed trades: ${MAX_TRADES}`);
  console.log(`Polling interval: ${POLL_MS} ms`);
  console.log('Real-money execution: DISABLED');
  console.log('');

  let timer = null;

  const runCycle = async () => {
    try {
      const result = await engine.tick();

      console.log('\n--- CYCLE ---');
      console.log('Status:', result.status);
      console.log('Time:', result.candleTime || result.timestamp);
      console.log('Price:', result.price);

      if (result.prediction) {
        console.log(
          'Prediction:',
          result.prediction.signal,
          '| Score:',
          result.prediction.score,
          '| Confidence:',
          result.prediction.confidence
        );
      }

      if (result.position) {
        console.log(
          'Position:',
          result.position.signal,
          '| Entry:',
          result.position.entryPrice,
          '| SL:',
          result.position.stopLoss,
          '| TP:',
          result.position.takeProfit
        );
      }

      if (result.trade) {
        console.log(
          'TRADE CLOSED:',
          result.trade.result,
          '| Reason:',
          result.trade.exitReason,
          '| P&L:',
          result.trade.pnl,
          '| P&L %:',
          result.trade.pnlPercent
        );
      }

      const state = engine.getState();

      console.log(
        'Daily trades:',
        state.stats.totalTrades,
        '| Wins:',
        state.stats.wins,
        '| Losses:',
        state.stats.losses,
        '| Net P&L:',
        state.stats.netPnl
      );

      if (state.stats.totalTrades >= MAX_TRADES) {
        console.log('\n======================================');
        console.log(' 10 CLOSED TRADES REACHED');
        console.log(' SESSION STOPPED');
        console.log('======================================');

        console.dir(state.stats, { depth: null });

        clearInterval(timer);
      }
    } catch (error) {
      console.error('\n[LIVE SESSION ERROR]', error.message);
    }
  };

  await runCycle();

  if (engine.getState().stats.totalTrades >= MAX_TRADES) {
    return;
  }

  timer = setInterval(runCycle, POLL_MS);

  process.on('SIGINT', () => {
    clearInterval(timer);

    console.log('\n======================================');
    console.log(' SESSION INTERRUPTED');
    console.log('======================================');

    console.dir(engine.getState(), { depth: null });

    process.exit(0);
  });
}

runSession().catch((error) => {
  console.error('SESSION ERROR:', error.message);
  process.exitCode = 1;
});
