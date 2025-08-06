// config/redis.js - Redis v4 Compatible
const redis = require("redis");
const constants = require("./constants");
const { logObject, logText, logElement } = require("@utils/shared");

const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;

const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- redis-config`
);

logElement("redis URL", REDIS_SERVER && REDIS_SERVER.concat(":", REDIS_PORT));

// Connection state tracking
let isConnected = false;
let isReady = false;
let connectionAttempts = 0;
let lastError = null;

// Redis v4 configuration
const redisConfig = {
  socket: {
    host: REDIS_SERVER,
    port: REDIS_PORT,
    connectTimeout: 10000, // 10 seconds (was connect_timeout)
    commandTimeout: 5000, // 5 seconds (was command_timeout)
    keepAlive: true, // (was socket_keepalive)
    reconnectStrategy: (retries) => {
      connectionAttempts = retries + 1;

      if (retries > 3) {
        logger.error("Redis maximum retry attempts reached");
        return false; // Stop retrying
      }

      const delay = Math.min(retries * 1000, 5000); // Max 5s delay
      logger.warn(`Redis retry attempt ${retries + 1} in ${delay}ms`);
      return delay;
    },
  },
  // Disable offline queue to prevent memory issues (was enable_offline_queue)
  disableOfflineQueue: true,
};

// Create Redis client with v4 syntax
const client = redis.createClient(redisConfig);

// Redis v4 event handlers
client.on("connect", () => {
  isConnected = true;
  logger.info(`Redis connected to ${REDIS_SERVER}:${REDIS_PORT}`);
});

client.on("ready", () => {
  isReady = true;
  lastError = null;
  logger.info("Redis connection ready");
});

client.on("error", (error) => {
  lastError = error;
  isConnected = false;
  isReady = false;

  // Simple error logging
  if (error.code === "ECONNREFUSED") {
    logger.warn(
      `Redis connection refused. Is Redis running on ${REDIS_SERVER}:${REDIS_PORT}?`
    );
  } else if (error.code === "ETIMEDOUT") {
    logger.warn(`Redis connection timeout to ${REDIS_SERVER}:${REDIS_PORT}`);
  } else if (error.code === "ENOTFOUND") {
    logger.error(`Redis host not found: ${REDIS_SERVER}`);
  } else {
    logger.error(`Redis error: ${error.message}`);
  }
});

client.on("end", () => {
  isConnected = false;
  isReady = false;
  logger.warn("Redis connection ended");
});

client.on("reconnecting", () => {
  isConnected = false;
  isReady = false;
  logger.info(`Redis reconnecting... Attempt ${connectionAttempts}`);
});

// Initialize connection
(async () => {
  try {
    await client.connect();
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error.message}`);
  }
})();

// Redis v4 uses promises natively - no need for promisify
const redisGetAsync = async (key) => {
  if (!client.isOpen) {
    throw new Error("Redis not ready");
  }
  return await client.get(key);
};

const redisSetAsync = async (key, value) => {
  if (!client.isOpen) {
    throw new Error("Redis not ready");
  }
  return await client.set(key, value);
};

const redisExpireAsync = async (key, seconds) => {
  if (!client.isOpen) {
    throw new Error("Redis not ready");
  }
  return await client.expire(key, seconds);
};

const redisDelAsync = async (key) => {
  if (!client.isOpen) {
    throw new Error("Redis not ready");
  }
  return await client.del(key);
};

// Ping function for v4
const redisPingAsync = async (timeout = 3000) => {
  if (!client.isOpen) {
    throw new Error("Redis not ready");
  }

  try {
    const result = await Promise.race([
      client.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Ping timeout")), timeout)
      ),
    ]);
    return result;
  } catch (error) {
    throw error;
  }
};

// Updated utility functions for v4
const redisUtils = {
  isAvailable: () => client.isOpen && client.isReady,

  getStatus: () => ({
    connected: isConnected,
    ready: isReady,
    isOpen: client.isOpen,
    attempts: connectionAttempts,
    lastError: lastError?.message || null,
    server: `${REDIS_SERVER}:${REDIS_PORT}`,
  }),

  ping: async (timeout = 3000) => {
    if (!client.isOpen) {
      return false;
    }

    try {
      const result = await Promise.race([
        client.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Ping timeout")), timeout)
        ),
      ]);
      return result === "PONG";
    } catch (error) {
      logger.warn(`Redis ping failed: ${error.message}`);
      return false;
    }
  },
};

// Graceful shutdown for v4
const gracefulShutdown = async () => {
  if (client.isOpen) {
    logger.info("Shutting down Redis connection...");
    try {
      await client.quit();
      logger.info("Redis connection closed gracefully");
    } catch (err) {
      logger.error(`Error during Redis shutdown: ${err.message}`);
      await client.disconnect();
    }
  }
};

// Handle process termination
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("beforeExit", gracefulShutdown);

// Export everything with v4 compatibility
module.exports = client;
module.exports.redisGetAsync = redisGetAsync;
module.exports.redisSetAsync = redisSetAsync;
module.exports.redisExpireAsync = redisExpireAsync;
module.exports.redisDelAsync = redisDelAsync;
module.exports.redisPingAsync = redisPingAsync;
module.exports.redisUtils = redisUtils;
module.exports.gracefulShutdown = gracefulShutdown;
module.exports.connected = () => client.isOpen;
module.exports.ready = () => client.isReady;
