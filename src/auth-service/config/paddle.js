const constants = require("@config/constants");
const { Paddle, Environment } = require("@paddle/paddle-node-sdk");
const { logObject } = require("@utils/shared");

logObject("API Key Configuration", {
  length: constants.PADDLE_API_KEY?.length || 0,
  hasWhitespace: constants.PADDLE_API_KEY
    ? /\s/.test(constants.PADDLE_API_KEY)
    : false,
  startsWith: constants.PADDLE_API_KEY?.substring(0, 8),
  environment: constants.PADDLE_ENVIRONMENT || "sandbox",
});

const environ = constants.PADDLE_ENVIRONMENT || "sandbox";
const paddleClient = new Paddle(constants.PADDLE_API_KEY.trim(), {
  environment: Environment[environ],
  logLevel: "verbose",
});

logObject("constants.PADDLE_ENVIRONMENT", constants.PADDLE_ENVIRONMENT);
logObject("paddleClient.client", paddleClient.client);

logObject("Paddle Client Configuration", {
  environment: constants.PADDLE_ENVIRONMENT,
  keyLength: constants.PADDLE_API_KEY?.length || 0,
  hasClient: !!paddleClient.client,
});

module.exports = paddleClient;
