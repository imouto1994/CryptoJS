const path = require("path");
const fs = require("fs");
const moment = require("moment");
const forEach = require("lodash/forEach");

const { getTimeInUTC } = require("../src/utils");

const RATE = 1.3;
const LOG_FILE_NAME = "bittrex-summaries-2017-7-13 23:59:02.log";
const TARGET_SIGNAL_TIME = moment("07-13 16:00 +0000", "MM-DD HH:mm Z")
  .toDate()
  .getTime();

fs.readFile(
  path.resolve(__dirname, `../logs/${LOG_FILE_NAME}`),
  "utf8",
  (err, content) => {
    const lines = content.trim().split(/\r?\n/);
    const filteredLines = lines.filter(line => !line.startsWith("2017"));
    const formattedContent = filteredLines
      .map((line, index) => {
        if (index === 0) {
          return "[[";
        } else if (index === filteredLines.length - 1) {
          return "]]";
        } else if (line === "]") {
          return "],";
        } else {
          return line;
        }
      })
      .join("\n");
    const summariesList = JSON.parse(formattedContent);
    for (let i = 1; i < summariesList.length; i++) {
      const oldSummaries = summariesList[i - 1];
      const summaries = summariesList[i];
      forEach(summaries, summary => {
        const oldSummary = oldSummaries.filter(
          s => s.MarketName === summary.MarketName,
        )[0];
        const oldSummaryTime = getTimeInUTC(oldSummary.TimeStamp);
        const summaryTime = getTimeInUTC(summary.TimeStamp);
        if (
          summaryTime > TARGET_SIGNAL_TIME &&
          oldSummaryTime < TARGET_SIGNAL_TIME
        ) {
          if (summary.Ask > oldSummary.Ask * RATE) {
            console.log("OLD SUMMARY", JSON.stringify(oldSummary, null, 2));
            console.log("SUMMARY", JSON.stringify(summary, null, 2));
            console.log("POTENTIAL MARKET", summary.MarketName);
          }
        }
      });
    }
  },
);
