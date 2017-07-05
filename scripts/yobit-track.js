// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const Deque = require("double-ended-queue");
const winston = require("winston");
const forEach = require("lodash/forEach");
const chunk = require("lodash/chunk");

const { getExchangeInfo, getMarketTickers } = require("../src/yobit/ApiPublic");
const { sleep } = require("../src/utils");

const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
    new winston.transports.File({
      filename: `logs/yobit-track-${new Date().toLocaleString()}.log`,
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

async function trackMarketTickers(marketGroup, index) {
  const rate = 1.5;
  const dequeMaxLength = 5;
  logger.info(
    `Start tracking with rate ${rate} and deque length at ${dequeMaxLength} for group ${index}`
  );

  let iteration = 0;
  const deque = new Deque();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tickersMap = await getMarketTickers(marketGroup);

    // Condition Checking
    const length = deque.length;
    forEach(tickersMap, (ticker, market) => {
      for (let i = 0; i < length; i++) {
        const oldTicker = deque.get(i)[market];
        if (oldTicker != null) {
          if (
            ticker.last > oldTicker.lastWithRate ||
            ticker.buy > oldTicker.buyWithRate ||
            ticker.sell > oldTicker.sellWithRate
          ) {
            logger.info(
              `Iteration ${iteration} - Group Index: ${index} - Index: ${i}\n` +
                JSON.stringify(ticker, null, 2) +
                "\n" +
                JSON.stringify(oldTicker, null, 2)
            );
            logger.info(`POTENTIAL MARKET: ${market}`);
            break;
          }
        }
      }

      ticker.lastWithRate = ticker.last * rate;
      ticker.buyWithRate = ticker.buy * rate;
      ticker.sellWithRate = ticker.sell * rate;
    });

    // Update Deque
    deque.push(tickersMap);
    if (length === dequeMaxLength) {
      deque.shift();
    }

    // Mark Iteration
    if (++iteration % 500 === 0) {
      logger.info(`Group Index ${index} - Iteration ${iteration}`);
    }

    await sleep(1000);
  }
}

async function main() {
  const exchangeInfo = await getExchangeInfo();
  const btcMarkets = Object.keys(exchangeInfo.pairs).filter(key =>
    key.endsWith("_btc")
  );
  const btcMarketsGroups = chunk(btcMarkets, 50);

  await Promise.all([
    btcMarketsGroups.map((marketGroup, index) =>
      trackMarketTickers(marketGroup, index)
    ),
  ]);
}

// Run program
main();
