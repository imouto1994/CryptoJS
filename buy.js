// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");
const floor = require("lodash/floor");

const { getMarketTicker } = require("./src/ApiPublic");
const { getAccountBalance, getAccountOrder } = require("./src/ApiAccount");
const { makeBuyOrder, makeSellOrder, cancelOrder } = require("./src/ApiMarket");
const {
  CURRENCY_BITCOIN,
  CURRENCY_PRECISION,
  CHUNK_COUNT,
  COMMISION_RATE,
  EXCHANGE_RATE_STEP,
  BUY_RATE,
  SELL_RATE,
} = require("./src/constants");
const {
  isEqual,
  logInfo,
  logWarning,
  logError,
  logSuccess,
} = require("./src/utils");

/**
 * [sellChunk description]
 * @param  {[type]} options.market            [description]
 * @param  {[type]} options.chunkTargetAmount [description]
 * @param  {[type]} options.baseRate          [description]
 * @param  {[type]} options.sourceCurrency    [description]
 * @param  {[type]} options.targetCurrency    [description]
 * @param  {[type]} options.                  [description]
 * @return {[type]}                           [description]
 */
async function sellChunk({
  market,
  chunkTargetAmount,
  baseRate,
  sourceCurrency,
  targetCurrency,
}) {
  for (let i = 0; i < 5; i++) {
    // Calculate rate
    let rate;
    if (i > 0) {
      const { Bid: latestRate } = await getMarketTicker(market);
      rate = floor(latestRate * (1 - EXCHANGE_RATE_STEP), CURRENCY_PRECISION);
    } else {
      rate = floor(baseRate * SELL_RATE, CURRENCY_PRECISION);
    }
    const quantity = chunkTargetAmount;

    // Make sell order
    let orderId;
    if (i === 0) {
      for (let j = 0; j < 45; j++) {
        try {
          orderId = await makeSellOrder({
            market,
            quantity,
            rate,
          });
          logInfo(
            `Attempted to sell ${chunkTargetAmount} ${targetCurrency} at rate ${rate}`
          );
          break;
        } catch (err) {
          logWarning(
            `Failed to attempt to sell ${chunkTargetAmount} ${targetCurrency} at rate ${rate} due to no sufficient funds`
          );
        }
      }
    } else {
      try {
        orderId = await makeSellOrder({
          market,
          quantity,
          rate,
        });
        logInfo(
          `Attempted to sell ${chunkTargetAmount} ${targetCurrency} at rate ${rate}`
        );
      } catch (err) {
        logWarning(
          `Failed to attempt to sell ${chunkTargetAmount} ${targetCurrency} at rate ${rate} due to no sufficient funds`
        );
      }
    }

    if (orderId == null) {
      continue;
    }
    let remainingQuantity = 0;
    let isOrderClosed = false;
    const limit = i === 0 ? 35 : 25;
    for (let j = 0; j < limit; j++) {
      logInfo(`Fetch information for order ${orderId}`);
      const order = await getAccountOrder(orderId);
      const {
        Closed: orderClosedTime,
        IsOpen: isOrderOpened,
        QuantityRemaining: orderRemaining,
      } = order;
      // Order is closed
      if (orderClosedTime != null || !isOrderOpened) {
        logSuccess(
          `Order completed successfully for selling ${quantity} ${targetCurrency} at rate ${rate}`
        );
        isOrderClosed = true;
        break;
      } else if (!isEqual(remainingQuantity, orderRemaining)) {
        // Order is still being filled
        remainingQuantity = orderRemaining;
        logInfo(
          `Order is now partially filled with ${remainingQuantity} / ${quantity} ${targetCurrency} remaining at rate ${rate}`
        );
      } else {
        logWarning(
          `Order is still stucked at ${remainingQuantity} / ${quantity} ${targetCurrency} remaining at rate ${rate}`
        );
      }
    }
    if (!isOrderClosed) {
      // Cancel order
      try {
        logWarning(
          `Attempted to cancel the current order since it took too long`
        );
        await cancelOrder(orderId);
      } catch (error) {
        // Failed to cancel order, might be because order is closed
        logSuccess(
          `Order completed successfully for selling ${quantity} ${targetCurrency} at rate ${rate}`
        );
        isOrderClosed = true;
        break;
      }
    }

    if (isOrderClosed) {
      break;
    }
  }
}

