// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");

const { getMarketTicker, getOrderBook } = require("./src/ApiPublic");
const { getAccountBalance, getAccountOrder } = require("./src/ApiAccount");
const { makeSellOrder } = require("./src/ApiMarket");
const { CURRENCY_BITCOIN } = require("./src/constants");
const { logInfo, logSuccess, logError, sleep } = require("./src/utils");

async function trySell(market) {
  try {
    console.time("SELL");
    await makeSellOrder({
      market: "BTC-XRP",
      quantity: 100000,
      rate: 0.1,
    });
  } catch (err) {
    console.log(err);
    console.timeEnd("SELL");
  }
}

async function getMarketTickers(market) {
  console.time("ORDER");
  const order = await getAccountOrder("93a23438-1d30-4a4f-97ea-5f89c038c6c9");
  console.timeEnd("ORDER");
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

  await Promise.all([getMarketTickers(market)]);
}

// Run program
main();
