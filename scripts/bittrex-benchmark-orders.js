const {
  getAccountOrdersHistory,
  getAccountOrder,
} = require("../src/bittrex/ApiAccount");
const { sleep } = require("../src/utils");

const MARKET = "BTC-SWIFT";

async function main() {
  const orders = await getAccountOrdersHistory(MARKET);
  if (orders.length === 0) {
    console.log("No orders for the specified market");
    return;
  }
  const orderId = orders[0].OrderUuid;

  for (let i = 0; i < 20; i++) {
    console.time(`Order ${orderId}`);
    await getAccountOrder(orderId);
    console.timeEnd(`Order ${orderId}`);
    await sleep(50);
  }
}

main();
