const {
  API_KEY,
  BUY_LIMIT_ORDER_URL,
  SELL_LIMIT_ORDER_URL,
  CANCEL_ORDER_URL,
  GET_OPEN_ORDERS_URL,
} = require("./constants");
const { getApiSign, getNonce } = require("./auth");
const { logError } = require("./utils");
const { get } = require("./request");

/**
 * 
 * 
 * @param {any} params 
 * @returns 
 */
function makeBuyOrder(params) {
  const { market, quantity, rate } = params;
  const url = `${BUY_LIMIT_ORDER_URL}?apikey=${API_KEY}&nonce=${getNonce()}&market=${market}&quantity=${quantity}&rate=${rate}`;

  return get(url, { json: true, headers: { apisign: getApiSign(url) } })
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return body.result.uuid;
      } else {
        return Promise.reject();
      }
    })
    .catch(function(error) {
      if (error != null) {
        logError(error.response.body);
      }
      throw new Error(
        `Failed to make a BUY order in market ${market} for amount of ${quantity} at rate ${rate}`
      );
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
  const url = `${SELL_LIMIT_ORDER_URL}?apikey=${API_KEY}&nonce=${getNonce()}&market=${market}&quantity=${quantity}&rate=${rate}`;

  return get(url, { json: true, headers: { apisign: getApiSign(url) } })
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return body.result.uuid;
      } else {
        return Promise.reject();
      }
    })
    .catch(function(error) {
      if (error != null) {
        logError(error.response.body);
      }
      throw new Error(
        `Failed to make a SELL order in market ${market} for amount of ${quantity} at rate ${rate}`
      );
    });
}

/**
 * 
 * 
 * @param {any} orderId 
 * @returns 
 */
function cancelOrder(orderId) {
  const url = `${CANCEL_ORDER_URL}?apikey=${API_KEY}&nonce=${getNonce()}&uuid=${orderId}`;

  return get(url, { json: true, headers: { apisign: getApiSign(url) } })
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return null;
      } else {
        return Promise.reject();
      }
    })
    .catch(function(error) {
      if (error != null) {
        logError(error.response.body);
      }
      throw new Error(`Failed to cancel order ${orderId}`);
    });
}

/**
 * 
 * 
 * @param {any} market 
 * @returns 
 */
function getOpenOrders(market) {
  const url = `${GET_OPEN_ORDERS_URL}?apikey=${API_KEY}&nonce=${getNonce()}&market=${market}`;

  return get(url, { json: true, headers: { apisign: getApiSign(url) } })
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
        `Failed to fetch list of open orders in market ${market}`
      );
    });
}

module.exports = {
  makeBuyOrder,
  makeSellOrder,
  cancelOrder,
  getOpenOrders,
};
