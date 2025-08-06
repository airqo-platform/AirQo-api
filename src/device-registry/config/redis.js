// config/redis.js - Redis v4 Compatible with Simple Resilience
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

// Simple fallback cache
const fallbackCache = new Map();
const FALLBACK_CACHE_MAX_SIZE = 1000;
const FALLBACK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Redis v4 configuration with improved retry strategy
const redisConfig = {
  socket: {
    host: REDIS_SERVER,
    port: REDIS_PORT,
    connectTimeout: 10000,
    commandTimeout: 5000,
    keepAlive: true,
    reconnectStrategy: (retries) => {
      connectionAttempts = retries + 1;

      // Increased retry limit (addressing PR review #1)
      if (retries > 10) {
        logger.error("Redis maximum retry attempts (10) reached");
        return false;
      }

      // Exponential backoff with jitter (addressing PR review #1)
      const baseDelay = Math.min(Math.pow(2, retries) * 1000, 30000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      logger.warn(
        `Redis retry attempt ${retries + 1}/10 in ${Math.round(delay)}ms`
      );
      return delay;
    },
  },
  disableOfflineQueue: true,
};

// Create Redis client
const client = redis.createClient(redisConfig);

// Event handlers
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
  logger.info(`Redis reconnecting... Attempt ${connectionAttempts}`);
});

// Initialize connection with graceful handling (addressing PR review #2)
(async () => {
  try {
    await client.connect();
    logger.info("Redis connection established successfully");
  } catch (error) {
    // Always use graceful degradation - never fail the application
    logger.warn(`Redis unavailable: ${error.message} - using fallback cache`);
  }
})();

// Simple fallback cache functions
const setFallbackCache = (key, value, ttl = FALLBACK_CACHE_TTL) => {
  if (fallbackCache.size >= FALLBACK_CACHE_MAX_SIZE) {
    const firstKey = fallbackCache.keys().next().value;
    fallbackCache.delete(firstKey);
  }

  fallbackCache.set(key, {
    value,
    expires: Date.now() + ttl,
  });
};

const getFallbackCache = (key) => {
  const item = fallbackCache.get(key);
  if (!item || Date.now() > item.expires) {
    fallbackCache.delete(key);
    return null;
  }
  return item.value;
};

// Redis operations with simple fallback
const redisGetAsync = async (key) => {
  if (!client.isOpen) {
    logger.debug(`Redis not available - using fallback for GET ${key}`);
    return getFallbackCache(key);
  }

  try {
    const result = await client.get(key);
    // Cache successful results for future fallback use
    if (result !== null) {
      setFallbackCache(key, result);
    }
    return result;
  } catch (error) {
    logger.warn(
      `Redis GET failed for ${key}: ${error.message} - using fallback`
    );
    return getFallbackCache(key);
  }
};

const redisSetAsync = async (key, value, ttlSeconds = null) => {
  // Always update fallback cache
  const ttlMs = ttlSeconds ? ttlSeconds * 1000 : FALLBACK_CACHE_TTL;
  setFallbackCache(key, value, ttlMs);

  if (!client.isOpen) {
    logger.debug(`Redis not available - SET ${key} cached in fallback only`);
    return "OK";
  }

  try {
    if (ttlSeconds) {
      return await client.setEx(key, ttlSeconds, value);
    } else {
      return await client.set(key, value);
    }
  } catch (error) {
    logger.warn(
      `Redis SET failed for ${key}: ${error.message} - using fallback only`
    );
    return "OK"; // Data is in fallback cache
  }
};

const redisExpireAsync = async (key, seconds) => {
  // Update fallback cache expiry
  const item = fallbackCache.get(key);
  if (item) {
    item.expires = Date.now() + seconds * 1000;
  }

  if (!client.isOpen) {
    logger.debug(
      `Redis not available - EXPIRE ${key} applied to fallback only`
    );
    return 1;
  }

  try {
    return await client.expire(key, seconds);
  } catch (error) {
    logger.warn(`Redis EXPIRE failed for ${key}: ${error.message}`);
    return 1;
  }
};

const redisDelAsync = async (key) => {
  const hadKey = fallbackCache.has(key);
  fallbackCache.delete(key);

  if (!client.isOpen) {
    logger.debug(`Redis not available - DEL ${key} removed from fallback only`);
    return hadKey ? 1 : 0;
  }

  try {
    return await client.del(key);
  } catch (error) {
    logger.warn(`Redis DEL failed for ${key}: ${error.message}`);
    return hadKey ? 1 : 0;
  }
};

const redisPingAsync = async (timeout = 3000) => {
  if (!client.isOpen) {
    throw new Error("Redis not available");
  }

  try {
    return await Promise.race([
      client.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Ping timeout")), timeout)
      ),
    ]);
  } catch (error) {
    throw error;
  }
};

// Simple utility functions
const redisUtils = {
  isAvailable: () => client.isOpen && client.isReady,

  getStatus: () => ({
    connected: isConnected,
    ready: isReady,
    isOpen: client.isOpen,
    attempts: connectionAttempts,
    lastError: lastError?.message || null,
    server: `${REDIS_SERVER}:${REDIS_PORT}`,
    fallbackCacheSize: fallbackCache.size,
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

  clearFallbackCache: () => {
    const size = fallbackCache.size;
    fallbackCache.clear();
    logger.info(`Fallback cache cleared (${size} items removed)`);
  },
};

// Graceful shutdown
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

// Export everything
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
