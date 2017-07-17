// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const winston = require("winston");
const chunk = require("lodash/chunk");

const { getExchangeInfo } = require("../src/yobit/ApiPublic");
const { post } = require("../src/request");
const MarketIds = require("../src/yobit/MarketIds.json");
const MarketIdsMap = MarketIds.reduce((map, market) => {
  map[market[0]] = market[1];
  return map;
}, {});

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

let fileLogger = createFileLogger();
function createFileLogger() {
  return new winston.Logger({
    transports: [
      new winston.transports.File({
        filename: `logs/yobit-track-status-${new Date().toLocaleString()}.log`,
        json: false,
        timestamp() {
          return new Date().toLocaleString();
        },
      }),
    ],
    exitOnError: false,
  });
}

setInterval(() => {
  fileLogger = createFileLogger();
}, 60000);

async function trackMarketGroupStatus(marketGroup) {
  while (true) {
    for (let i = 0; i < marketGroup.length; i++) {
      const {
        body,
      } = await post("https://yobit.net/ajax/system_status_data.php", {
        form: true,
        body: { pair_id: MarketIdsMap[marketGroup[i]], tz: "Asia/Shanghai" },
      });
      fileLogger.info(
        `${marketGroup[i]} - ${body
          .replace(/\s/g, "")
          .replace(/\r?\n|\r/g, "")}`,
      );
    }
  }
}

async function main() {
  consoleLogger.info("Start logging market status for Yobit");

  const exchangeInfo = await getExchangeInfo();
  const btcMarkets = Object.keys(exchangeInfo.pairs).filter(key =>
    key.endsWith("_btc"),
  );
  const btcMarketsGroups = chunk(btcMarkets, 1);
  await Promise.all(btcMarketsGroups.map(trackMarketGroupStatus));
}

// Run program
main();
