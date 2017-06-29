const { API_SECRET } = require("./constants");
const hmac = require("./hmac");

/**
 * [getApiSign description]
 * @param {[type]} url [description]
 * @return {[type]} [description]
 */
function getApiSign(url) {
  return hmac.HmacSHA512(url, API_SECRET);
}

/**
 * [getNonce description]
 * @return {[type]} [description]
 */
function getNonce() {
  return Math.floor(new Date().getTime() / 1000);
}

module.exports = {
  getApiSign,
  getNonce,
};
