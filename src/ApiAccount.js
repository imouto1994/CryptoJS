const request = require("superagent");

const { API_KEY, GET_BALANCE_URL, RETRY_COUNT } = require("./constants");
const { getApiSign, getNonce } = require("./auth");

/**
 * [handleAccountBalanceResponse description]
 * @param {[type]} res [description]
 * @return {[type]} [description]
 */
function handleAccountBalanceResponse(res) {
  const { body } = res;
  if (body.success) {
    return body.result;
  } else {
    throw new Error("Failed to fetch account balance");
  }
}

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
    .retry(RETRY_COUNT)
    .then(handleAccountBalanceResponse);
}

module.exports = {
  getAccountBalance,
};
