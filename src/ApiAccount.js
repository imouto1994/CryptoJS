const request = require("superagent");

const {
  API_KEY,
  GET_BALANCE_URL,
  GET_ORDER_URL,
  GET_ORDERS_HISTORY_URL,
} = require("./constants");
const { getApiSign, getNonce } = require("./auth");
const { logError } = require("./utils");

/**
 * [getAccountBalance description]
 * @param {[type]} currency [description]
 * @return {[type]} [description]
 */
function getAccountBalance(currency) {
  const url = `${GET_BALANCE_URL}?apikey=${API_KEY}&nonce=${getNonce()}&currency=${currency}`;

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
        throw new Error(
          `Failed to fetch account balance for currency ${currency}`
        );
      }
    });
}

function getAccountOrder(orderId) {
  const url = `${GET_ORDER_URL}?apikey=${API_KEY}&nonce=${getNonce()}&uuid=${orderId}`;

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
    .catch(error => {
      if (error != null) {
        logError(error);
      }
      throw new Error(`Failed to fetch info about order ${orderId}`);
    });
}

function getAccountOrdersHistory(market) {
  const url = `${GET_ORDERS_HISTORY_URL}?apikey=${API_KEY}&nonce=${getNonce()}&market=${market}`;

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
    .catch(error => {
      if (error != null) {
        logError(error);
      }
      throw new Error(`Failed to fetch order history for market ${market}`);
    });
}

module.exports = {
  getAccountBalance,
  getAccountOrder,
  getAccountOrdersHistory,
};
