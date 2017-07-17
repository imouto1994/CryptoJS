// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const winston = require("winston");
const chunk = require("lodash/chunk");
const path = require("path");
const fs = require("fs");

const { getExchangeInfo } = require("../src/yobit/ApiPublic");
const { get } = require("../src/request");

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

async function trackMarketId(marketGroup, marketIds) {
  for (let i = 0; i < marketGroup.length; i++) {
    const btcMarket = marketGroup[i];
    const { body: htmlContent } = await get(
      `https://yobit.net/en/trade/${btcMarket.split("_")[0].toUpperCase()}/BTC`,
    );
    const match = htmlContent.match(/var pair_id = '(\d*)';/);
    marketIds.push([btcMarket, match[1]]);
  }
}

async function main() {
  consoleLogger.info("Start logging market status");

  // Get list of markets for Bitcoin@
  const exchangeInfo = await getExchangeInfo();
  const btcMarkets = Object.keys(exchangeInfo.pairs).filter(key =>
    key.endsWith("_btc"),
  );
  const btcMarketsGroups = chunk(btcMarkets, 2);

  // Track market ID for each market
  let marketIds = [];
  await Promise.all(
    btcMarketsGroups.map(marketGroup => trackMarketId(marketGroup, marketIds)),
  );

  // Write list of market IDs to JSON file
  marketIds.sort((marketA, marketB) => marketA[1] - marketB[1]);
  fs.writeFile(
    path.resolve(__dirname, "../src/yobit/MarketIds.json"),
    JSON.stringify(marketIds, null, 2),
    err => {
      if (err != null) {
        console.log(err);
      }
    },
  );
}

main();
