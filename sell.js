// Polyfill Promise with Bluebird Promise
global.Promise = require("bluebird");
const inquirer = require("inquirer");
const floor = require("lodash/floor");

const { getMarketTicker } = require("./src/ApiPublic");
const { getAccountBalance, getAccountOrder } = require("./src/ApiAccount");
const { makeSellOrder, cancelOrder } = require("./src/ApiMarket");
const {
  CURRENCY_BITCOIN,
  CURRENCY_PRECISION,
  SELL_CHUNK_COUNT,
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

async function sellChunk({
  market,
  chunkTargetAmount,
  initialRate,
  sourceCurrency,
  targetCurrency,
}) {
  for (let i = 0; i < 5; i++) {
    // Calculate rate
    let baseRate;
    if (i > 0) {
      const { Bid: latestRate } = await getMarketTicker(market);
      baseRate = latestRate;
    } else {
      baseRate = initialRate;
    }

    // Make sell order
    const rate = baseRate * (1 - EXCHANGE_RATE_STEP);
    const quantity = chunkTargetAmount;
    logInfo(
      `Attempted to sell ${chunkTargetAmount} ${targetCurrency} at rate ${rate}`
    );
    const orderId = await makeSellOrder({
      market,
      quantity,
      rate,
    });

    let remainingQuantity = 0;
    let isOrderClosed = false;
    let pendingOrderCounter = 0;
    for (let j = 0; j < 15; j++) {
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
          `Order completed successfully for selling ${quantity} ${targetCurrency} at rate ${rate}`
        );
        isOrderClosed = true;
        break;
      } else if (!isEqual(remainingQuantity, orderRemaining)) {
        // Order is still being filled
        remainingQuantity = orderRemaining;
        pendingOrderCounter = 0;
        logInfo(
          `Order is partially filled with ${remainingQuantity} / ${quantity} ${targetCurrency} remaining at rate ${rate}`
        );
      } else {
        // Order remaining is unchanged after 3 consecutive checks
        if (pendingOrderCounter === 5) {
          // Cancel order
          try {
            logWarning(
              `Attempted to cancel the current order since order is not filled well`
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
        pendingOrderCounter++;
      }
      await sleep(250);
    }
    if (isOrderClosed) {
      break;
    } else {
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
  }
}

async function sell({ market, initialRate, sourceCurrency, targetCurrency }) {
  const [balance, ticker] = await Promise.all([
    getAccountBalance(targetCurrency),
    getMarketTicker(market),
  ]);
  const { Available: targetAmount } = balance;
  logInfo(`Current balance is ${targetAmount} ${targetCurrency}`);
  const { Bid: latestBid } = ticker;
  const chunkTargetAmount = floor(
    targetAmount / SELL_CHUNK_COUNT,
    CURRENCY_PRECISION
  );
  await Promise.all(
    // eslint-disable-next-line prefer-spread
    Array.apply(null, new Array(SELL_CHUNK_COUNT)).map(function() {
      sellChunk({
        market,
        chunkTargetAmount,
        initialRate: latestBid,
        sourceCurrency,
        targetCurrency,
      });
    })
  );
}

async function failureTimeout(duration) {
  await new Promise(function(resolve, reject) {
    setTimeout(function() {
      logError("Timeout!!!");
      reject();
    }, duration);
  });
}

let stopTracking;
async function trackBidRate(market) {
  let previoudBid;
  for (let i = 0; i < 60; i++) {
    if (stopTracking) {
      break;
    }
    const ticker = await getMarketTicker(market);
    const { Bid: latestBid } = ticker;
    logInfo("Latest Bid", latestBid);
    if (previoudBid != null) {
      if (latestBid / previoudBid < 0.85) {
        logError("Bid starts to decrease!!!");
        throw new Error("Bid starts to decrease!!!");
      }
      previoudBid = latestBid;
    } else {
      previoudBid = latestBid;
    }
    await sleep(500);
  }
}

async function sellCountDown({ market, sourceCurrency, targetCurrency }) {
  try {
    await Promise.all([failureTimeout(30 * 1000), trackBidRate(market)]);
    await sell({ market, sourceCurrency, targetCurrency });
  } catch (err) {
    await sell({ market, sourceCurrency, targetCurrency });
  }
}

/**
 * Run sell bot to sell all target currencies no matter what
 * @return {[type]} [description]
 */
async function runBot() {
  // Define source currency
  const sourceCurrency = CURRENCY_BITCOIN;

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

  // Confirm the currency user indicated
  const { confirm: currencyConfirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `Are you sure you want to activate the SELL BOT for target currency ${targetCurrency}?`,
  });
  if (!currencyConfirm) {
    logWarning("Be patient and decide carefully again!");
    return;
  }

  await sellCountDown({
    market,
    sourceCurrency,
    targetCurrency,
  });
}

// Activate SELL BOT
runBot();
