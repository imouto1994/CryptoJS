const {
  YOBIT_GET_MARKET_DEPTH_URL,
  YOBIT_GET_MARKET_TICKER_URL,
  YOBIT_GET_MARKET_TRADES_URL,
  YOBIT_GET_EXCHANGE_INFO,
} = require("../constants");
const { get } = require("../request");

/**
 * 
 * 
 * @returns 
 */
function getExchangeInfo() {
  const url = YOBIT_GET_EXCHANGE_INFO;
  return get(url, { json: true }).then(function(res) {
    const { body } = res;
    return body;
  });
}

/**
 * 
 * 
 * @param {any} markets 
 * @returns 
 */
function getMarketDepths(markets, limit = 150) {
  const url =
    YOBIT_GET_MARKET_DEPTH_URL +
    markets.join("-") +
    `?ignore_invalid=1&limit=${limit}`;
  return get(url, { json: true }).then(function(res) {
    const { body } = res;
    return body;
  });
}

/**
 * 
 * 
 * @param {any} markets 
 * @returns 
 */
function getMarketTickers(markets) {
  const url =
    YOBIT_GET_MARKET_TICKER_URL + markets.join("-") + "?ignore_invalid=1";
  return get(url, { json: true }).then(function(res) {
    const { body } = res;
    return body;
  });
}

/**
 * 
 * 
 * @param {any} markets 
 * @returns 
 */
function getMarketTrades(markets, limit = 150) {
  const url =
    YOBIT_GET_MARKET_TRADES_URL +
    markets.join("-") +
    `?ignore_invalid=1&limit=${limit}`;
  return get(url, { json: true }).then(function(res) {
    const { body } = res;
    return body;
  });
}

module.exports = {
  getMarketDepths,
  getMarketTickers,
  getMarketTrades,
  getExchangeInfo,
};
