const Paddle = require("@paddle/paddle-node-sdk");

// Initialize Paddle client with environment variables
const paddleClient = new Paddle.Client({
  apiKey: process.env.PADDLE_API_KEY,
  environment: process.env.PADDLE_ENVIRONMENT || "sandbox",
});

module.exports = paddleClient;
