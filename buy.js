// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");

const { getMarketTicker } = require("./src/ApiPublic");
const { getAccountBalance } = require("./src/ApiAccount");
const { CURRENCY_BITCOIN } = require("./src/constants");

const QUESTIONS = [
  {
    type: "input",
    name: "currency",
    message: "What is the currency?",
  },
  {
    type: "confirm",
    name: "confirm",
    message: "Are you sure you want to activate the BUY BOT?",
  },
];

/**
 * [handleAnswers description]
 * @param {[type]} options.currency [description]
 */
function handleAnswers({ currency, confirm }) {
  // Cancel case
  if (!confirm) {
    return;
  }
  // Currency input is empty
  if (currency.length === 0) {
    console.log("Currency is not defined");
    return;
  }

  const market = `${CURRENCY_BITCOIN}-${currency.toUpperCase()}`;
  return Promise.all([
    getAccountBalance(CURRENCY_BITCOIN),
    getMarketTicker(market),
  ]).then(([balance, ticker]) => {
    const { Available: availableAmount } = balance;
    const { Last: lastSoldRate } = ticker;
    console.log("Available Amount", availableAmount);
    console.log("Last Sold Rate", lastSoldRate);
  });
}

// Run program
inquirer.prompt(QUESTIONS).then(handleAnswers);
