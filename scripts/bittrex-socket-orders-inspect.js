const path = require("path");
const fs = require("fs");
const moment = require("moment");
const forEach = require("lodash/forEach");

const { getTimeInUTC } = require("../src/utils");

const LOG_FILE_NAME = "bittrex-track-orders-socket-2017-7-14 23:49:48.log";
const TARGET_SIGNAL_TIME = moment("07-14 16:00 +0000", "MM-DD HH:mm Z")
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
    forEach(marketUpdates["BTC-EFL"], update => {
      // if (update.Fills.length > 20) {
      //   console.log(
      //     "Market",
      //     update.MarketName,
      //     "TIME",
      //     new Date(update.TimeStamp).toLocaleString(),
      //     "BUYS",
      //     update.Buys.length,
      //     "SELLS",
      //     update.Sells.length,
      //     "FILLS",
      //     update.Fills.length,
      //   );
      // }
      if (update.TimeStamp > TARGET_SIGNAL_TIME + 60 * 1000) {
        return;
      }
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
      console.log("-------------------------");
      forEach(update.Fills, fill => console.log(JSON.stringify(fill)));
      console.log("-------------------------");
      forEach(update.Buys, buy => console.log(JSON.stringify(buy)));
      console.log("-------------------------");
      forEach(update.Sells, sell => console.log(JSON.stringify(sell)));
      console.log();
    });
  },
);
