const request = require("superagent");

const {
  API_KEY,
  BUY_LIMIT_ORDER_URL,
  SELL_LIMIT_ORDER_URL,
  CANCEL_ORDER_URL,
  GET_OPEN_ORDERS_URL,
} = require("./constants");
const { getApiSign, getNonce } = require("./auth");
const { logError } = require("./utils");

/**
 * [makeBuyOrder description]
 * @param {[type]} market [description]
 * @param {[type]} quantity [description]
 * @param {[type]} rate [description]
 * @return {[type]} [description]
 */
function makeBuyOrder({ market, quantity, rate }) {
  const url = `${BUY_LIMIT_ORDER_URL}?apikey=${API_KEY}&nonce=${getNonce()}&market=${market}&quantity=${quantity}&rate=${rate}`;

  return request
    .get(url)
    .set("apisign", getApiSign(url))
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
        logError(error);
      }
      throw new Error(
        `Failed to make a BUY order in market ${market} for amount of ${quantity} at rate ${rate}`
      );
    });
}

/**
 * [makeSellOrder description]
 * @param {[type]} market [description]
 * @param {[type]} quantity [description]
 * @param {[type]} rate [description]
 * @return {[type]} [description]
 */
function makeSellOrder({ market, quantity, rate }) {
  const url = `${SELL_LIMIT_ORDER_URL}?apikey=${API_KEY}&nonce=${getNonce()}&market=${market}&quantity=${quantity}&rate=${rate}`;

  return request
    .get(url)
    .set("apisign", getApiSign(url))
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
        logError(error);
      }
      throw new Error(
        `Failed to make a SELL order in market ${market} for amount of ${quantity} at rate ${rate}`
      );
    });
}

/**
 * [cancelOrder description]
 * @param {[type]} orderId [description]
 * @return {[type]} [description]
 */
function cancelOrder(orderId) {
  const url = `${CANCEL_ORDER_URL}?apikey=${API_KEY}&nonce=${getNonce()}&uuid=${orderId}`;

  return request
    .get(url)
    .set("apisign", getApiSign(url))
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
        logError(error);
      }
      throw new Error(`Failed to cancel order ${orderId}`);
    });
}

/**
 * [getOpenOrders description]
 * @param {[type]} market [description]
 * @return {[type]} [description]
 */
function getOpenOrders(market) {
  const url = `${GET_OPEN_ORDERS_URL}?apikey=${API_KEY}&nonce=${getNonce()}&market=${market}`;

  return request
    .get(url)
    .set("apisign", getApiSign(url))
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
