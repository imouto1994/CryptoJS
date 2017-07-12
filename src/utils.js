const chalk = require("chalk");

const { EPSILON } = require("./constants");

/**
 *
 *
 * @param {any} a
 * @param {any} b
 * @returns
 */
function isEqual(a, b) {
  return Math.abs(a - b) < EPSILON;
}

/**
 *
 *
 * @param {any} duration
 * @returns
 */
function sleep(duration) {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve();
    }, duration);
  });
}

/**
 *
 *
 * @returns
 */
function getCurrentTime() {
  return new Date().getTime();
}

module.exports = {
  isEqual,
  sleep,
  getCurrentTime,
};
