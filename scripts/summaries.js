// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const winston = require("winston");

const { getMarketSummaries } = require("../src/ApiPublic");
const { sleep } = require("../src/utils");

const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
    new winston.transports.File({
      filename: "logs/summaries.log",
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

async function main() {
  logger.info("Start logging summaries...");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const summaries = await getMarketSummaries();
    logger.info(`\n${JSON.stringify(summaries, null, 2)}`);
    await sleep(1000);
  }
}

// Run program
main();
