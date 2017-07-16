// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const winston = require("winston");
const moment = require("moment");
const minimist = require("minimist");

const { getMarketSummaries } = require("../src/bittrex/ApiPublic");
const WebSocket = require("../src/bittrex/WebSocket");
const { getTimeInUTC } = require("../src/utils");

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
      filename: `logs/bittrex-track-socket-${new Date().toLocaleString()}.log`,
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

function socketTrack(rate = 1.4, targetTime = DEFAULT_UPCOMING_SIGNAL_TIME) {
  return new Promise(async (resolve, reject) => {
    consoleLogger.info(`Start tracking through socket with RATE ${rate}`);
    const summaries = await getMarketSummaries();
    const marketsMap = summaries.reduce((map, summary) => {
      map[summary.MarketName] = summary;
      return map;
    }, {});
    const potentialMarkets = {};
    let hasFoundSignal = false;

    function frameHandler(frame) {
      if (hasFoundSignal) {
        return;
      }

      if (frame.M === "updateSummaryState") {
        for (const data of frame.A) {
          for (const marketDelta of data.Deltas) {
            const { MarketName: marketName } = marketDelta;
            const summary = marketDelta;
            const oldSummary = marketsMap[marketName];
            fileLogger.info(JSON.stringify(summary));
            if (
              summary.Last > oldSummary.Last * rate ||
              summary.Bid > oldSummary.Bid * rate ||
              summary.Ask > oldSummary.Ask * rate
            ) {
              if (potentialMarkets[marketName] == null) {
                potentialMarkets[marketName] = true;
                const timeStamp = getTimeInUTC(summary.TimeStamp);
                const oldTimeStamp = getTimeInUTC(oldSummary.TimeStamp);

                if (timeStamp > targetTime && oldTimeStamp < targetTime) {
                  const potentialMessage = `POTENTIAL MARKET: ${marketName}`;
                  consoleLogger.info(potentialMessage);
                  fileLogger.info(potentialMessage);
                  resolve({ summary, oldSummary });
                  hasFoundSignal = true;
                }
              }
            }
            marketsMap[marketName] = summary;
          }
        }
      }
    }

    WebSocket.listen(frameHandler);
  });
}

// Run program
if (argv.track) {
  socketTrack(1.4);
}

module.exports = socketTrack;
