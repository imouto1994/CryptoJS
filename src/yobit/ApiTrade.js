const get = require("lodash/get");

const { YOBIT_TRADE_API_URL, YOBIT_API_KEY } = require("../constants");
const { logError } = require("../utils");
const { getYobitApiSign, getNonce } = require("../auth");
const { post } = require("../request");

/**
 * 
 * 
 * @param {any} { market, type, rate, amount } 
 */
function makeTradeOrder({ market, type, rate, amount }) {
  const body = {
    nonce: getNonce(),
    method: "Trade",
    pair: market,
    type,
    rate,
    amount,
  };

  return post(YOBIT_TRADE_API_URL, {
    json: true,
    form: true,
    body,
    headers: {
      Key: YOBIT_API_KEY,
      Sign: getYobitApiSign(
        `nonce=${body.nonce}&method=${body.method}&pair=${body.pair}&type=${body.type}&rate=${body.rate}&amount=${body.amount}`,
      ),
    },
  })
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return body.return;
      } else {
        return Promise.reject(body.error);
      }
    })
    .catch(function(error) {
      if (error != null) {
        if (typeof error === "string") {
          logError(error);
        } else {
          logError(get(error, "response.body"));
        }
      }
      throw new Error("Failed to make trade order");
    });
}

/**
 * 
 * 
 * @param {any} orderId 
 */
function getOrderInfo(orderId) {
  const body = {
    nonce: getNonce(),
    method: "OrderInfo",
    order_id: orderId,
  };

  return post(YOBIT_TRADE_API_URL, {
    json: true,
    form: true,
    body,
    headers: {
      Key: YOBIT_API_KEY,
      Sign: getYobitApiSign(
        `nonce=${body.nonce}&method=${body.method}&order_id=${body.order_id}`,
      ),
    },
  })
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return body.return;
      } else {
        return Promise.reject(body.error);
      }
    })
    .catch(function(error) {
      if (error != null) {
        if (typeof error === "string") {
          logError(error);
        } else {
          logError(get(error, "response.body"));
        }
      }
      throw new Error("Failed to get order info");
    });
}

/**
 * 
 * 
 * @param {any} orderId 
 */
function cancelOrder(orderId) {
  const body = {
    nonce: getNonce(),
    method: "CancelOrder",
    order_id: orderId,
  };

  return post(YOBIT_TRADE_API_URL, {
    json: true,
    form: true,
    body,
    headers: {
      Key: YOBIT_API_KEY,
      Sign: getYobitApiSign(
        `nonce=${body.nonce}&method=${body.method}&order_id=${body.order_id}`,
      ),
    },
  })
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return body.return;
      } else {
        return Promise.reject(body.error);
      }
    })
    .catch(function(error) {
      if (error != null) {
        if (typeof error === "string") {
          logError(error);
        } else {
          logError(get(error, "response.body"));
        }
      }
      throw new Error("Failed to cancel order");
    });
}

/**
 * 
 * 
 */
function getAccountInfo() {
  const body = {
    nonce: getNonce(),
    method: "getInfo",
  };

  return post(YOBIT_TRADE_API_URL, {
    json: true,
    form: true,
    body,
    headers: {
      Key: YOBIT_API_KEY,
      Sign: getYobitApiSign(`nonce=${body.nonce}&method=${body.method}`),
    },
  })
    .then(function(res) {
      const { body } = res;
      if (body.success) {
        return body.return;
      } else {
        return Promise.reject(body.error);
      }
    })
    .catch(function(error) {
      if (error != null) {
        if (typeof error === "string") {
          logError(error);
        } else {
          logError(get(error, "response.body"));
        }
      }
      throw new Error("Failed to get account info");
    });
}

module.exports = {
  getAccountInfo,
  makeTradeOrder,
  getOrderInfo,
  cancelOrder,
};
