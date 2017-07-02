const chalk = require("chalk");

const { EPSILON } = require("./constants");

function isEqual(a, b) {
  return Math.abs(a - b) < EPSILON;
}

function sleep(duration) {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve();
    }, duration);
  });
}

const infoChalk = chalk.cyanBright;
function logInfo(...strings) {
  console.log(
    infoChalk(`[${new Date().toLocaleString()}]: ${strings.join(" ")}`)
  );
}

const errorChalk = chalk.bold.redBright;
function logError(...strings) {
  console.log(
    errorChalk(`[${new Date().toLocaleString()}]: ${strings.join(" ")}`)
  );
}

const warningChalk = chalk.yellowBright;
function logWarning(...strings) {
  console.log(
    warningChalk(`[${new Date().toLocaleString()}]: ${strings.join(" ")}`)
  );
}

const successChalk = chalk.bold.greenBright;
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
