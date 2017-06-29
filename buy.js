// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");
const floor = require("lodash/floor");

const { getMarketTicker } = require("./src/ApiPublic");
const { getAccountBalance } = require("./src/ApiAccount");
const { makeBuyOrder } = require("./src/ApiMarket");
const {
  CURRENCY_BITCOIN,
  CURRENCY_PRECISION,
  CHUNK_COUNT,
  COMMISION_RATE,
  EXCHANGE_RATE_STEP,
} = require("./src/constants");

async function buyChunk(market, chunkSourceAmount, initialRate) {
  let stepCount = 1;
  const actualAmount = floor(
    chunkSourceAmount / (1 + COMMISION_RATE),
    CURRENCY_PRECISION
  );
  const chunkTargetAmount = floor(
    actualAmount / initialRate * 1.05,
    CURRENCY_PRECISION
  );
  const rate = initialRate + EXCHANGE_RATE_STEP * stepCount;
  makeBuyOrder({
    market,
    quantity: floor(chunkTargetAmount / rate, CURRENCY_PRECISION),
    rate,
  });
}

/**
 * [main description]
 * @return {[type]} [description]
 */
async function main() {
  // Define source currency
  const sourceCurrency = CURRENCY_BITCOIN;

  // Get current balance and prompt user the amount he wants to use
  const balance = await getAccountBalance(CURRENCY_BITCOIN);
  const { amount } = await inquirer.prompt([
    {
      type: "input",
      name: "amount",
      message: `Your current BTC balance is ${balance.Available} BTC. How much BTC do you want to use?`,
    },
  ]);
  const sourceAmount = parseInt(amount.trim(), 10);
  if (isNaN(sourceAmount)) {
    console.log("Amount is not defined");
    return;
  }

  // Confirm the amount user indicated
  const { confirm: amountConfirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to spend ${sourceAmount} BTC?`,
    },
  ]);
  if (!amountConfirm) {
    console.log("Be patient and decide carefully again!");
    return;
  }

  // Prompt from user the target currency he wants to exchange
  const { currency } = await inquirer.prompt([
    {
      type: "input",
      name: "currency",
      message: "What is the currency?",
    },
  ]);
  if (currency.trim().length === 0) {
    console.log("Currency is not defined");
    return;
  }
  // Define target currency & corresponding market
  const targetCurrency = currency.trim().toUpperCase();
  const market = `${sourceCurrency}-${targetCurrency}`;

  // Confirm the currency user indicated
  const { confirm: currencyConfirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to activate the BUY BOT for currency ${targetCurrency}?`,
    },
  ]);
  if (!currencyConfirm) {
    console.log("Be patient and decide carefully again!");
    return;
  }

  // Buy by chunks
  const chunkSourceAmount = floor(
    sourceAmount / CHUNK_COUNT,
    CURRENCY_PRECISION
  );
  const { Last: latestRate } = await getMarketTicker(market);
  await Promise.all(
    // eslint-disable-next-line prefer-spread
    Array.apply(null, new Array(CHUNK_COUNT)).map(() =>
      buyChunk(market, chunkSourceAmount, latestRate)
    )
  );
}

main();
