const request = require("superagent");

const {
  GET_MARKET_TICKER_URL,
  GET_ORDER_BOOK_URL,
  RETRY_COUNT,
} = require("./constants");

/**
 * [handleMarketResponse description]
 * @param {[type]} res [description]
 * @return {[type]} [description]
 */
function handleMarketTickerResponse(res) {
  const { body } = res;
  if (body.success) {
    return body.result;
  } else {
    throw new Error("Failed to fetch market ticker");
  }
}

/**
 * [getMarketTicker description]
 * @param {String} market
 * @return {Promise}
 */
function getMarketTicker(market) {
  const url = `${GET_MARKET_TICKER_URL}?market=${market}`;

  return request.get(url).retry(RETRY_COUNT).then(handleMarketTickerResponse);
}

/**
 * [handleOrderBookResponse description]
 * @param {[type]} res [description]
 * @return {[type]} [description]
 */
function handleOrderBookResponse(res) {
  const { body } = res;
  if (body.success) {
    return body.result;
  } else {
    throw new Error("Failed to fetch order book");
  }
}

/**
 * [getOrderBook description]
 * @param {[type]} market [description]
 * @param {String} type [description]
 * @param {Number} depth [description]
 * @return {[type]} [description]
 */
function getOrderBook(market, type = "both", depth = 20) {
  const url = `${GET_ORDER_BOOK_URL}?market=${market}&type=${type}&depth=${depth}`;

  return request.get(url).retry(RETRY_COUNT).then(handleOrderBookResponse);
}

module.exports = {
  getMarketTicker,
  getOrderBook,
};
