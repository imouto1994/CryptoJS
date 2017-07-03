const {
  API_KEY,
  GET_BALANCE_URL,
  GET_ORDER_URL,
  GET_ORDERS_HISTORY_URL,
} = require("./constants");
const { getApiSign, getNonce } = require("./auth");
const { logError } = require("./utils");
const { get } = require("./request");

/**
 * 
 * 
 * @param {any} currency 
 * @returns 
 */
function getAccountBalance(currency) {
  const url = `${GET_BALANCE_URL}?apikey=${API_KEY}&nonce=${getNonce()}&currency=${currency}`;

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
        throw new Error(
          `Failed to fetch account balance for currency ${currency}`
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
function getAccountOrder(orderId) {
  const url = `${GET_ORDER_URL}?apikey=${API_KEY}&nonce=${getNonce()}&uuid=${orderId}`;

  return get(url, { json: true, headers: { apisign: getApiSign(url) } })
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
        logError(error.response.body);
      }
      throw new Error(`Failed to fetch info about order ${orderId}`);
    });
}

/**
 * 
 * 
 * @param {any} market 
 * @returns 
 */
function getAccountOrdersHistory(market) {
  const url = `${GET_ORDERS_HISTORY_URL}?apikey=${API_KEY}&nonce=${getNonce()}&market=${market}`;

  return get(url, { json: true, headers: { apisign: getApiSign(url) } })
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
        logError(error.response.body);
      }
      throw new Error(`Failed to fetch order history for market ${market}`);
    });
}

module.exports = {
  getAccountBalance,
  getAccountOrder,
  getAccountOrdersHistory,
};