/**
 * [trackCloseOrder description]
 * @param  {[type]} options.orderId        [description]
 * @param  {[type]} options.quantity       [description]
 * @param  {[type]} options.rate           [description]
 * @param  {[type]} options.targetCurrency [description]
 * @return {[type]}                        [description]
 */
async function trackCloseOrder({ orderId, quantity, rate, targetCurrency }) {
  let remainingQuantity = quantity;
  let isOrderClosed = false;
  for (let j = 0; j < 35; j++) {
    logInfo(`Fetch information for order ${orderId} ${j}`);
    const order = await getAccountOrder(orderId);
    const {
      Closed: orderClosedTime,
      IsOpen: isOrderOpened,
      QuantityRemaining: orderRemaining,
    } = order;
    // Order is closed
    if (orderClosedTime != null || !isOrderOpened) {
      logSuccess(
        `Order completed successfully for buying ${quantity} ${targetCurrency} at rate ${rate}`
      );
      isOrderClosed = true;
      break;
    } else if (!isEqual(remainingQuantity, orderRemaining)) {
      // Order is still being filled
      remainingQuantity = orderRemaining;
      logInfo(
        `Order is now partially filled with ${remainingQuantity} / ${quantity} ${targetCurrency} remaining at rate ${rate}`
      );
    } else {
      logWarning(
        `Order is still stucked at ${remainingQuantity} / ${quantity} ${targetCurrency} remaining at rate ${rate}`
      );
    }
  }
  if (!isOrderClosed) {
    // Cancel order
    try {
      logWarning(
        `Attempted to cancel the current order since it took too long`
      );
      await cancelOrder(orderId);
    } catch (error) {
      // Failed to cancel order, might be because order is closed
      logSuccess(
        `Order completed successfully for buying ${quantity} ${targetCurrency} at rate ${rate} since cancel request failed`
      );
      isOrderClosed = true;
    }
  }
}

/**
 * [buyChunk description]
 * @param  {[type]} options.market            [description]
 * @param  {[type]} options.chunkSourceAmount [description]
 * @param  {[type]} options.initialRate       [description]
 * @param  {[type]} options.sourceCurrency    [description]
 * @param  {[type]} options.targetCurrency    [description]
 * @param  {[type]} options.                  [description]
 * @return {[type]}                           [description]
 */
async function buyChunk({
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

  // Calculate rate
  const baseRate = initialRate;
  const rate = floor(baseRate * BUY_RATE, CURRENCY_PRECISION);
  const quantity = floor(actualAmount / rate, CURRENCY_PRECISION);

  // Make buy order
  const orderId = await makeBuyOrder({
    market,
    quantity,
    rate,
  });
  logWarning(`Attempted to buy ${quantity} ${targetCurrency} at rate ${rate}`);

  await Promise.all([
    sellChunk({
      market,
      chunkTargetAmount: quantity,
      baseRate,
      sourceCurrency,
      targetCurrency,
    }),
    trackCloseOrder({
      orderId,
      quantity,
      rate,
      targetCurrency,
    }),
  ]);
}

/**
 * Run buy bot to buy as much amount of target currency as possible with the given amount of source currency
 * @return {[type]} [description]
 */
async function runBot() {
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
    message: "What is the target currency?",
  });
  if (currency.trim().length === 0) {
    logError("Target currency is not defined");
    return;
  }
  // Define target currency & corresponding market
  const targetCurrency = currency.trim().toUpperCase();
  const market = `${sourceCurrency}-${targetCurrency}`;

  // Buy by chunks
  const chunkSourceAmount = floor(
    sourceAmount / CHUNK_COUNT,
    CURRENCY_PRECISION
  );
  logInfo(
    `We will use ${chunkSourceAmount} ${sourceCurrency} for ${CHUNK_COUNT} chunk(s)`
  );
  const { Ask: latestRate } = await getMarketTicker(market);
  await Promise.all(
    // eslint-disable-next-line prefer-spread
    Array.apply(null, new Array(CHUNK_COUNT)).map(function() {
      buyChunk({
        market,
        chunkSourceAmount,
        initialRate: latestRate,
        sourceCurrency,
        targetCurrency,
      });
    })
  );
}

// Activate BUY BOT
runBot();
