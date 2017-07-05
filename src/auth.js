const { BITTREX_API_SECRET, YOBIT_API_SECRET } = require("./constants");
const crypto = require("crypto");

/**
 * 
 * 
 * @param {any} url 
 * @returns 
 */
function getBittrexApiSign(url) {
  const hmac = crypto.createHmac("sha512", BITTREX_API_SECRET);
  return hmac.update(url).digest("hex");
}

/**
 * 
 * 
 * @param {any} paramString 
 * @returns 
 */
function getYobitApiSign(paramString) {
  const hmac = crypto.createHmac("sha512", YOBIT_API_SECRET);
  return hmac.update(paramString).digest("hex");
}

/**
 * 
 * 
 * @returns 
 */
function getNonce() {
  return Math.floor(new Date().getTime() / 1000);
}

module.exports = {
  getBittrexApiSign,
  getYobitApiSign,
  getNonce,
};
