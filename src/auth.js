const { API_SECRET } = require("./constants");
const crypto = require("crypto");

/**
 * [getApiSign description]
 * @param {[type]} url [description]
 * @return {[type]} [description]
 */
const hmac = crypto.createHmac("sha512", API_SECRET);
function getApiSign(url) {
  return hmac.update(url).digest("hex");
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
