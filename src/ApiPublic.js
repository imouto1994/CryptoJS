const request = require("superagent");

const { GET_MARKET_TICKER_URL, GET_ORDER_BOOK_URL } = require("./constants");
const { logError } = require("./utils");

/**
 * [getMarketTicker description]
 * @param {String} market
 * @return {Promise}
 */
function getMarketTicker(market) {
  const url = `${GET_MARKET_TICKER_URL}?market=${market}`;
  return request
    .get(url)
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return body.result;
      } else {
        return Promise.reject();
      }
    })
    .catch(function(error) {
      if (error != null) {
        logError(error);
      }
      throw new Error(`Failed to fetch ticker for market ${market}`);
    });
}

/**
 * [getOrderBook description]
 * @param {[type]} market [description]
 * @param {String} type [description]
 * @param {Number} depth [description]
 * @return {[type]} [description]
 */
function getOrderBook({ market, type = "both", depth = 20 }) {
  const url = `${GET_ORDER_BOOK_URL}?market=${market}&type=${type}&depth=${depth}`;

  return request
    .get(url)
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return body.result;
      } else {
        return Promise.reject();
      }
    })
    .catch(function(error) {
      if (error != null) {
        logError(error);
      }
      throw new Error(
        `Failed to fetch order book for market ${market} with type ${type.toUpperCase()}`
      );
    });
}

module.exports = {
  getMarketTicker,
  getOrderBook,
};
