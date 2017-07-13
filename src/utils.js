const moment = require("moment");

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

/**
 * 
 * 
 * @param {any} timeString 
 * @returns 
 */
function getTimeInUTC(timeString) {
  return moment(`${timeString}+0000`).valueOf();
}

module.exports = {
  isEqual,
  sleep,
  getCurrentTime,
  getTimeInUTC,
};
