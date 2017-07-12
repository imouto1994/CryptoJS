const {
  BITTREX_GET_MARKET_TICKER_URL,
  BITTREX_GET_ORDER_BOOK_URL,
  BITTREX_GET_MARKET_SUMMARY_URL,
  BITTREX_GET_MARKET_SUMMARIES_URL,
} = require("../constants");
const { get } = require("../request");

/**
 * 
 * 
 * @param {any} market 
 * @returns 
 */
function getMarketTicker(market) {
  const url = `${BITTREX_GET_MARKET_TICKER_URL}?market=${market}`;
  return get(url, { json: true }).then(function(res) {
    const { body } = res;
    if (body.success) {
      return body.result;
    } else {
      return Promise.reject(
        new Error(
          body.message || `Failed to fetch ticker for market ${market}`,
        ),
      );
    }
  });
}

/**
 * 
 * 
 * @param {any} params 
 * @returns 
 */
function getOrderBook(params) {
  const { market, type = "both", depth = 20 } = params;
  const url = `${BITTREX_GET_ORDER_BOOK_URL}?market=${market}&type=${type}&depth=${depth}`;

  return get(url, { json: true }).then(function(res) {
    const { body } = res;
    if (body.success) {
      return body.result;
    } else {
      return Promise.reject(
        new Error(
          body.message ||
            `Failed to fetch order book for market ${market} with type ${type.toUpperCase()}`,
        ),
      );
    }
  });
}

function getMarketSummary(market) {
  const url = `${BITTREX_GET_MARKET_SUMMARY_URL}?market=${market}`;
  return get(url, { json: true }).then(function(res) {
    const { body } = res;
    if (body.success) {
      return body.result;
    } else {
      return Promise.reject(
        new Error(
          body.message || `Failed to fetch ticker for market ${market}`,
        ),
      );
    }
  });
}

function getMarketSummaries() {
  const url = BITTREX_GET_MARKET_SUMMARIES_URL;
  return get(url, { json: true }).then(function(res) {
    const { body } = res;
    if (body.success) {
      return body.result;
    } else {
      return Promise.reject(
        new Error(body.message || `Failed to fetch market summaries`),
      );
    }
  });
}

module.exports = {
  getMarketTicker,
  getOrderBook,
  getMarketSummary,
  getMarketSummaries,
};
