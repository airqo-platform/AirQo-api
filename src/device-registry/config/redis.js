// config/redis.js - Redis v4 Compatible with Simple Resilience
const redis = require("redis");
const constants = require("./constants");
const { logText, logElement, logTextWithTimestamp } = require("@utils/shared");

const REDIS_URL = constants.REDIS_URL;

const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- redis-config`
);

if (!REDIS_URL) {
  logger.error(
    "REDIS_URL environment variable not set. Redis will be unavailable."
  );
}

// Connection state tracking
let isConnected = false;
let isReady = false;
let connectionAttempts = 0;
let lastError = null;

// Simple fallback cache
const fallbackCache = new Map();
const FALLBACK_CACHE_MAX_SIZE = 1000;
const FALLBACK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Key prefix for environment isolation
const KEY_PREFIX = `${constants.ENVIRONMENT || "unknown"}:`;

// Redis v4 configuration with improved retry strategy
const redisConfig = {
  url: REDIS_URL,
  socket: {
    connectTimeout: 10000, // 10 seconds
    keepAlive: 5000, // Send keep-alive packets every 5 seconds
    tls: REDIS_URL?.startsWith("rediss://") ? true : undefined,
  },
  reconnectStrategy: (retries) => {
    connectionAttempts = retries + 1;

    if (retries > 15) {
      logger.error(
        "Redis maximum retry attempts (15) reached. Stopping retries."
      );
      return new Error("Redis retry limit reached");
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(Math.pow(2, retries) * 500, 30000); // Start at 500ms, max 30s
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    logger.warn(
      `Redis retry attempt ${retries + 1}/15 in ${Math.round(delay)}ms`
    );
    return delay;
  },
  disableOfflineQueue: true,
};

// Create Redis client. If REDIS_URL is not set, create a disconnected client
// that will rely on the fallback cache.
const client = redis.createClient(REDIS_URL ? redisConfig : {});

// Event handlers
client.on("connect", () => {
  isConnected = true;
  logTextWithTimestamp(`Redis connecting...`);
});

client.on("ready", () => {
  isReady = true;
  lastError = null;
  logTextWithTimestamp("Redis connection ready");
});

client.on("error", (error) => {
  lastError = error;
  isConnected = false;
  isReady = false;

  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    logger.warn(
      `Redis connection error: ${error.code}. Check server and network.`
    );
  } else if (error.message.includes("AUTH")) {
    logger.error(
      "Redis authentication failed. Please check your password/credentials."
    );
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
  logTextWithTimestamp(`Redis reconnecting... Attempt ${connectionAttempts}`);
});

// Initialize connection only if REDIS_URL is provided
if (REDIS_URL) {
  (async () => {
    try {
      await client.connect();
      logTextWithTimestamp("Redis connection established successfully");
    } catch (error) {
      // Always use graceful degradation - never fail the application
      logger.warn(`Redis unavailable: ${error.message} - using fallback cache`);
    }
  })();
}

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
  const prefixedKey = `${KEY_PREFIX}${key}`;
  if (!client.isOpen) {
    logger.debug(`Redis not available - using fallback for GET ${prefixedKey}`);
    return getFallbackCache(prefixedKey);
  }

  try {
    const result = await client.get(prefixedKey);
    // Cache successful results for future fallback use
    if (result !== null) {
      setFallbackCache(prefixedKey, result);
    }
    return result;
  } catch (error) {
    logger.warn(
      `Redis GET failed for ${prefixedKey}: ${error.message} - using fallback`
    );
    return getFallbackCache(prefixedKey);
  }
};

const redisSetAsync = async (key, value, ttlSeconds = null) => {
  const prefixedKey = `${KEY_PREFIX}${key}`;
  // Always update fallback cache
  const ttlMs = ttlSeconds ? ttlSeconds * 1000 : FALLBACK_CACHE_TTL;
  setFallbackCache(prefixedKey, value, ttlMs);

  if (!client.isOpen) {
    logger.debug(
      `Redis not available - SET ${prefixedKey} cached in fallback only`
    );
    return "OK";
  }

  try {
    if (ttlSeconds) {
      return await client.setEx(prefixedKey, ttlSeconds, value);
    } else {
      return await client.set(prefixedKey, value);
    }
  } catch (error) {
    logger.warn(
      `Redis SET failed for ${prefixedKey}: ${error.message} - using fallback only`
    );
    return "OK"; // Data is in fallback cache
  }
};

const redisExpireAsync = async (key, seconds) => {
  const prefixedKey = `${KEY_PREFIX}${key}`;
  // Update fallback cache expiry
  const item = fallbackCache.get(prefixedKey);
  if (item) {
    item.expires = Date.now() + seconds * 1000;
  }

  if (!client.isOpen) {
    logger.debug(
      `Redis not available - EXPIRE ${prefixedKey} applied to fallback only`
    );
    return 1;
  }

  try {
    return await client.expire(prefixedKey, seconds);
  } catch (error) {
    logger.warn(`Redis EXPIRE failed for ${prefixedKey}: ${error.message}`);
    return 1;
  }
};

const redisDelAsync = async (key) => {
  const prefixedKey = `${KEY_PREFIX}${key}`;
  const hadKey = fallbackCache.has(prefixedKey);
  fallbackCache.delete(prefixedKey);

  if (!client.isOpen) {
    logger.debug(
      `Redis not available - DEL ${prefixedKey} removed from fallback only`
    );
    return hadKey ? 1 : 0;
  }

  try {
    return await client.del(prefixedKey);
  } catch (error) {
    logger.warn(`Redis DEL failed for ${prefixedKey}: ${error.message}`);
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
    lastError: lastError ? lastError.message : null,
    server: REDIS_URL ? new URL(REDIS_URL).host : "Not configured",
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
