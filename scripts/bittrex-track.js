// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const forEach = require("lodash/forEach");
const Deque = require("double-ended-queue");
const winston = require("winston");

const { getMarketSummaries } = require("../src/bittrex/ApiPublic");
const { sleep } = require("../src/utils");

const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
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

async function main() {
  const rate = 1.15;
  const dequeMaxLength = 5;
  logger.info(
    `Start tracking with rate ${rate} and deque length at ${dequeMaxLength}`
  );

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
        const oldSummary = deque.get(i)[market];
        if (oldSummary != null) {
          if (
            summary.Last > oldSummary.LastWithRate ||
            summary.Bid > oldSummary.BidWithRate ||
            summary.Ask > oldSummary.AskWithRate
          ) {
            logger.info(
              `Iteration ${iteration} - Index: ${i}\n` +
                JSON.stringify(summary, null, 2) +
                "\n" +
                JSON.stringify(oldSummary, null, 2)
            );
            logger.info(`POTENTIAL MARKET: ${market}`);
            break;
          }
        }
      }

      summary.LastWithRate = summary.Last * rate;
      summary.BidWithRate = summary.Bid * rate;
      summary.AskWithRate = summary.Ask * rate;
    });

    // Update Deque
    deque.push(summariesMap);
    if (length === dequeMaxLength) {
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
