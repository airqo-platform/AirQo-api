// config/redis.js
const redis = require("redis");
const constants = require("./constants");
const { logObject, logText, logElement } = require("@utils/shared");
const { promisify } = require("util");

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

// Simplified Redis configuration - only server and port
const redisConfig = {
  host: REDIS_SERVER,
  port: REDIS_PORT,

  // Basic timeout settings
  connect_timeout: 10000, // 10 seconds
  command_timeout: 5000, // 5 seconds

  // Simplified retry strategy
  retry_strategy: (options) => {
    connectionAttempts++;

    if (options.error && options.error.code === "ECONNREFUSED") {
      logger.error(
        `Redis server refused connection to ${REDIS_SERVER}:${REDIS_PORT}`
      );
    }

    if (options.total_retry_time > 1000 * 60 * 2) {
      // 2 minutes max
      logger.error("Redis retry time exhausted");
      return new Error("Retry time exhausted");
    }

    if (options.attempt > 3) {
      // Max 3 attempts
      logger.error("Redis maximum retry attempts reached");
      return new Error("Max retry attempts exceeded");
    }

    const delay = Math.min(options.attempt * 1000, 5000); // Max 5s delay
    logger.warn(`Redis retry attempt ${options.attempt} in ${delay}ms`);
    return delay;
  },

  // Disable offline queue to prevent memory issues
  enable_offline_queue: false,

  // Basic connection options
  detect_dead_servers: true,
  socket_keepalive: true,
};

// Create Redis client with simplified config
const client = redis.createClient(redisConfig);

// event handlers
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

client.on("reconnecting", (delay, attempt) => {
  isConnected = false;
  isReady = false;
  logger.info(`Redis reconnecting... Attempt ${attempt}, delay: ${delay}ms`);
});

// Create safe promisified versions with better error handling
const redisGetAsync = async (key) => {
  if (!isReady) {
    throw new Error("Redis not ready");
  }
  const asyncGet = promisify(client.get).bind(client);
  return await asyncGet(key);
};

const redisSetAsync = async (key, value) => {
  if (!isReady) {
    throw new Error("Redis not ready");
  }
  const asyncSet = promisify(client.set).bind(client);
  return await asyncSet(key, value);
};

const redisExpireAsync = async (key, seconds) => {
  if (!isReady) {
    throw new Error("Redis not ready");
  }
  const asyncExpire = promisify(client.expire).bind(client);
  return await asyncExpire(key, seconds);
};

const redisDelAsync = async (key) => {
  if (!isReady) {
    throw new Error("Redis not ready");
  }
  const asyncDel = promisify(client.del).bind(client);
  return await asyncDel(key);
};

// Simple ping function
const redisPingAsync = async (timeout = 3000) => {
  if (!isReady) {
    throw new Error("Redis not ready");
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Ping timeout"));
    }, timeout);

    client.ping((err, result) => {
      clearTimeout(timeoutId);
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

// Simple utility functions
const redisUtils = {
  isAvailable: () => isConnected && isReady,

  getStatus: () => ({
    connected: isConnected,
    ready: isReady,
    attempts: connectionAttempts,
    lastError: lastError?.message || null,
    server: `${REDIS_SERVER}:${REDIS_PORT}`,
  }),

  ping: async (timeout = 3000) => {
    if (!isReady) {
      return false;
    }

    try {
      const result = await Promise.race([
        redisPingAsync(timeout),
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

// Graceful shutdown
const gracefulShutdown = () => {
  if (client && client.connected) {
    logger.info("Shutting down Redis connection...");
    client.quit((err) => {
      if (err) {
        logger.error(`Error during Redis shutdown: ${err.message}`);
      } else {
        logger.info("Redis connection closed gracefully");
      }
    });
  }
};

// Handle process termination
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("beforeExit", gracefulShutdown);

// Export everything
module.exports = client;
module.exports.redisGetAsync = redisGetAsync;
module.exports.redisSetAsync = redisSetAsync;
module.exports.redisExpireAsync = redisExpireAsync;
module.exports.redisDelAsync = redisDelAsync;
module.exports.redisPingAsync = redisPingAsync;
module.exports.redisUtils = redisUtils;
module.exports.gracefulShutdown = gracefulShutdown;
module.exports.connected = () => client.connected;
module.exports.ready = () => client.ready;
