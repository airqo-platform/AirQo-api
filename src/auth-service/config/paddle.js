const constants = require("@config/constants");
const { Paddle } = require("@paddle/paddle-node-sdk");
const { logObject } = require("@utils/log");

// Log the API key details first
logObject("API Key Configuration", {
  length: constants.PADDLE_API_KEY?.length || 0,
  hasWhitespace: constants.PADDLE_API_KEY
    ? /\s/.test(constants.PADDLE_API_KEY)
    : false,
  startsWith: constants.PADDLE_API_KEY?.substring(0, 8),
  environment: constants.PADDLE_ENVIRONMENT || "sandbox",
});

// Create the paddle client with debug capabilities
const paddleClient = new Paddle({
  apiKey: constants.PADDLE_API_KEY,
  environment: constants.PADDLE_ENVIRONMENT || "sandbox",
});

logObject("Paddle Client Configuration", {
  environment: constants.PADDLE_ENVIRONMENT,
  keyLength: constants.PADDLE_API_KEY?.length || 0,
  hasClient: !!paddleClient.client,
});

module.exports = paddleClient;
