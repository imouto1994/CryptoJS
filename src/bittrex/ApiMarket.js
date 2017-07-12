const {
  BITTREX_API_KEY,
  BITTREX_BUY_LIMIT_ORDER_URL,
  BITTREX_SELL_LIMIT_ORDER_URL,
  BITTREX_CANCEL_ORDER_URL,
  BITTREX_GET_OPEN_ORDERS_URL,
} = require("../constants");
const { getBittrexApiSign, getNonce } = require("../auth");
const { get } = require("../request");

/**
 * 
 * 
 * @param {any} params 
 * @returns 
 */
function makeBuyOrder(params) {
  const { market, quantity, rate } = params;
  const url = `${BITTREX_BUY_LIMIT_ORDER_URL}?apikey=${BITTREX_API_KEY}&nonce=${getNonce()}&market=${market}&quantity=${quantity}&rate=${rate}`;

  return get(url, {
    json: true,
    headers: { apisign: getBittrexApiSign(url) },
  }).then(function(res) {
    const { body } = res;
    if (body.success) {
      return body.result.uuid;
    } else {
      return Promise.reject(
        new Error(
          body.message ||
            `Failed to make a BUY order in market ${market} for amount of ${quantity} at rate ${rate}`,
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
function makeSellOrder(params) {
  const { market, quantity, rate } = params;
  const url = `${BITTREX_SELL_LIMIT_ORDER_URL}?apikey=${BITTREX_API_KEY}&nonce=${getNonce()}&market=${market}&quantity=${quantity}&rate=${rate}`;

  return get(url, {
    json: true,
    headers: { apisign: getBittrexApiSign(url) },
  }).then(function(res) {
    const { body } = res;
    if (body.success) {
      return body.result.uuid;
    } else {
      return Promise.reject(
        new Error(
          body.message ||
            `Failed to make a SELL order in market ${market} for amount of ${quantity} at rate ${rate}`,
        ),
      );
    }
  });
}

/**
 * 
 * 
 * @param {any} orderId 
 * @returns 
 */
function cancelOrder(orderId) {
  const url = `${BITTREX_CANCEL_ORDER_URL}?apikey=${BITTREX_API_KEY}&nonce=${getNonce()}&uuid=${orderId}`;

  return get(url, {
    json: true,
    headers: { apisign: getBittrexApiSign(url) },
  }).then(function(res) {
    const { body } = res;
    if (body.success) {
      return null;
    } else {
      return Promise.reject(
        new Error(body.message || `Failed to cancel order ${orderId}`),
      );
    }
  });
}

/**
 * 
 * 
 * @param {any} market 
 * @returns 
 */
function getOpenOrders(market) {
  const url = `${BITTREX_GET_OPEN_ORDERS_URL}?apikey=${BITTREX_API_KEY}&nonce=${getNonce()}&market=${market}`;

  return get(url, {
    json: true,
    headers: { apisign: getBittrexApiSign(url) },
  }).then(function(res) {
    const { body } = res;
    if (body.success) {
      return body.result;
    } else {
      return Promise.reject(
        new Error(
          body.message ||
            `Failed to fetch list of open orders in market ${market}`,
        ),
      );
    }
  });
}

module.exports = {
  makeBuyOrder,
  makeSellOrder,
  cancelOrder,
  getOpenOrders,
};
