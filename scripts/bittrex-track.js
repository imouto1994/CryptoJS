// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const forEach = require("lodash/forEach");
const winston = require("winston");
const minimist = require("minimist");

const { getMarketSummaries } = require("../src/bittrex/ApiPublic");
const { sleep, getTimeInUTC } = require("../src/utils");

const argv = minimist(process.argv.slice(2));
const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
      colorize: true,
    }),
    new winston.transports.File({
      filename: `logs/bittrex-track-${new Date().toLocaleString()}.log`,
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

async function track(isSingleFind = false, rate = 1.225, targetTime) {
  logger.info(`Start tracking with RATE ${rate}`);

  let iteration = 0;
  const potentialMarkets = {};
  let oldSummariesMap;
  let potentialMarketSummaries;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Create map of summaries
    const summaries = await getMarketSummaries();
    const summariesMap = summaries.reduce((map, summary) => {
      const { MarketName: market } = summary;
      if (market.startsWith("BTC")) {
        map[market] = summary;
      }
      return map;
    }, {});
    if (oldSummariesMap == null) {
      oldSummariesMap = summariesMap;
      continue;
    }
    // Condition checking
    forEach(summariesMap, (summary, market) => {
      if (potentialMarkets[market] == null) {
        const oldSummary = oldSummariesMap[market];
        if (oldSummary != null) {
          if (
            summary.Last > oldSummary.Last * rate ||
            summary.Bid > oldSummary.Bid * rate ||
            summary.Ask > oldSummary.Ask * rate
          ) {
            potentialMarkets[market] = true;
            const timeStamp = summary.TimeStamp;
            const oldTimeStamp = oldSummary.TimeStamp;
            if (
              targetTime != null &&
              getTimeInUTC(timeStamp) > targetTime &&
              getTimeInUTC(oldTimeStamp) < targetTime
            ) {
              logger.info(
                `Iteration ${iteration}\n` +
                  JSON.stringify(summary, null, 2) +
                  "\n" +
                  JSON.stringify(oldSummary, null, 2),
              );
              logger.info(`POTENTIAL MARKET: ${market}`);
              if (isSingleFind) {
                potentialMarketSummaries = { summary, oldSummary };
                return false;
              }
            }
          }
        }
      }
    });

    if (isSingleFind) {
      if (potentialMarketSummaries != null) {
        return potentialMarketSummaries;
      }
    }

    oldSummariesMap = summariesMap;

    // Mark Iteration
    if (++iteration % 500 === 0) {
      logger.info(`Iteration ${iteration}`);
    }
    await sleep(500);
  }
}

// Run program
if (argv.track) {
  track(false, 1.225);
}

module.exports = track;
