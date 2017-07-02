let config;
try {
  config = require("./config");
} catch (err) {
  console.log("ERROR: No config found");
  config = {};
}

const { API_KEY, API_SECRET } = config;

const API_URL = "https://bittrex.com/api/v1.1";

const GET_MARKET_TICKER_URL = `${API_URL}/public/getticker/`;
const GET_ORDER_BOOK_URL = `${API_URL}/public/getorderbook/`;

const GET_BALANCE_URL = `${API_URL}/account/getbalance/`;
const GET_ORDER_URL = `${API_URL}/account/getorder/`;
const GET_ORDERS_HISTORY_URL = `${API_URL}/account/getorderhistory/`;

const BUY_LIMIT_ORDER_URL = `${API_URL}/market/buylimit/`;
const SELL_LIMIT_ORDER_URL = `${API_URL}/market/selllimit/`;
const CANCEL_ORDER_URL = `${API_URL}/market/cancel/`;
const GET_OPEN_ORDERS_URL = `${API_URL}/market/getopenorders/`;

module.exports = {
  // API Keys & Secrets
  API_KEY,
  API_SECRET,

  // API URLs
  API_URL,

  GET_MARKET_TICKER_URL,
  GET_ORDER_BOOK_URL,

  GET_BALANCE_URL,
  GET_ORDER_URL,
  GET_ORDERS_HISTORY_URL,

  BUY_LIMIT_ORDER_URL,
  SELL_LIMIT_ORDER_URL,
  CANCEL_ORDER_URL,
  GET_OPEN_ORDERS_URL,

  // Market Constants
  CURRENCY_BITCOIN: "BTC",
  CURRENCY_PRECISION: 8,
  COMMISION_RATE: 0.0025,
  BUY_CHUNK_COUNT: 3,
  SELL_CHUNK_COUNT: 3,
  EXCHANGE_RATE_STEP: 0.1,
  EPSILON: 0.0000000001,
};
