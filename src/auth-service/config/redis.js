//src/auth-service/config/redis.js
const { createClient } = require("redis");
const constants = require("./constants");

const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;

console.log(`Redis connecting to: ${REDIS_SERVER}:${REDIS_PORT}`);

// Redis v4 configuration
const redis = createClient({
  url: `redis://${REDIS_SERVER}:${REDIS_PORT}`,
  socket: {
    connectTimeout: 10000, // 10 seconds
    commandTimeout: 5000, // 5 seconds
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.error("Redis maximum retry attempts reached");
        return new Error("Max retry attempts exceeded");
      }

      const delay = Math.min(retries * 1000, 5000); // Max 5s delay
      console.log(`Redis retry attempt ${retries} in ${delay}ms`);
      return delay;
    },
  },
  // Disable offline queue to prevent memory buildup
  disableOfflineQueue: true,
});

// Event handlers for Redis v4
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
    console.error(`Redis error: ${error.message}`, {
      code: error.code,
      stack: error.stack?.substring(0, 500), // Limit stack trace
    });
  }
});

redis.on("end", () => {
  console.log("Redis connection ended");
});

redis.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

// Initialize connection
(async () => {
  try {
    await redis.connect();
    console.log("Redis client connected successfully");
  } catch (error) {
    console.error("Failed to connect to Redis:", error.message);
  }
})();

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("Gracefully shutting down Redis connection...");
  try {
    await redis.disconnect();
    console.log("Redis disconnected");
  } catch (error) {
    console.error("Error during Redis disconnect:", error.message);
  }
});

module.exports = redis;
