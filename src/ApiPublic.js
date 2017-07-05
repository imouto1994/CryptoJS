const {
  GET_MARKET_TICKER_URL,
  GET_ORDER_BOOK_URL,
  GET_MARKET_SUMMARY_URL,
  GET_MARKET_SUMMARIES_URL,
} = require("./constants");
const { logError } = require("./utils");
const { get } = require("./request");

/**
 * 
 * 
 * @param {any} market 
 * @returns 
 */
function getMarketTicker(market) {
  const url = `${GET_MARKET_TICKER_URL}?market=${market}`;
  return get(url, { json: true })
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
        logError(error.response.body);
      }
      throw new Error(`Failed to fetch ticker for market ${market}`);
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
  const url = `${GET_ORDER_BOOK_URL}?market=${market}&type=${type}&depth=${depth}`;

  return get(url, { json: true })
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
        logError(error.response.body);
      }
      throw new Error(
        `Failed to fetch order book for market ${market} with type ${type.toUpperCase()}`
      );
    });
}

function getMarketSummary(market) {
  const url = `${GET_MARKET_SUMMARY_URL}?market=${market}`;
  return get(url, { json: true })
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
        logError(error.response.body);
      }
      throw new Error(`Failed to fetch ticker for market ${market}`);
    });
}

function getMarketSummaries() {
  const url = GET_MARKET_SUMMARIES_URL;
  return get(url, { json: true })
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
        logError(error.response.body);
      }
      throw new Error(`Failed to fetch market summaries`);
    });
}

module.exports = {
  getMarketTicker,
  getOrderBook,
  getMarketSummary,
  getMarketSummaries,
};
