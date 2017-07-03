const { API_SECRET } = require("./constants");
const crypto = require("crypto");

/**
 * 
 * 
 * @param {any} url 
 * @returns 
 */
function getApiSign(url) {
  const hmac = crypto.createHmac("sha512", API_SECRET);
  return hmac.update(url).digest("hex");
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
  getApiSign,
  getNonce,
};
