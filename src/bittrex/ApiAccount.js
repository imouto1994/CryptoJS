const {
  BITTREX_API_KEY,
  BITTREX_GET_BALANCE_URL,
  BITTREX_GET_ORDER_URL,
  BITTREX_GET_ORDERS_HISTORY_URL,
} = require("../constants");
const { getBittrexApiSign, getNonce } = require("../auth");
const { get } = require("../request");

/**
 *
 *
 * @param {any} currency
 * @returns
 */
function getAccountBalance(currency) {
  const url = `${BITTREX_GET_BALANCE_URL}?apikey=${BITTREX_API_KEY}&nonce=${getNonce()}&currency=${currency}`;

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
            `Failed to fetch account balance for currency ${currency}`,
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
function getAccountOrder(orderId) {
  const url = `${BITTREX_GET_ORDER_URL}?apikey=${BITTREX_API_KEY}&nonce=${getNonce()}&uuid=${orderId}`;

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
          body.message || `Failed to fetch info about order ${orderId}`,
        ),
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
function getAccountOrdersHistory(market) {
  const url = `${BITTREX_GET_ORDERS_HISTORY_URL}?apikey=${BITTREX_API_KEY}&nonce=${getNonce()}&market=${market}`;

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
          body.message || `Failed to fetch order history for market ${market}`,
        ),
      );
    }
  });
}

module.exports = {
  getAccountBalance,
  getAccountOrder,
  getAccountOrdersHistory,
};
