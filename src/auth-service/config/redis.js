//config/redis.js
const Redis = require("redis");
const constants = require("./constants");

const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;

console.log(`Redis connecting to: ${REDIS_SERVER}:${REDIS_PORT}`);

// Fixed Redis configuration
const redis = Redis.createClient({
  host: REDIS_SERVER,
  port: REDIS_PORT,

  // Improved retry strategy
  retry_strategy: (options) => {
    if (options.error && options.error.code === "ECONNREFUSED") {
      console.error(
        `Redis connection refused to ${REDIS_SERVER}:${REDIS_PORT}`
      );
    }

    if (options.total_retry_time > 1000 * 60 * 2) {
      // 2 minutes max
      console.error("Redis retry time exhausted");
      return new Error("Retry time exhausted");
    }

    if (options.attempt > 3) {
      // Max 3 attempts
      console.error("Redis maximum retry attempts reached");
      return new Error("Max retry attempts exceeded");
    }

    const delay = Math.min(options.attempt * 1000, 5000); // Max 5s delay
    console.log(`Redis retry attempt ${options.attempt} in ${delay}ms`);
    return delay;
  },

  // Additional connection options
  connect_timeout: 10000, // 10 seconds
  command_timeout: 5000, // 5 seconds
  enable_offline_queue: false,
});

// Simple event handlers
redis.on("connect", () => {
  console.log(`Redis connected to ${REDIS_SERVER}:${REDIS_PORT}`);
});

redis.on("ready", () => {
  console.log("Redis connection established and ready");
});

redis.on("error", (error) => {
  if (error.code === "ECONNREFUSED") {
    console.warn(
      `Redis connection refused. Is Redis running on ${REDIS_SERVER}:${REDIS_PORT}?`
    );
  } else if (error.code === "ETIMEDOUT") {
    console.warn(`Redis connection timeout to ${REDIS_SERVER}:${REDIS_PORT}`);
  } else if (error.code === "ENOTFOUND") {
    console.error(`Redis host not found: ${REDIS_SERVER}`);
  } else {
    console.error(`Redis error: ${error.message}`);
  }
});

redis.on("end", () => {
  console.log("Redis connection ended");
});

redis.on("reconnecting", (delay, attempt) => {
  console.log(`Redis reconnecting... Attempt ${attempt}, delay: ${delay}ms`);
});

module.exports = redis;
