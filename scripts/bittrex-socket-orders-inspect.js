const path = require("path");
const fs = require("fs");
const moment = require("moment");
const forEach = require("lodash/forEach");
const mean = require("lodash/mean");
const uniq = require("lodash/uniq");
const map = require("lodash/map");

const LOG_FILE_NAME = "bittrex-track-orders-socket-2017-7-18 23:46:14.log";
const TARGET_SIGNAL_TIME = moment("07-18 16:00 +0000", "MM-DD HH:mm Z")
  .toDate()
  .getTime();

fs.readFile(
  path.resolve(__dirname, `../logs/${LOG_FILE_NAME}`),
  "utf8",
  (err, content) => {
    const lines = content.trim().split(/\r?\n/);
    const updates = lines
      .map(line => line.match(/(.*) - info: (\{.*\})/))
      .filter(match => match != null)
      .map(match => {
        const timeStamp = moment(match[1], "YYYY-M-D H:m:s").valueOf();
        const update = JSON.parse(match[2]);
        return Object.assign(update, { TimeStamp: timeStamp });
      });
    const marketUpdates = updates.reduce((map, update) => {
      const { MarketName: marketName } = update;
      if (map[marketName] == null) {
        map[marketName] = [];
      }
      map[marketName].push(update);
      return map;
    }, {});
    forEach(marketUpdates["BTC-BRK"], update => {
      if (
        update.TimeStamp > TARGET_SIGNAL_TIME + 180 * 1000 ||
        update.TimeStamp < TARGET_SIGNAL_TIME - 60 * 1000
      ) {
        return;
      }
      console.log("-------------------------");
      console.log(
        "Market",
        update.MarketName,
        "TIME",
        new Date(update.TimeStamp).toLocaleString(),
        "BUYS",
        update.Buys.length,
        "SELLS",
        update.Sells.length,
        "FILLS",
        update.Fills.length,
      );
      forEach(update.Fills, fill => console.log(JSON.stringify(fill)));
      if (update.Fills.length > 0) {
        const averageFillRate = mean(
          uniq(map(update.Fills, fill => fill.Rate)),
        );
        console.log("AVERAGE FILL RATE", averageFillRate);
      }
      console.log("-------------------------");
    });
  },
);
