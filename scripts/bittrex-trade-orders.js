// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");

const inquirer = require("inquirer");
const winston = require("winston");
const moment = require("moment");
const Deque = require("double-ended-queue");
const forEach = require("lodash/forEach");
const floor = require("lodash/floor");
const mean = require("lodash/mean");
const uniq = require("lodash/uniq");
const map = require("lodash/map");
const max = require("lodash/max");

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

/* GENERAL CONSTANTS */
const SIGNAL_TIME = moment("16:00 +0000", "HH:mm Z").toDate().getTime();
const SIGNAL_BUY_START_DEADLINE_TIME = SIGNAL_TIME + 5 * 1000;
const SIGNAL_BUY_END_DEADLINE_TIME = SIGNAL_TIME + 18 * 1000;
const SIGNAL_SELL_START_TIME = SIGNAL_TIME + 28 * 1000;
const CHUNK_COUNT = 1;

/**
 * Wait till the indicated time is met
 * @param {Number} targetTime
 * @returns
 */
function waitTill(targetTime) {
  return new Promise(resolve => {
    const intervalId = setInterval(() => {
      if (getCurrentTime() > targetTime) {
        resolve();
        clearInterval(intervalId);
      }
    }, 100);
  });
}

function hasBumpedBeforeSignal(fills, targetTime) {
  let fillsBeforeSignalCount = 0;
  forEach(fills, fill => {
    const fillTimeStamp = getTimeInUTC(fill.TimeStamp);
    // Filled at least 1 second ahead of target time
    if (fillTimeStamp < targetTime - 1 * 1000) {
      fillsBeforeSignalCount++;
    }
  });
  if (fillsBeforeSignalCount > 0.8 * fills.length) {
    return true;
  }

  return false;
}

/**
 * Track orders through WebSocket
 * @param {Number} [targetTime=SIGNAL_TIME]
 * @returns
 */
let MARKETS_MAP = {};
const DEQUE_LENGTH = 10;
const POTENTIAL_LIMIT = 20;
const PREBUMP_LIMIT = 12;
function socketTrack(targetTime = SIGNAL_TIME) {
  return new Promise(async (resolve, reject) => {
    const summaries = await getMarketSummaries();
    const markets = summaries
      .map(summary => summary.MarketName)
      .filter(market => market.startsWith("BTC-"));
    MARKETS_MAP = markets.reduce((map, market) => {
      map[market] = new Deque();
      return map;
    }, {});
    let potentialMarkets = {};

    /**
     *
     * Handler for each socket frame
     * @param {Object} frame
     */
    function frameHandler(frame) {
      if (frame.M === "updateExchangeState") {
        const marketDelta = frame.A[0];
        const { MarketName: marketName } = marketDelta;

        // Update double-ended queue of market updates for this market
        const currentTime = getCurrentTime();
        const deque = MARKETS_MAP[marketName];
        deque.push(Object.assign(marketDelta, { TimeStamp: currentTime }));
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

        // Check all fill's timestamps if they were before the signal
        if (currentTime < targetTime) {
          isPotentialMarketAfterSignal = false;
        } else {
          if (hasBumpedBeforeSignal(marketDelta.Fills, targetTime)) {
            isPotentialMarketAfterSignal = false;
          }
        }

        // Check if there is a prebump before signal or not
        for (let i = deque.length - 2; i >= 0; i--) {
          const marketUpdate = deque.get(i);
          if (marketUpdate.Fills.length > PREBUMP_LIMIT) {
            if (marketUpdate.TimeStamp < targetTime) {
              hasBumpedMarketBeforeSignal = true;
              break;
            }
            if (hasBumpedBeforeSignal(marketUpdate.Fills, targetTime)) {
              hasBumpedMarketBeforeSignal = true;
              break;
            }
          }
        }

        // If the two conditions are met, then this is a potential market after the signal
        if (isPotentialMarketAfterSignal && !hasBumpedMarketBeforeSignal) {
          resolve(marketName);
        }
      }
    }

    WebSocket.subscribe(markets, frameHandler);
  });
}

/* SELL CONSTANTS */
const SELL_TRACK_CLOSE_ITERATION_COUNT = 45;
const SELL_RATE_STEP_FIRST_ITERATION = 0;
const SELL_RATE_STEP_SECOND_ITERATION = 0.0125;
const SELL_RATE_STEP_THIRD_ITERATION = 0.025;
const SELL_RATE_STEP_OTHERS_ITERATION = 0.05;
const SELL_TRACK_CLOSE_TIMEOUT = 50;

/**
 * Get maximum rate which has been filled or bought from the most recent valid market update
 *
 * @param {String} market
 * @returns {Number?}
 */
