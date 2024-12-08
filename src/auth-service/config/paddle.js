const constants = require("@config/constants");
const Paddle = require("@paddle/paddle-node-sdk");

const paddleClient = new Paddle.Paddle({
  apiKey: constants.PADDLE_API_KEY,
  environment: constants.PADDLE_ENVIRONMENT || "sandbox",
});
module.exports = paddleClient;
