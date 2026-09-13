const {
  getCandles,
  getTicker
} = require('../data/market-data.service');

const { generatePrediction } = require('../prediction/prediction-engine');

const SYMBOL = 'XAU/USD';
const INTERVAL = '5min';

class LivePaperEngine {
  constructor({
    pollMs = 30000,
    maxHistory = 100,
    stopLossPercent = 0.01,
    takeProfitPercent = 0.02
  } = {}) {
    this.pollMs = pollMs;
    this.maxHistory = maxHistory;
    this.stopLossPercent = stopLossPercent;
    this.takeProfitPercent = takeProfitPercent;

    this.timer = null;
    this.lastCandleTime = null;

    this.position = null;

    this.trades = [];
    this.stats = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      netPnl: 0
    };
  }

  calculateLevels(signal, entryPrice) {
    if (signal === 'BUY') {
      return {
        stopLoss: entryPrice * (1 - this.stopLossPercent),
        takeProfit: entryPrice * (1 + this.takeProfitPercent)
      };
    }

    if (signal === 'SELL') {
      return {
        stopLoss: entryPrice * (1 + this.stopLossPercent),
        takeProfit: entryPrice * (1 - this.takeProfitPercent)
      };
    }

    throw new Error(`Unsupported signal: ${signal}`);
  }

  calculatePnl(signal, entryPrice, exitPrice) {
    return signal === 'BUY'
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;
  }

  openPosition(signal, entryPrice, candleTime, prediction) {
    const levels = this.calculateLevels(signal, entryPrice);

    this.position = {
      symbol: SYMBOL,
      interval: INTERVAL,
      signal,
      entryPrice,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      entryTime: candleTime,
      predictionScore: prediction.score,
      predictionConfidence: prediction.confidence
    };

    return this.position;
  }

  closePosition(exitPrice, exitReason, exitTime) {
    if (!this.position) {
      return null;
    }

    const pnl = this.calculatePnl(
      this.position.signal,
      this.position.entryPrice,
      exitPrice
    );

    const trade = {
      ...this.position,
      exitPrice,
      exitReason,
      exitTime,
      pnl,
      pnlPercent: (pnl / this.position.entryPrice) * 100,
      result: pnl > 0 ? 'WIN' : 'LOSS'
    };

    this.trades.push(trade);

    this.stats.totalTrades += 1;

    if (trade.result === 'WIN') {
      this.stats.wins += 1;
    } else {
      this.stats.losses += 1;
    }

    this.stats.netPnl += pnl;

    this.position = null;

    return trade;
  }

  evaluateCandle(candle) {
    if (!this.position) {
      return null;
    }

    if (
      !candle ||
      !Number.isFinite(Number(candle.high)) ||
      !Number.isFinite(Number(candle.low))
    ) {
      throw new Error('Invalid candle OHLC data');
    }

    const { signal, stopLoss, takeProfit } = this.position;
    const timestamp =
      candle.openTime || new Date().toISOString();

    if (signal === 'BUY') {
      // Conservative rule: if both SL and TP are touched,
      // count STOP_LOSS first because candle order is unknown.
      if (candle.low <= stopLoss) {
        return this.closePosition(
          stopLoss,
          'STOP_LOSS',
          timestamp
        );
      }

      if (candle.high >= takeProfit) {
        return this.closePosition(
          takeProfit,
          'TAKE_PROFIT',
          timestamp
        );
      }
    }

    if (signal === 'SELL') {
      if (candle.high >= stopLoss) {
        return this.closePosition(
          stopLoss,
          'STOP_LOSS',
          timestamp
        );
      }

      if (candle.low <= takeProfit) {
        return this.closePosition(
          takeProfit,
          'TAKE_PROFIT',
          timestamp
        );
      }
    }

    return null;
  }

  async monitorPrice() {
    const ticker = await getTicker(SYMBOL);

    if (!ticker || !Number.isFinite(Number(ticker.price))) {
      throw new Error('Invalid XAU/USD ticker price');
    }

    const price = Number(ticker.price);
    const timestamp = new Date().toISOString();

    const closedTrade = this.evaluateLivePrice(
      price,
      timestamp
    );

    return {
      symbol: SYMBOL,
      price,
      timestamp,
      status: closedTrade
        ? 'TRADE_CLOSED'
        : this.position
          ? 'POSITION_OPEN'
          : 'NO_POSITION',
      trade: closedTrade,
      position: this.position,
      stats: { ...this.stats }
    };
  }

  async tick() {
    const candles = await getCandles({
      symbol: SYMBOL,
      interval: INTERVAL,
      limit: this.maxHistory
    });

    const latest = candles[candles.length - 1];

    if (!latest) {
      throw new Error('No XAU/USD candle received');
    }

    // Ignore repeated polling of the same candle.
    if (latest.openTime === this.lastCandleTime) {
      return {
        status: 'NO_NEW_CANDLE',
        symbol: SYMBOL,
        interval: INTERVAL,
        candleTime: latest.openTime,
        price: latest.close,
        position: this.position,
        stats: { ...this.stats }
      };
    }

    // A new candle has arrived.
    this.lastCandleTime = latest.openTime;

    // First manage an existing position using candle OHLC.
    if (this.position) {
      const closedTrade = this.evaluateCandle(latest);

      if (closedTrade) {
        return {
          status: 'TRADE_CLOSED',
          symbol: SYMBOL,
          interval: INTERVAL,
          candleTime: latest.openTime,
          price: latest.close,
          trade: closedTrade,
          stats: { ...this.stats }
        };
      }

      return {
        status: 'POSITION_OPEN',
        symbol: SYMBOL,
        interval: INTERVAL,
        candleTime: latest.openTime,
        price: latest.close,
        position: this.position,
        stats: { ...this.stats }
      };
    }

    // Only generate a new prediction when no position is active.
    const prediction = generatePrediction(candles);

    if (!['BUY', 'SELL'].includes(prediction.signal)) {
      return {
        status: 'NO_SIGNAL',
        symbol: SYMBOL,
        interval: INTERVAL,
        candleTime: latest.openTime,
        price: latest.close,
        prediction,
        stats: { ...this.stats }
      };
    }

    const position = this.openPosition(
      prediction.signal,
      latest.close,
      latest.openTime,
      prediction
    );

    return {
      status: 'POSITION_OPENED',
      symbol: SYMBOL,
      interval: INTERVAL,
      candleTime: latest.openTime,
      price: latest.close,
      prediction,
      position,
      stats: { ...this.stats }
    };
  }

  start() {
    if (this.timer) {
      return;
    }

    console.log(
      `[LIVE PAPER] Starting ${SYMBOL} ${INTERVAL} monitor...`
    );

    const runTick = async () => {
      try {
        const result = await this.tick();

        console.dir(result, { depth: null });
      } catch (error) {
        console.error(
          '[LIVE PAPER ERROR]',
          error.message
        );
      }
    };

    runTick();

    this.timer = setInterval(
      runTick,
      this.pollMs
    );
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;

    console.log(
      '[LIVE PAPER] Monitor stopped.'
    );
  }

  getState() {
    return {
      symbol: SYMBOL,
      interval: INTERVAL,
      position: this.position,
      trades: [...this.trades],
      stats: { ...this.stats }
    };
  }
}

module.exports = {
  LivePaperEngine,
  SYMBOL,
  INTERVAL
};
