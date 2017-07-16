const SignalR = require("signalr-client");
const forEach = require("lodash/forEach");

const BASE_URL = "wss://socket.bittrex.com/signalr";
const SOCKET_HUBS = ["CoreHub"];

let WebSocketClient;
function webSocketConnect(callback) {
  if (WebSocketClient == null) {
    WebSocketClient = new SignalR.client(BASE_URL, SOCKET_HUBS);
    WebSocketClient.serviceHandlers = {
      bound() {},
      connectFailed() {},
      disconnected() {},
      onerror() {},
      bindingError() {},
      connectionLost() {},
      reconnecting() {
        return false;
      },
    };
  }

  return WebSocketClient;
}

function setWebSocketMessageReceived(callback) {
  WebSocketClient.serviceHandlers.messageReceived = function(message) {
    try {
      const frame = JSON.parse(message.utf8Data);
      if (frame && frame.M) {
        forEach(frame.M, function(M) {
          callback(M);
        });
      } else {
        callback({ unhandledFrame: frame });
      }
    } catch (err) {
      console.error("Failed to parse JSON data");
    }
  };
}

function setConnectedWebSocket(markets = []) {
  WebSocketClient.serviceHandlers.connected = function(connection) {
    forEach(markets, function(market) {
      WebSocketClient.call(
        "CoreHub",
        "SubscribeToExchangeDeltas",
        market,
      ).done(function(err, result) {
        if (err != null) {
          console.error(`Failed to subscribe to ${market}`);
        }
      });
    });
  };
}

module.exports = {
  client() {
    return webSocketConnect();
  },
  listen(callback) {
    const client = webSocketConnect();
    setWebSocketMessageReceived(callback);
    return client;
  },
  subscribe(markets, callback) {
    const client = webSocketConnect();
    setConnectedWebSocket(markets);
    setWebSocketMessageReceived(callback);
    return client;
  },
};
