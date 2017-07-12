// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const inquirer = require("inquirer");
const winston = require("winston");
const floor = require("lodash/floor");
const moment = require("moment");

const { getMarketTicker } = require("../src/bittrex/ApiPublic");
const {
  getAccountBalance,
  getAccountOrder,
} = require("../src/bittrex/ApiAccount");
const {
  makeBuyOrder,
  makeSellOrder,
  cancelOrder,
} = require("../src/bittrex/ApiMarket");
const {
  CURRENCY_BITCOIN,
  CURRENCY_PRECISION,
  CHUNK_COUNT,
  BITTREX_COMMISSION_RATE,
  EXCHANGE_RATE_STEP,
  BUY_RATE,
  SELL_RATE,
} = require("../src/constants");
const { sleep, isEqual, getCurrentTime } = require("../src/utils");
const bittrexTrack = require("./bittrex-track");

// Setup logger
const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
      colorize: true,
    }),
    new winston.transports.File({
      filename: `logs/bittrex-${new Date().toLocaleString()}.log`,
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

// Time Markers
const SIGNAL_TIME = moment("16:00 +0000", "HH:mm Z").toDate().getTime();
const SIGNAL_BUY_DEADLINE_TIME = SIGNAL_TIME + 15 * 1000;
const SIGNAL_SELL_DEADLINE_TIME = SIGNAL_TIME + 28 * 1000;

/**
 *
 *
 * @param {any} params
 */
const SELL_TRACK_CLOSE_ITERATION = 25;
const SELL_TRACK_CLOSE_DURATION = 50;
async function sellChunk(params) {
  const {
    market,
    chunkTargetAmount,
    baseRate,
    buyRate,
    targetCurrency,
  } = params;

  let quantity = chunkTargetAmount;
  let shouldSellAsap = false;
  for (let i = 0; i < 5; i++) {
    // Calculate rate
    let rate;
    if (!shouldSellAsap && i === 0) {
      rate = floor(baseRate * SELL_RATE, CURRENCY_PRECISION);
    } else if (!shouldSellAsap && i === 1) {
      rate = floor(buyRate * (1 - EXCHANGE_RATE_STEP), CURRENCY_PRECISION);
    } else {
      const { Bid: latestRate } = await getMarketTicker(market);
      rate = floor(latestRate * (1 - EXCHANGE_RATE_STEP), CURRENCY_PRECISION);
    }

    // Make sell order
    let orderId;
    try {
      orderId = await makeSellOrder({
        market,
        quantity,
        rate,
      });
      logger.info(
        `[SELL] Attempted for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
      );
    } catch (err) {
      logger.error(
        `[SELL] Failed to attempt for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
      );
    }

    if (orderId == null) {
      continue;
    }

    let remainingQuantity = 0;
    let isOrderClosed = false;
    for (let j = 0; j < SELL_TRACK_CLOSE_ITERATION; j++) {
      if (i < 2 && getCurrentTime() > SIGNAL_SELL_DEADLINE_TIME) {
        logger.info(
          `[SELL] Current time surpassed sell deadline. We will attempt to sell everything left asap`,
        );
        shouldSellAsap = true;
        break;
      }
      logger.info(
        `[SELL] Fetch information for order ${orderId} for ${j + 1} times`,
      );
      const order = await getAccountOrder(orderId);
      const {
        Closed: orderClosedTime,
        IsOpen: isOrderOpened,
        QuantityRemaining: orderRemaining,
      } = order;
      // Order is closed
      if (orderClosedTime != null || !isOrderOpened) {
        logger.info(
          `[SELL] Completed successfully for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
        );
        isOrderClosed = true;
        break;
      } else if (!isEqual(remainingQuantity, orderRemaining)) {
        // Order is still being filled
        remainingQuantity = orderRemaining;
        logger.warn(
          `[SELL] Partially filled with AMOUNT of ${remainingQuantity} ${targetCurrency} left at RATE ${rate}`,
        );
      } else {
        logger.warn(
          `[SELL] Stucked at AMOUNT of ${remainingQuantity} ${targetCurrency} left at rate ${rate}`,
        );
      }
      await sleep(SELL_TRACK_CLOSE_DURATION);
    }

    if (!isOrderClosed) {
      // Cancel order
      try {
        logger.warn(`[SELL] Cancel since it took too long`);
        await cancelOrder(orderId);
        isOrderClosed = true;
      } catch (error) {
        // Failed to cancel order, might be because order is closed
        logger.info(
          `[SELL] Completed successfully for AMOUNT of  ${quantity} ${targetCurrency} at RATE ${rate} since cancel request failed`,
        );
        isOrderClosed = true;
        break;
      }
    }

    if (isOrderClosed) {
      const order = await getAccountOrder(orderId);
      if (order.QuantityRemaining === 0) {
        break;
      } else {
        quantity = order.QuantityRemaining;
      }
    }
  }
}

/**
 *
 *
 * @param {any} params
 */
const BUY_TRACK_CLOSE_ITERATION = 30;
const BUY_TRACK_CLOSE_SLEEP_DURATION = 50;
async function trackCloseOrder(params) {
  const { orderId, quantity, baseRate, rate, targetCurrency, market } = params;

  let remainingQuantity = quantity;
  let isOrderClosed = false;
  for (let j = 0; j < BUY_TRACK_CLOSE_ITERATION; j++) {
    if (getCurrentTime() > SIGNAL_BUY_DEADLINE_TIME) {
      logger.warn(
        `[BUY] Current time surpassed buy deadline. We will attempt to cancel the order asap`,
      );
      break;
    }

    logger.info(
      `[BUY] Fetch information for order ${orderId} for ${j + 1} times`,
    );
    const order = await getAccountOrder(orderId);
    const {
      Closed: orderClosedTime,
      IsOpen: isOrderOpened,
      QuantityRemaining: orderRemaining,
    } = order;
    // Order is closed
    if (orderClosedTime != null || !isOrderOpened) {
      logger.info(
        `[BUY] Order completed successfully for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
      );
      isOrderClosed = true;
      break;
    } else if (!isEqual(remainingQuantity, orderRemaining)) {
      // Order is still being filled
      remainingQuantity = orderRemaining;
      logger.warn(
        `[BUY] Partially filled with AMOUNT of ${remainingQuantity} ${targetCurrency} left at RATE ${rate}`,
      );
    } else {
      logger.warn(
        `[BUY] Stucked at ${remainingQuantity} ${targetCurrency} left at RATE ${rate}`,
      );
    }
    await sleep(BUY_TRACK_CLOSE_SLEEP_DURATION);
  }
  if (!isOrderClosed) {
    // Cancel order
    try {
      logger.warn(`[BUY] Cancel since it took too long`);
      await cancelOrder(orderId);
      isOrderClosed = true;
    } catch (error) {
      // Failed to c`ancel order, might be because order is closed
      logger.info(
        `[BUY] Completed successfully for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate} since cancel request failed`,
      );
      isOrderClosed = true;
    }
  }

  if (isOrderClosed) {
    const order = await getAccountOrder(orderId);
    // Check if we did buy anything
    if (!isEqual(order.Quantity, order.QuantityRemaining)) {
      await sellChunk({
        market,
        chunkTargetAmount: order.Quantity - order.QuantityRemaining,
        baseRate,
        buyRate: order.PricePerUnit,
        targetCurrency,
      });
    }
  }
}

/**
 *
 *
 * @param {any} params
 */
async function buyChunk(params) {
  const {
    market,
    chunkSourceAmount,
    initialRate,
    sourceCurrency,
    targetCurrency,
  } = params;

  const actualAmount = floor(
    chunkSourceAmount / (1 + BITTREX_COMMISSION_RATE),
    CURRENCY_PRECISION,
  );
  logger.info(
    `[PREP] Excluding commission fee, we will actually use ${actualAmount} ${sourceCurrency} to purchase ${targetCurrency} chunk`,
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
  logger.info(
    `[BUY] Attempted to buy ${quantity} ${targetCurrency} at rate ${rate}`,
  );

  await trackCloseOrder({
    orderId,
    quantity,
    baseRate,
    rate,
    targetCurrency,
    market,
  });
}

/**
 *
 *
 * @returns
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
    logger.error("[PREP] Source amount is not defined");
    return;
  }

  // Confirm the amount user indicated
  const { confirm: amountConfirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `Are you sure you want to spend ${sourceAmount} ${sourceCurrency}?`,
  });
  if (!amountConfirm) {
    logger.error("[PREP] Be patient and decide carefully again!");
    return;
  }

  const potentialMarketSummaries = await bittrexTrack(
    true,
    1.175,
    7,
    SIGNAL_TIME,
  );
  const market = potentialMarketSummaries.summary.MarketName;
  const sellRate = potentialMarketSummaries.oldSummary.Ask;

  // Prompt from user the target currency he wants to exchange
  const { confirm: marketConfirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `The target market is ${market}. Do you want to proceed?`,
  });
  if (!marketConfirm) {
    logger.error("[PREP] Woops! Guess we are gonna miss this time :(");
    return;
  }

  // Define target currency & corresponding market
  const targetCurrency = market.split("-")[1];

  // Buy by chunks
  const chunkSourceAmount = floor(
    sourceAmount / CHUNK_COUNT,
    CURRENCY_PRECISION,
  );
  logger.info(
    `[PREP] We will use ${chunkSourceAmount} ${sourceCurrency} for ${CHUNK_COUNT} chunk(s) at BASE RATE ${sellRate}`,
  );

  // Stop early if chunk source amount is 0
  if (chunkSourceAmount === 0) {
    return;
  }

  await Promise.all(
    // eslint-disable-next-line prefer-spread
    Array.apply(null, new Array(CHUNK_COUNT)).map(function() {
      buyChunk({
        market,
        chunkSourceAmount,
        initialRate: sellRate,
        sourceCurrency,
        targetCurrency,
      });
    }),
  );
}

// Activate BUY BOT
runBot();
