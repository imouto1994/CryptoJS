// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const inquirer = require("inquirer");
const winston = require("winston");
const moment = require("moment");
const Deque = require("double-ended-queue");
const forEach = require("lodash/forEach");
const floor = require("lodash/floor");

const { getMarketSummaries } = require("../src/bittrex/ApiPublic");
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
  getCurrentTime,
  getTimeInUTC,
  sleep,
  isEqual,
} = require("../src/utils");
const {
  CURRENCY_BITCOIN,
  CURRENCY_PRECISION,
  BITTREX_COMMISSION_RATE,
} = require("../src/constants");
const WebSocket = require("../src/bittrex/WebSocket");

const tradeLogger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
      colorize: true,
    }),
    new winston.transports.File({
      filename: `logs/bittrex-trade-orders-${new Date().toLocaleString()}.log`,
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});
const trackConsoleLogger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp() {
        return new Date().toLocaleString();
      },
      colorize: true,
    }),
  ],
  exitOnError: false,
});
const trackFileLogger = new winston.Logger({
  transports: [
    new winston.transports.File({
      filename: `logs/bittrex-track-orders-socket-${new Date().toLocaleString()}.log`,
      json: false,
      timestamp() {
        return new Date().toLocaleString();
      },
    }),
  ],
  exitOnError: false,
});

// Constants
const SIGNAL_TIME = moment("16:00 +0000", "HH:mm Z").toDate().getTime();
const SIGNAL_BUY_DEADLINE_TIME = SIGNAL_TIME + 15 * 1000;
const SIGNAL_SELL_DEADLINE_TIME = SIGNAL_TIME + 30 * 1000;
const CHUNK_COUNT = 1;
const DEQUE_LENGTH = 15;
const POTENTIAL_LIMIT = 20;
const PREBUMP_LIMIT = 15;

/**
 * Track orders through WebSocket
 * @param {any} [targetTime=SIGNAL_TIME]
 * @returns
 */
let MARKETS_MAP = {};
function socketTrack(targetTime = SIGNAL_TIME) {
  return new Promise(async (resolve, reject) => {
    trackConsoleLogger.info(`Start tracking orders through socket`);
    const summaries = await getMarketSummaries();
    const markets = summaries
      .map(summary => summary.MarketName)
      .filter(market => market.startsWith("BTC-"));
    MARKETS_MAP = markets.reduce((map, market) => {
      map[market] = new Deque();
      return map;
    }, {});
    let potentialMarkets = {};
    let potentialMarketAfterSignal;

    /**
     *
     *
     * @param {any} frame
     * @returns
     */
    function frameHandler(frame) {
      if (frame.M === "updateExchangeState") {
        const marketDelta = frame.A[0];
        const { MarketName: marketName } = marketDelta;

        // Stop collecting data for other markets after we get the potential market after signal
        if (potentialMarketAfterSignal != null) {
          if (marketName !== potentialMarketAfterSignal) {
            return;
          }
        }
        // Log market update
        trackFileLogger.info(JSON.stringify(frame.A[0]));

        // Update double-ended queue of market updates for this market
        const deque = MARKETS_MAP[marketName];
        deque.push(Object.assign(marketDelta, { TimeStamp: getCurrentTime() }));
        if (deque.length > DEQUE_LENGTH) {
          deque.shift();
        }

        // If it was already a potential market, we will just ignore it
        if (potentialMarkets[marketName] != null) {
          return;
        }

        // Check if this is a potential market
        if (marketDelta.Fills.length > POTENTIAL_LIMIT) {
          potentialMarkets[marketName] = true;
        } else {
          return;
        }

        // Check if this is a potential market after signal
        let isPotentialMarketAfterSignal = true;
        let hasBumpedMarketBeforeSignal = false;
        let fillsBeforeSignalCount = 0;

        // Check all fill's timestamps if they were before the signal
        forEach(marketDelta.Fills, fill => {
          if (getTimeInUTC(fill.TimeStamp) < targetTime) {
            fillsBeforeSignalCount++;
          }
        });
        if (fillsBeforeSignalCount > 0.75 * marketDelta.Fills.length) {
          isPotentialMarketAfterSignal = false;
        }

        // Check if there is a prebump before signal or not
        for (let i = deque.length - 2; i >= 0; i--) {
          const marketUpdate = deque.get(i);
          if (
            marketUpdate.Fills.length > PREBUMP_LIMIT &&
            marketUpdate.TimeStamp < targetTime
          ) {
            hasBumpedMarketBeforeSignal = true;
            break;
          }
        }

        // If the two conditions are met, then this is a potential market after the signal
        if (isPotentialMarketAfterSignal && !hasBumpedMarketBeforeSignal) {
          const potentialMessage = `POTENTIAL MARKET: ${marketName}`;
          trackFileLogger.info(potentialMessage);
          trackConsoleLogger.info(potentialMessage);
          potentialMarketAfterSignal = marketName;
          resolve(marketName);
        }
      }
    }

    WebSocket.subscribe(markets, frameHandler);
  });
}

