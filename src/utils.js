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

const infoChalk = chalk.cyanBright;
/**
 * 
 * 
 * @param {any} strings 
 */
function logInfo(...strings) {
  console.log(
    infoChalk(`[${new Date().toLocaleString()}]: ${strings.join(" ")}`)
  );
}

const errorChalk = chalk.bold.redBright;
/**
 * 
 * 
 * @param {any} strings 
 */
function logError(...strings) {
  console.log(
    errorChalk(`[${new Date().toLocaleString()}]: ${strings.join(" ")}`)
  );
}

const warningChalk = chalk.yellowBright;
/**
 * 
 * 
 * @param {any} strings 
 */
function logWarning(...strings) {
  console.log(
    warningChalk(`[${new Date().toLocaleString()}]: ${strings.join(" ")}`)
  );
}

const successChalk = chalk.bold.greenBright;
/**
 * 
 * 
 * @param {any} strings 
 */
function logSuccess(...strings) {
  console.log(
    successChalk(`[${new Date().toLocaleString()}]: ${strings.join(" ")}`)
  );
}

module.exports = {
  isEqual,
  sleep,
  logInfo,
  logError,
  logWarning,
  logSuccess,
};
