const axios = require('axios');
require('dotenv').config();

const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';
const XAU_USD_SYMBOL = 'XAU/USD';

const INTERVALS = new Set([
  '1min',
  '5min',
  '15min',
  '30min',
  '1h',
  '2h',
  '4h',
  '1day'
]);

function normalizeSymbol(symbol = XAU_USD_SYMBOL) {
  const normalized = String(symbol).trim().toUpperCase();

  if (normalized !== XAU_USD_SYMBOL) {
    throw new Error('Only XAU/USD is supported');
  }

  return XAU_USD_SYMBOL;
}

function validateInterval(interval = '5min') {
  if (!INTERVALS.has(interval)) {
    throw new Error(
      `Unsupported interval: ${interval}. Supported: ${[
        ...INTERVALS
      ].join(', ')}`
    );
  }

  return interval;
}

function normalizeCandle(candle) {
  return {
    openTime: new Date(candle.datetime).toISOString(),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: candle.volume == null ? null : Number(candle.volume),
    closeTime: null,
    quoteVolume: null,
    trades: null
  };
}

function getApiKey() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    throw new Error('TWELVE_DATA_API_KEY is not configured');
  }

  return apiKey;
}

async function getCandles({
  symbol = XAU_USD_SYMBOL,
  interval = '5min',
  limit = 100
} = {}) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedInterval = validateInterval(interval);
  const apiKey = getApiKey();

  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
    throw new Error('limit must be an integer between 1 and 5000');
  }

  const response = await axios.get(`${TWELVE_DATA_BASE_URL}/time_series`, {
    params: {
      symbol: normalizedSymbol,
      interval: normalizedInterval,
      outputsize: limit,
      order: 'ASC',
      apikey: apiKey
    },
    timeout: 15000
  });

  if (response.data?.status === 'error') {
    throw new Error(
      response.data.message || 'Twelve Data returned an error'
    );
  }

  if (!Array.isArray(response.data?.values)) {
    throw new Error('Market data provider returned an invalid response');
  }

  return response.data.values.map(normalizeCandle);
}

async function getTicker(symbol = XAU_USD_SYMBOL) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const apiKey = getApiKey();

  const response = await axios.get(`${TWELVE_DATA_BASE_URL}/price`, {
    params: {
      symbol: normalizedSymbol,
      apikey: apiKey
    },
    timeout: 15000
  });

  if (response.data?.status === 'error') {
    throw new Error(
      response.data.message || 'Twelve Data returned an error'
    );
  }

  const price = Number(response.data.price);

  if (!Number.isFinite(price)) {
    throw new Error('Twelve Data returned an invalid XAU/USD price');
  }

  return {
    symbol: normalizedSymbol,
    price
  };
}

module.exports = {
  getCandles,
  getTicker,
  normalizeCandle,
  normalizeSymbol,
  validateInterval
};
