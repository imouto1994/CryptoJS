// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");

const { getMarketTicker, getOrderBook } = require("./src/ApiPublic");
const { getAccountBalance, getAccountOrder } = require("./src/ApiAccount");
const { CURRENCY_BITCOIN } = require("./src/constants");
const { logInfo, logSuccess, logError, sleep } = require("./src/utils");

async function getOrderBooks(market) {
  // for (let i = 0; i < 20; i++) {
  //   const orderBook = await getOrderBook({ market, type: "buy", depth: 50 });
  //   const top20Orders = orderBook
  //     .slice()
  //     .sort((a, b) => b.Rate - a.Rate)
  //     .slice(0, 20)
  //     .map(a => a.Rate);
  //   logInfo("Highest Buy", top20Orders, "\n");
  //   await sleep(500);
  // }
}

async function getMarketTickers(market) {
  const order = await getAccountOrder("93a23438-1d30-4a4f-97ea-5f89c038c6c9");
  console.log(order);
}

/**
 * [handleAnswers description]
 * @param {[type]} options.currency [description]
 */
async function main() {
  // Currency input is empty
  const { currency } = await inquirer.prompt({
    type: "input",
    name: "currency",
    message: "What is the currency?",
  });
  if (currency.length === 0) {
    logError("Currency is not defined");
    return;
  }

  // Cancel case
  const { confirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: "Are you sure you want to activate the TEST BOT?",
  });
  if (!confirm) {
    return;
  }

  const market = `${CURRENCY_BITCOIN}-${currency.toUpperCase()}`;

  await Promise.all([getOrderBooks(market), getMarketTickers(market)]);
}

// Run program
main();
