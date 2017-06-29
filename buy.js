// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");
const floor = require("lodash/floor");

const { getMarketTicker } = require("./src/ApiPublic");
const { getAccountBalance, getAccountOrder } = require("./src/ApiAccount");
const { makeBuyOrder, cancelOrder, getOpenOrders } = require("./src/ApiMarket");
const {
  CURRENCY_BITCOIN,
  CURRENCY_PRECISION,
  CHUNK_COUNT,
  COMMISION_RATE,
  EXCHANGE_RATE_STEP,
} = require("./src/constants");

function sleep(duration) {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve();
    }, duration);
  });
}

async function buyChunk(market, chunkSourceAmount, initialRate) {
  const actualAmount = floor(
    chunkSourceAmount / (1 + COMMISION_RATE),
    CURRENCY_PRECISION
  );

  for (let i = 0; i < 10; i++) {
    // Calculate rate
    let baseRate;
    if (i > 0) {
      const { Last: latestRate } = await getMarketTicker(market);
      baseRate = latestRate;
    } else {
      baseRate = initialRate;
    }
    const rate = baseRate * (1 + EXCHANGE_RATE_STEP);

    // Make buy order
    const quantity = floor(actualAmount / rate, CURRENCY_PRECISION);
    const orderId = await makeBuyOrder({
      market,
      quantity,
      rate,
    });

    let remainingQuantity = quantity;
    let isOrderClosed = false;
    for (let j = 0; j < 10; j++) {
      await sleep(500);
      const order = await getAccountOrder(orderId);
      if (order.Closed != null || !!order.IsOpen) {
        isOrderClosed = true;
        break;
      } else if (remainingQuantity !== order.QuantityRemaining) {
        remainingQuantity = order.QuantityRemaining;
      } else {
        try {
          await cancelOrder(orderId);
        } catch (error) {
          // Failed to cancel order
          isOrderClosed = true;
          break;
        }
      }
    }
    if (isOrderClosed) {
      break;
    }
  }
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
    Array.apply(null, new Array(CHUNK_COUNT)).map(function() {
      buyChunk(market, chunkSourceAmount, latestRate);
    })
  );
}

main();
