const got = require("got");
const HttpsAgent = require("agentkeepalive").HttpsAgent;

const KeepAliveAgent = new HttpsAgent({});

/**
 * 
 * 
 * @param {any} url 
 * @param {any} options 
 * @returns 
 */
function get(url, options) {
  return got(url, Object.assign({}, { agent: KeepAliveAgent }, options));
}

module.exports = {
  get,
};
