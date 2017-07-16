// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const winston = require("winston");
const minimist = require("minimist");

const { getMarketSummaries } = require("../src/bittrex/ApiPublic");
const { sleep } = require("../src/utils");

const argv = minimist(process.argv.slice(2));
const consoleLogger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
      colorize: true,
    }),
  ],
  exitOnError: false,
});
const fileLogger = new winston.Logger({
  transports: [
    new winston.transports.File({
      filename: `logs/bittrex-summaries-${new Date().toLocaleString()}.log`,
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

/**
 * 
 * 
 */
async function summaries() {
  consoleLogger.info("Start logging summaries for Bittrex...");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const summaries = await getMarketSummaries();
    fileLogger.info(JSON.stringify(summaries));
    await sleep(500);
  }
}

// Run program
if (argv.summaries) {
  summaries();
}

module.exports = summaries;
