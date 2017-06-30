// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");

const { getMarketTicker } = require("./src/ApiPublic");
const { getAccountBalance } = require("./src/ApiAccount");
const { CURRENCY_BITCOIN } = require("./src/constants");
const { logInfo, logSuccess } = require("./src/utils");

/**
 * [handleAnswers description]
 * @param {[type]} options.currency [description]
 */
async function main() {
  // Currency input is empty
  const currency = await inquirer.prompt({
    type: "input",
    name: "currency",
    message: "What is the currency?",
  });
  if (currency.length === 0) {
    console.log("Currency is not defined");
    return;
  }

  // Cancel case
  const confirm = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: "Are you sure you want to activate the TEST BOT?",
  });
  if (!confirm) {
    return;
  }

  const market = `${CURRENCY_BITCOIN}-${currency.toUpperCase()}`;

  return Promise.all([
    getAccountBalance(CURRENCY_BITCOIN),
    getMarketTicker(market),
  ]).then(([balance, ticker]) => {
    const { Available: availableAmount } = balance;
    const { Last: lastSoldRate } = ticker;
    logInfo("Available Amount", availableAmount);
    logSuccess("Last Sold Rate", lastSoldRate);
  });
}

// Run program
main();
