// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const winston = require("winston");
const chunk = require("lodash/chunk");

const { getExchangeInfo, getMarketTickers } = require("../src/yobit/ApiPublic");
const { sleep } = require("../src/utils");

const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
      colorize: true,
    }),
    new winston.transports.File({
      filename: `logs/yobit-summaries-${new Date().toLocaleString()}.log`,
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

async function trackMarketTickers(marketGroup, index) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tickersMap = await getMarketTickers(marketGroup);
    logger.info(`\n${JSON.stringify(tickersMap, null, 2)}`);
    await sleep(2000);
  }
}

async function main() {
  logger.info("Start logging summaries for Yobit...");

  const exchangeInfo = await getExchangeInfo();
  const btcMarkets = Object.keys(exchangeInfo.pairs).filter(key =>
    key.endsWith("_btc"),
  );
  const btcMarketsGroups = chunk(btcMarkets, 50);

  await Promise.all([
    btcMarketsGroups.map((marketGroup, index) =>
      trackMarketTickers(marketGroup, index),
    ),
  ]);
}

// Run program
main();
