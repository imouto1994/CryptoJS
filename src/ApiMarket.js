const request = require("superagent");

const {
  API_KEY,
  BUY_LIMIT_ORDER_URL,
  SELL_LIMIT_ORDER_URL,
  CANCEL_ORDER_URL,
  GET_OPEN_ORDERS_URL,
  RETRY_COUNT,
} = require("./constants");
const { getApiSign, getNonce } = require("./auth");

/**
 * [handleBuyOrderResponse description]
 * @param {[type]} res [description]
 * @return {[type]} [description]
 */
function handleBuyOrderResponse(res) {
  const { body } = res;
  if (body.success) {
    return body.result.uuid;
  } else {
    throw new Error("Failed to make a buy order");
  }
}

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
    .retry(RETRY_COUNT)
    .then(handleBuyOrderResponse);
}

/**
 * [handleSellOrderResponse description]
 * @param {[type]} res [description]
 * @return {[type]} [description]
 */
function handleSellOrderResponse(res) {
  const { body } = res;
  if (body.success) {
    return body.result.uuid;
  } else {
    throw new Error("Failed to make a sell order");
  }
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
    .retry(RETRY_COUNT)
    .then(handleSellOrderResponse);
}

/**
 * [handleCancelOrderResponse description]
 * @param {[type]} res [description]
 * @return {[type]} [description]
 */
function handleCancelOrderResponse(res) {
  const { body } = res;
  if (body.success) {
    return null;
  } else {
    throw new Error("Failed to cancel the order");
  }
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
    .retry(RETRY_COUNT)
    .then(handleCancelOrderResponse);
}

/**
 * [handleOpenOrdersResponse description]
 * @param {[type]} res [description]
 * @return {[type]} [description]
 */
function handleOpenOrdersResponse(res) {
  const { body } = res;
  if (body.success) {
    return body.result;
  } else {
    throw new Error("Failed to fetch list of open orders");
  }
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
    .retry(RETRY_COUNT)
    .then(handleOpenOrdersResponse);
}

module.exports = {
  makeBuyOrder,
  makeSellOrder,
  cancelOrder,
  getOpenOrders,
};
