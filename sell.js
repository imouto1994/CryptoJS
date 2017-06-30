// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");
const floor = require("lodash/floor");

const { getMarketTicker } = require("./src/ApiPublic");
const { getAccountBalance, getAccountOrder } = require("./src/ApiAccount");
const { makeBuyOrder, cancelOrder } = require("./src/ApiMarket");
const {
  CURRENCY_BITCOIN,
  CURRENCY_PRECISION,
  BUY_CHUNK_COUNT,
  COMMISION_RATE,
  EXCHANGE_RATE_STEP,
} = require("./src/constants");
const {
  sleep,
  isEqual,
  logInfo,
  logWarning,
  logError,
  logSuccess,
} = require("./src/utils");

/**
 * [buyChunk description]
 * @param {[type]} market [description]
 * @param {[type]} chunkSourceAmount [description]
 * @param {[type]} initialRate [description]
 * @return {[type]} [description]
 */
async function sellChunk({
  market,
  chunkSourceAmount,
  initialRate,
  sourceCurrency,
  targetCurrency,
}) {
  const actualAmount = floor(
    chunkSourceAmount / (1 + COMMISION_RATE),
    CURRENCY_PRECISION
  );
  logInfo(
    `Excluding commission fee, we will actually use ${actualAmount} ${sourceCurrency} to purchase ${targetCurrency} chunk`
  );

  for (let i = 0; i < 10; i++) {
    // Calculate rate
    let baseRate;
    if (i > 0) {
      const { Ask: latestRate } = await getMarketTicker(market);
      baseRate = latestRate;
    } else {
      baseRate = initialRate;
    }

    // Make buy order
    const rate = baseRate * (1 + EXCHANGE_RATE_STEP);
    const quantity = floor(actualAmount / rate, CURRENCY_PRECISION);
    logInfo(`Attempted to buy ${quantity} ${targetCurrency} at rate ${rate}`);
    const orderId = await makeBuyOrder({
      market,
      quantity,
      rate,
    });

    let remainingQuantity = quantity;
    let isOrderClosed = false;
    let pendingOrderCounter = 0;
    for (let j = 0; j < 15; j++) {
      await sleep(200);
      logInfo(`Fetch information for order ${orderId}`);
      const order = await getAccountOrder(orderId);
      const {
        Closed: orderClosedTime,
        IsOpen: isOrderOpened,
        QuantityRemaining: orderRemaining,
      } = order;
      // Order is closed
      if (orderClosedTime != null || !!isOrderOpened) {
        logSuccess(
          `Order completed successfully for buying ${quantity} ${targetCurrency} at rate ${rate}`
        );
        isOrderClosed = true;
        break;
      } else if (!isEqual(remainingQuantity, orderRemaining)) {
        // Order is still being filled
        remainingQuantity = order.QuantityRemaining;
        pendingOrderCounter = 0;
        logInfo(
          `Order is partially filled with ${remainingQuantity} / ${quantity} ${targetCurrency} remaining at rate ${rate}`
        );
      } else {
        // Order remaining is unchanged after 3 consecutive checks
        if (pendingOrderCounter === 3) {
          // Cancel order
          try {
            logWarning(
              `Attempted to cancel the current order since order is not filled well`
            );
            await cancelOrder(orderId);
          } catch (error) {
            // Failed to cancel order, might be because order is closed
            logSuccess(
              `Order completed successfully for buying ${quantity} ${targetCurrency} at rate ${rate}`
            );
            isOrderClosed = true;
            break;
          }
        }
        pendingOrderCounter++;
      }
    }
    if (isOrderClosed) {
      break;
    }
  }
}

/**
 * Run sell bot to sell all current amount of target currency
 * @return {[type]} [description]
 */
async function runSellBot() {
  // Define source currency
  const sourceCurrency = CURRENCY_BITCOIN;

  // Get current balance and prompt user the amount he wants to use
  const balance = await getAccountBalance(sourceCurrency);
  const { amount } = await inquirer.prompt({
    type: "input",
    name: "amount",
    message:
      `Your current ${sourceCurrency} balance is ${balance.Available} ${sourceCurrency}. ` +
      `How much ${sourceCurrency} do you want to use?`,
  });
  const sourceAmount = parseFloat(amount.trim());
  if (isNaN(sourceAmount)) {
    logError("Source amount is not defined");
    return;
  }

  // Confirm the amount user indicated
  const { confirm: amountConfirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `Are you sure you want to spend ${sourceAmount} ${sourceCurrency}?`,
  });
  if (!amountConfirm) {
    logWarning("Be patient and decide carefully again!");
    return;
  }

  // Prompt from user the target currency he wants to exchange
  const { currency } = await inquirer.prompt({
    type: "input",
    name: "currency",
    message: "What is the currency?",
  });
  if (currency.trim().length === 0) {
    logError("Target currency is not defined");
    return;
  }
  // Define target currency & corresponding market
  const targetCurrency = currency.trim().toUpperCase();
  const market = `${sourceCurrency}-${targetCurrency}`;

  // Confirm the currency user indicated
  const { confirm: currencyConfirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `Are you sure you want to activate the BUY BOT for currency ${targetCurrency}?`,
  });
  if (!currencyConfirm) {
    logWarning("Be patient and decide carefully again!");
    return;
  }

  // Buy by chunks
  const chunkSourceAmount = floor(
    sourceAmount / BUY_CHUNK_COUNT,
    CURRENCY_PRECISION
  );
  logInfo(`We will use ${chunkSourceAmount} ${sourceCurrency} for each chunk`);
  const { Ask: latestRate } = await getMarketTicker(market);
  await Promise.all(
    // eslint-disable-next-line prefer-spread
    Array.apply(null, new Array(BUY_CHUNK_COUNT)).map(function() {
      sellChunk({
        market,
        chunkSourceAmount,
        initialRate: latestRate,
        sourceCurrency,
        targetCurrency,
      });
    })
  );
  logSuccess("All chunk buy orders are processed successfully!");
}

// Activate SELL BOT
runSelLBot();