/**
 *
 *
 * @param {any} params
 */
const SELL_TRACK_CLOSE_FIRST_ITERATION_COUNT = 35;
const SELL_RATE_STEP_FIRST_ITERATION = 0.15;
const SELL_TRACK_CLOSE_SECOND_ITERATION_COUNT = 30;
const SELL_RATE_STEP_SECOND_ITERATION = 0.05;
const SELL_TRACK_CLOSE_OTHERS_ITERATION_COUNT = 25;
const SELL_RATE_STEP_OTHERS_ITERATION = 0.1;
const SELL_TRACK_CLOSE_TIMEOUT = 50;
async function sellChunk(params) {
  const { market, chunkTargetAmount, targetCurrency } = params;

  let quantity = chunkTargetAmount;
  let shouldSellAsap = false;
  for (let i = 0; i < 5; i++) {
    // Calculate rate
    let rate;
    let iterationCount;
    const latestMarketUpdate = MARKETS_MAP[market].peekBack();
    if (!shouldSellAsap && i === 0) {
      const maxFillRate = latestMarketUpdate.Fills.reduce(
        (max, fill) => Math.max(max, fill.Rate),
        0,
      );
      iterationCount = SELL_TRACK_CLOSE_FIRST_ITERATION_COUNT;
      rate = floor(
        maxFillRate * (1 + SELL_RATE_STEP_FIRST_ITERATION),
        CURRENCY_PRECISION,
      );
    } else if (!shouldSellAsap && i === 1) {
      const maxFillRate = latestMarketUpdate.Fills.reduce(
        (max, fill) => Math.max(max, fill.Rate),
        0,
      );
      iterationCount = SELL_TRACK_CLOSE_SECOND_ITERATION_COUNT;
      rate = floor(
        maxFillRate * (1 - SELL_RATE_STEP_SECOND_ITERATION),
        CURRENCY_PRECISION,
      );
    } else {
      const maxFillRate = latestMarketUpdate.Fills.reduce(
        (max, fill) => Math.max(max, fill.Rate),
        0,
      );
      iterationCount = SELL_TRACK_CLOSE_OTHERS_ITERATION_COUNT;
      rate = floor(
        maxFillRate * (1 - SELL_RATE_STEP_OTHERS_ITERATION),
        CURRENCY_PRECISION,
      );
    }

    // Make sell order
    let orderId;
    try {
      orderId = await makeSellOrder({
        market,
        quantity,
        rate,
      });
      tradeLogger.info(
        `[SELL] Attempted for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
      );
    } catch (err) {
      tradeLogger.error(
        `[SELL] Failed to attempt for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
      );
    }

    if (orderId == null) {
      continue;
    }

    let remainingQuantity = 0;
    let isOrderClosed = false;
    for (let j = 0; j < iterationCount; j++) {
      if (i < 2 && getCurrentTime() > SIGNAL_SELL_DEADLINE_TIME) {
        tradeLogger.info(
          `[SELL] Current time surpassed sell deadline. We will attempt to sell everything left asap`,
        );
        shouldSellAsap = true;
        break;
      }
      tradeLogger.info(
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
        tradeLogger.info(
          `[SELL] Completed successfully for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
        );
        isOrderClosed = true;
        break;
      } else if (!isEqual(remainingQuantity, orderRemaining)) {
        // Order is still being filled
        remainingQuantity = orderRemaining;
        tradeLogger.warn(
          `[SELL] Partially filled with AMOUNT of ${remainingQuantity} ${targetCurrency} left at RATE ${rate}`,
        );
      } else {
        tradeLogger.warn(
          `[SELL] Stucked at AMOUNT of ${remainingQuantity} ${targetCurrency} left at rate ${rate}`,
        );
      }
      await sleep(SELL_TRACK_CLOSE_TIMEOUT);
    }

    if (!isOrderClosed) {
      // Cancel order
      try {
        tradeLogger.warn(`[SELL] Cancel since it took too long`);
        await cancelOrder(orderId);
        isOrderClosed = true;
      } catch (error) {
        // Failed to cancel order, might be because order is closed
        tradeLogger.info(
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
 * Buy chunks
 * @param {any} params
 */
const BUY_RATE_STEP = 0.1;
const BUY_TRACK_CLOSE_ITERATION = 40;
const BUY_TRACK_CLOSE_SLEEP_DURATION = 100;
async function buyChunk(params) {
  const { market, chunkSourceAmount, sourceCurrency, targetCurrency } = params;

  const actualAmount = floor(
    chunkSourceAmount / (1 + BITTREX_COMMISSION_RATE),
    CURRENCY_PRECISION,
  );
  tradeLogger.info(
    `[PREP] Excluding commission fee, we will actually use ${actualAmount} ${sourceCurrency} to purchase ${targetCurrency} chunk`,
  );

  // Calculate rate
  const latestMarketUpdate = MARKETS_MAP[market].peekBack();
  const minFillRate = latestMarketUpdate.Fills.reduce(
    (min, fill) => Math.min(min, fill.Rate),
    Infinity,
  );
  const rate = floor(minFillRate * (1 + BUY_RATE_STEP), CURRENCY_PRECISION);
  const quantity = floor(actualAmount / rate, CURRENCY_PRECISION);

  // Make buy order
  const orderId = await makeBuyOrder({
    market,
    quantity,
    rate,
  });
  tradeLogger.info(
    `[BUY] Attempted to buy ${quantity} ${targetCurrency} at rate ${rate}`,
  );

  // Track whether order is fulfilled in time or not
  let remainingQuantity = quantity;
  let isOrderClosed = false;
  for (let j = 0; j < BUY_TRACK_CLOSE_ITERATION; j++) {
    if (getCurrentTime() > SIGNAL_BUY_DEADLINE_TIME) {
      tradeLogger.warn(
        `[BUY] Current time surpassed buy deadline. We will attempt to cancel the order asap`,
      );
      break;
    }

    tradeLogger.info(
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
      isOrderClosed = true;
      break;
    } else if (!isEqual(remainingQuantity, orderRemaining)) {
      // Order is still being filled
      remainingQuantity = orderRemaining;
      tradeLogger.warn(
        `[BUY] Partially filled with AMOUNT of ${remainingQuantity} ${targetCurrency} left at RATE ${rate}`,
      );
    } else {
      tradeLogger.warn(
        `[BUY] Stucked at ${remainingQuantity} ${targetCurrency} left at RATE ${rate}`,
      );
    }
    await sleep(BUY_TRACK_CLOSE_SLEEP_DURATION);
  }
  if (!isOrderClosed) {
    // Cancel order
    try {
      tradeLogger.warn(`[BUY] Cancel since it took too long`);
      await cancelOrder(orderId);
      isOrderClosed = true;
    } catch (error) {
      // Failed to cancel order, might be because order is closed
      isOrderClosed = true;
    }
  }

  if (isOrderClosed) {
    const order = await getAccountOrder(orderId);
    // Check if we did buy anything
    if (!isEqual(order.Quantity, order.QuantityRemaining)) {
      const chunkTargetAmount = order.Quantity - order.QuantityRemaining;
      const buyRate = order.PricePerUnit;
      tradeLogger.info(
        `[BUY] Order completed successfully for AMOUNT of ${chunkTargetAmount} ${targetCurrency} at RATE ${buyRate}`,
      );
      await sellChunk({
        market,
        chunkTargetAmount,
        rate,
        buyRate,
        sourceCurrency,
        targetCurrency,
      });
    }
  }
}

/**
 *
 *
 */
async function main() {
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
    tradeLogger.error("[PREP] Source amount is not defined");
    return;
  }

  // Confirm the amount user indicated
  const { confirm: amountConfirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `Are you sure you want to spend ${sourceAmount} ${sourceCurrency}?`,
  });
  if (!amountConfirm) {
    tradeLogger.error("[PREP] Be patient and decide carefully again!");
    return;
  }

  // Track orders and get potential market through WebSocket
  const market = await socketTrack(SIGNAL_TIME);

  // Prompt to confirm the potential market to exchange
  const { confirm: marketConfirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `One potential market is ${market}. Do you want to proceed?`,
  });
  if (!marketConfirm) {
    tradeLogger.error("[PREP] Woops! Guess we are gonna miss this time :(");
    return;
  }

  // Define target currency & corresponding market
  const targetCurrency = market.split("-")[1];

  // Buy by chunks
  const chunkSourceAmount = floor(
    sourceAmount / CHUNK_COUNT,
    CURRENCY_PRECISION,
  );
  tradeLogger.info(
    `[PREP] We will use ${chunkSourceAmount} ${sourceCurrency} for ${CHUNK_COUNT} chunk(s)`,
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
        sourceCurrency,
        targetCurrency,
      });
    }),
  );
}

main();