function getBaseRateForSell(market, buyRate, iterationCounter) {
  // Determine length of `maxRateList`
  let maxRateListLength;
  if (iterationCounter === 0) {
    maxRateListLength = 5;
  } else if (iterationCounter === 1) {
    maxRateListLength = 3;
  } else {
    maxRateListLength = 1;
  }

  const deque = MARKETS_MAP[market];
  let i = deque.length - 1;
  if (i < 0) {
    return null;
  }

  const maxRateList = [];
  do {
    const marketUpdate = MARKETS_MAP[market].get(i);
    const { Fills: fills } = marketUpdate;
    if (fills.length > 0) {
      const maxRate = max(map(fills, fill => fill.Rate));
      if (maxRate > buyRate) {
        maxRateList.push(maxRate);
      }
    }
    if (maxRateList.length === maxRateListLength) {
      break;
    }
    i--;
  } while (i >= 0);

  if (maxRateList.length > 0) {
    return max(maxRateList);
  }

  return null;
}

/**
 * Make sell order by chunk
 *
 * @param {Object} params
 */
async function sellChunk(params) {
  const { market, buyRate, chunkTargetAmount, targetCurrency } = params;
  let quantity = chunkTargetAmount;

  for (let i = 0; i < 10; i++) {
    // Wait till best time to start selling
    if (i === 0) {
      if (getCurrentTime() < SIGNAL_SELL_START_TIME) {
        tradeLogger.info("[SELL] Wait till best time to sell for 1st round");
        await waitTill(SIGNAL_SELL_START_TIME);
      }
    }

    const baseRate = getBaseRateForSell(market, buyRate, i);

    // Check for invalid base sell rate
    if (baseRate == null || baseRate === 0) {
      tradeLogger.error("[SELL] Invalid base sell rate!!!");
      await sleep(1000);
      continue;
    }

    // Calculate rate
    let rate;
    if (i === 0) {
      rate = floor(
        baseRate * (1 - SELL_RATE_STEP_FIRST_ITERATION),
        CURRENCY_PRECISION,
      );
    } else if (i === 1) {
      rate = floor(
        baseRate * (1 - SELL_RATE_STEP_SECOND_ITERATION),
        CURRENCY_PRECISION,
      );
    } else if (i === 2) {
      rate = floor(
        baseRate * (1 - SELL_RATE_STEP_THIRD_ITERATION),
        CURRENCY_PRECISION,
      );
    } else {
      rate = floor(
        baseRate * (1 - SELL_RATE_STEP_OTHERS_ITERATION),
        CURRENCY_PRECISION,
      );
    }

    // Make sell order. Retry at most 5 times if failed to make sell order
    let orderId;
    let sellRetryCounter = 0;
    while (orderId == null && sellRetryCounter < 5) {
      try {
        orderId = await makeSellOrder({
          market,
          quantity,
          rate,
        });
        tradeLogger.info(
          `[SELL] Attempted for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
        );
        sellRetryCounter++;
      } catch (err) {
        tradeLogger.error(
          `[SELL] Failed to attempt for AMOUNT of ${quantity} ${targetCurrency} at RATE ${rate}`,
        );
        sellRetryCounter++;
      }
    }

    if (orderId == null) {
      continue;
    }

    let remainingQuantity = 0;
    let isOrderClosed = false;
    for (let j = 0; j < SELL_TRACK_CLOSE_ITERATION_COUNT; j++) {
      tradeLogger.info(
        `[SELL] Fetch information for order ${orderId} for ${j + 1} time(s)`,
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

    // If order is closed, check the remaining quantity from order to see
    // if we need to continue selling
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

/* BUY CONSTANTS */
const BUY_RATE_STEP = 0.125;
const BUY_TRACK_CLOSE_ITERATION = 60;
const BUY_TRACK_CLOSE_TIMEOUT = 50;

/**
 * Get the base rate to make buy purchase
 *
 * @param {Object} latestMarketUpdate
 * @returns {Number}
 */
function getBaseRateForBuy(latestMarketUpdate) {
  if (latestMarketUpdate.Fills.length === 0) {
    return null;
  }
  const averageFillRate = mean(
    uniq(map(latestMarketUpdate.Fills, fill => fill.Rate)),
  );

  return averageFillRate;
}

/**
 * Make buy order by chunks
 * @param {Object} params
 */
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
  const baseRate = getBaseRateForBuy(latestMarketUpdate);

  // Check for invalid base buy rate
  if (baseRate == null) {
    tradeLogger.info(`[BUY] Invalid Buy Rate!!!`);
    return;
  }
  const rate = floor(baseRate * (1 + BUY_RATE_STEP), CURRENCY_PRECISION);

  // Calculate quantity to buy
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
    if (getCurrentTime() > SIGNAL_BUY_END_DEADLINE_TIME) {
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
    await sleep(BUY_TRACK_CLOSE_TIMEOUT);
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
 * Main Trade Program
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
  const potentialMarket = await socketTrack(SIGNAL_TIME);

  // Define market & target currency from potential market
  if (getCurrentTime() > SIGNAL_BUY_START_DEADLINE_TIME) {
    tradeLogger.error(
      `[PREP] Detection of potential market ${potentialMarket} is too late. We will not attempt to make buy orders`,
    );
    return;
  }
  tradeLogger.info(`[PREP] Potential Market: ${potentialMarket}`);
  const market = potentialMarket;
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
