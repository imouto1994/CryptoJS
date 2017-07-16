// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const winston = require("winston");
const moment = require("moment");
const minimist = require("minimist");
const Deque = require("double-ended-queue");

const { getMarketSummaries } = require("../src/bittrex/ApiPublic");
const { getCurrentTime } = require("../src/utils");
const WebSocket = require("../src/bittrex/WebSocket");

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
      filename: `logs/bittrex-track-orders-socket-${new Date().toLocaleString()}.log`,
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

const DEFAULT_UPCOMING_SIGNAL_TIME = moment("16:00 +0000", "HH:mm Z")
  .toDate()
  .getTime();
const DEQUE_LENGTH = 15;

let MARKETS_MAP = {};
function socketTrack(
  dequePotentialLength = 5,
  targetTime = DEFAULT_UPCOMING_SIGNAL_TIME,
) {
  return new Promise(async (resolve, reject) => {
    consoleLogger.info(
      `Start tracking orders through socket with DEQUE POTENTIAL LENGTH ${dequePotentialLength}`,
    );
    const summaries = await getMarketSummaries();
    const markets = summaries
      .map(summary => summary.MarketName)
      .filter(market => market.startsWith("BTC-"));
    MARKETS_MAP = markets.reduce((map, market) => {
      map[market] = new Deque();
      return map;
    }, {});
    let potentialMarkets = {};

    function frameHandler(frame) {
      if (frame.M === "updateExchangeState") {
        const marketDelta = frame.A[0];
        fileLogger.info(JSON.stringify(frame.A[0]));
        const deque = MARKETS_MAP[marketDelta.MarketName];
        deque.push(Object.assign(marketDelta, { TimeStamp: getCurrentTime() }));
        if (deque.length > DEQUE_LENGTH) {
          deque.shift();
        }
        if (deque.length >= dequePotentialLength) {
          let isPotentialMarketByBuys = true;
          let isPotentialMarketByFills = true;
          let isPotentialMarketByBuysAfterSignal = true;
          let isPotentialMarketByFillsAfterSignal = true;
          let hasProcessedElementBeforeSignal1 = false;
          let hasProcessedElementBeforeSignal2 = false;
          for (let i = deque.length - 1; i >= 0; i--) {
            if (
              i >= deque.length - 1 - dequePotentialLength &&
              deque.get(i).Buys.length < 25
            ) {
              isPotentialMarketByBuys = false;
            } else {
              if (i >= deque.length - 1 - dequePotentialLength) {
                if (deque.get(i).TimeStamp < targetTime) {
                  isPotentialMarketByBuysAfterSignal = false;
                }
              } else {
                if (
                  !hasProcessedElementBeforeSignal1 &&
                  deque.get(i).TimeStamp < targetTime
                ) {
                  if (deque.get(i).Buys.length >= 25) {
                    isPotentialMarketByBuysAfterSignal = false;
                  } else {
                    hasProcessedElementBeforeSignal1 = true;
                  }
                }
              }
            }

            if (
              i >= deque.length - 1 - dequePotentialLength &&
              deque.get(i).Fills.length < 20
            ) {
              isPotentialMarketByFills = false;
            } else {
              if (i >= deque.length - 1 - dequePotentialLength) {
                if (deque.get(i).TimeStamp < targetTime) {
                  isPotentialMarketByFillsAfterSignal = false;
                }
              } else {
                if (
                  !hasProcessedElementBeforeSignal2 &&
                  deque.get(i).TimeStamp < targetTime
                ) {
                  if (deque.get(i).Buys.length >= 20) {
                    isPotentialMarketByFillsAfterSignal = false;
                  } else {
                    hasProcessedElementBeforeSignal2 = true;
                  }
                }
              }
            }
          }

          if (isPotentialMarketByBuys || isPotentialMarketByFills) {
            if (potentialMarkets[marketDelta.MarketName] == null) {
              potentialMarkets[marketDelta.MarketName] = true;
              if (
                (isPotentialMarketByBuys &&
                  isPotentialMarketByBuysAfterSignal) ||
                (isPotentialMarketByFills &&
                  isPotentialMarketByFillsAfterSignal)
              ) {
                const potentialMessage = `POTENTIAL MARKET: ${marketDelta.MarketName}`;
                fileLogger.info(potentialMessage);
                consoleLogger.info(potentialMessage);
              }
            }
          }
        }
      }
    }

    WebSocket.subscribe(markets, frameHandler);
  });
}

// Run program
if (argv.track) {
  socketTrack(3);
}

module.exports = socketTrack;
