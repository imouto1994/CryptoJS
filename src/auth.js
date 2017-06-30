const { API_SECRET } = require("./constants");
const crypto = require("crypto");

/**
 * [getApiSign description]
 * @param {[type]} url [description]
 * @return {[type]} [description]
 */
function getApiSign(url) {
  const hmac = crypto.createHmac("sha512", API_SECRET);
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
