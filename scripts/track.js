// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const forEach = require("lodash/forEach");
const Deque = require("double-ended-queue");
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
      filename: "logs/track.log",
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

async function main() {
  logger.info("Start tracking...");

  const rate = 1.05;
  let iteration = 0;
  const deque = new Deque();
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

    // Condition checking
    const length = deque.length;
    forEach(summariesMap, (summary, market) => {
      for (let i = 0; i < length; i++) {
        const oldSummary = deque.get(i);
        if (oldSummary != null) {
          if (
            summary.Last > oldSummary.Last ||
            summary.Bid > oldSummary.Bid ||
            summary.Ask > oldSummary.Ask
          ) {
            logger.info(
              `Iteration ${iteration} - Index: ${i}\n` +
                JSON.stringify(summary, null, 2) +
                "\n" +
                JSON.stringify(oldSummary, null, 2)
            );
            break;
          }
        }
      }

      summary.Last = summary.Last * rate;
      summary.Bid = summary.Bid * rate;
      summary.Ask = summary.Ask * rate;
    });

    // Update Deque
    deque.push(summariesMap);
    if (length === 20) {
      deque.shift();
    }

    // Mark Iteration
    if (++iteration % 500 === 0) {
      logger.info(`Iteration ${iteration}`);
    }
    await sleep(1000);
  }
}

// Run program
main();
