const request = require("superagent");

const { GET_MARKET_TICKER_URL, RETRY_COUNT } = require("./constants");

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

module.exports = {
  getMarketTicker,
};
