require('dotenv').config();

const express = require('express');

const {
  detectTradeSetup
} = require('../strategy/trade-setup');

const {
  calculateIndicators
} = require('../indicators/technical-indicators');

const app = express();

app.use(express.json({ limit: '256kb' }));

const PORT = Number(
  process.env.MT5_BRIDGE_PORT || 8787
);

const SYMBOL = 'XAU/USD';
const TIMEFRAME = 'M5';

function normalizeSymbol(symbol) {
  const normalized =
    String(symbol || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  if (normalized !== 'XAUUSD') {
    throw new Error(
      'Only XAU/USD is supported'
    );
  }

  return SYMBOL;
}

function validateBars(bars) {
  if (
    !Array.isArray(bars) ||
    bars.length < 60
  ) {
    throw new Error(
      'At least 60 completed M5 bars are required'
    );
  }

  return bars.map((bar) => {
    const normalized = {
      openTime: bar.openTime,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume:
        bar.volume == null
          ? null
          : Number(bar.volume)
    };

    if (
      !Number.isFinite(normalized.open) ||
      !Number.isFinite(normalized.high) ||
      !Number.isFinite(normalized.low) ||
      !Number.isFinite(normalized.close) ||
      normalized.high < normalized.low ||
      normalized.low >
        Math.min(
          normalized.open,
          normalized.close
        ) ||
      normalized.high <
        Math.max(
          normalized.open,
          normalized.close
        )
    ) {
      throw new Error(
        'Invalid OHLC bar'
      );
    }

    return normalized;
  });
}

function round(value, digits = 5) {
  return Number(
    Number(value).toFixed(digits)
  );
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'SUPREME MT5 Decision Bridge',
    symbol: SYMBOL,
    timeframe: TIMEFRAME,
    execution: 'DEMO_ONLY'
  });
});

app.post('/mt5/decision', (req, res) => {
  try {
    const symbol =
      normalizeSymbol(req.body.symbol);

    if (
      String(req.body.timeframe || '')
        .trim()
        .toUpperCase() !== TIMEFRAME
    ) {
      throw new Error(
        'Only M5 timeframe is supported'
      );
    }

    const bid = Number(req.body.bid);
    const ask = Number(req.body.ask);

    if (
      !Number.isFinite(bid) ||
      !Number.isFinite(ask) ||
      bid <= 0 ||
      ask <= 0 ||
      ask < bid
    ) {
      throw new Error(
        'Invalid live bid/ask'
      );
    }

    const bars =
      validateBars(req.body.bars);

    /*
     * MT5 sends only completed candles.
     * Therefore the latest element is the
     * latest CLOSED M5 candle.
     */
    const setup =
      detectTradeSetup(
        bars,
        {
          symbol
        }
      );

    const indicators =
      calculateIndicators(bars);

    const atr14 =
      indicators.atr14;

    let decision = 'HOLD';
    let stopLoss = null;
    let takeProfit = null;
    let entry = null;

    if (
      ['BUY', 'SELL'].includes(
        setup.signal
      ) &&
      Number.isFinite(atr14) &&
      atr14 > 0
    ) {
      decision = setup.signal;

      entry =
        decision === 'BUY'
          ? ask
          : bid;

      const stopDistance =
        atr14 * 2;

      const targetDistance =
        atr14 * 3;

      if (decision === 'BUY') {
        stopLoss =
          entry - stopDistance;

        takeProfit =
          entry + targetDistance;
      } else {
        stopLoss =
          entry + stopDistance;

        takeProfit =
          entry - targetDistance;
      }
    }

    res.json({
      ok: true,
      symbol: SYMBOL,
      timeframe: TIMEFRAME,

      decision,

      entry:
        entry == null
          ? null
          : round(entry),

      stopLoss:
        stopLoss == null
          ? null
          : round(stopLoss),

      takeProfit:
        takeProfit == null
          ? null
          : round(takeProfit),

      atr:
        Number.isFinite(atr14)
          ? round(atr14)
          : null,

      reason:
        setup.reason,

      priceAction:
        setup.priceAction.patterns,

      nearSupport:
        setup.nearSupport,

      nearResistance:
        setup.nearResistance,

      support:
        setup.support?.price ?? null,

      resistance:
        setup.resistance?.price ?? null,

      bid: round(bid),
      ask: round(ask),

      signalCandleTime:
        bars[bars.length - 1]
          .openTime,

      execution:
        'DEMO_ONLY'
    });

  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `SUPREME MT5 Decision Bridge listening on port ${PORT}`
  );

  console.log(
    `Symbol: ${SYMBOL}`
  );

  console.log(
    `Timeframe: ${TIMEFRAME}`
  );

  console.log(
    'Execution: DEMO_ONLY'
  );
});
