// src/auth-service/config/redis.js - Redis v4 with Simple Function Exports
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

// Simple Redis v4 wrapper functions (replacing the old promisify approach)
const redisGetAsync = async (key) => {
  if (!redis.isOpen) {
    console.warn(`Redis not available for GET ${key}`);
    return null;
  }
  try {
    return await redis.get(key);
  } catch (error) {
    console.error(`Redis GET failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisSetAsync = async (key, value, ttlSeconds = null) => {
  if (!redis.isOpen) {
    console.warn(`Redis not available for SET ${key}`);
    return null;
  }
  try {
    if (ttlSeconds) {
      return await redis.setEx(key, ttlSeconds, value);
    } else {
      return await redis.set(key, value);
    }
  } catch (error) {
    console.error(`Redis SET failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisExpireAsync = async (key, seconds) => {
  if (!redis.isOpen) {
    console.warn(`Redis not available for EXPIRE ${key}`);
    return 0;
  }
  try {
    return await redis.expire(key, seconds);
  } catch (error) {
    console.error(`Redis EXPIRE failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisDelAsync = async (key) => {
  if (!redis.isOpen) {
    console.warn(`Redis not available for DEL ${key}`);
    return 0;
  }
  try {
    return await redis.del(key);
  } catch (error) {
    console.error(`Redis DEL failed for ${key}: ${error.message}`);
    throw error;
  }
};

// Additional functions for mobile user cache (replacing ioredis usage)
const redisSetWithTTLAsync = async (key, value, ttlSeconds) => {
  if (!redis.isOpen) {
    console.warn(`Redis not available for SETEX ${key}`);
    return null;
  }
  try {
    // Use setEx for setting value with TTL in one command
    return await redis.setEx(key, ttlSeconds, value);
  } catch (error) {
    console.error(`Redis SETEX failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisSetNXAsync = async (key, value, ttlSeconds) => {
  if (!redis.isOpen) {
    console.warn(`Redis not available for SETNX ${key}`);
    throw new Error("Redis not available for distributed lock");
  }
  if (!ttlSeconds || ttlSeconds <= 0) {
    throw new Error(`Invalid TTL for lock: ${ttlSeconds}`);
  }
  try {
    // 'EX' sets the expiration in seconds, 'NX' sets the key only if it does not already exist.
    const result = await redis.set(key, value, {
      EX: ttlSeconds,
      NX: true,
    });
    // result will be 'OK' if the key was set, or null if the key already existed.
    return result === "OK";
  } catch (error) {
    console.error(`Redis SETNX failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisPingAsync = async (timeout = 3000) => {
  if (!redis.isOpen) {
    throw new Error("Redis not available");
  }
  try {
    return await Promise.race([
      redis.ping(),
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
  isAvailable: () => redis.isOpen && redis.isReady,

  getStatus: () => ({
    connected: redis.isOpen,
    ready: redis.isReady,
    server: `${REDIS_SERVER}:${REDIS_PORT}`,
  }),

  ping: async (timeout = 3000) => {
    if (!redis.isOpen) {
      return false;
    }
    try {
      const result = await Promise.race([
        redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Ping timeout")), timeout)
        ),
      ]);
      return result === "PONG";
    } catch (error) {
      console.warn(`Redis ping failed: ${error.message}`);
      return false;
    }
  },
};

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("Gracefully shutting down Redis connection...");
  try {
    if (redis.isOpen) {
      await redis.disconnect();
      console.log("Redis disconnected");
    }
  } catch (error) {
    console.error("Error during Redis disconnect:", error.message);
  }
});

// Export everything needed
module.exports = redis;
module.exports.redisGetAsync = redisGetAsync;
module.exports.redisSetAsync = redisSetAsync;
module.exports.redisExpireAsync = redisExpireAsync;
module.exports.redisDelAsync = redisDelAsync;
module.exports.redisPingAsync = redisPingAsync;
module.exports.redisUtils = redisUtils;
module.exports.redisSetWithTTLAsync = redisSetWithTTLAsync;
module.exports.redisSetNXAsync = redisSetNXAsync;

// Compatibility exports for direct redis.method() usage
module.exports.set = async (key, value, ttlType, ttlValue) => {
  // Compatible with ioredis.set(key, value, 'EX', seconds) pattern
  if (!redis.isOpen) {
    console.warn(`Redis not available for SET ${key}`);
    return null;
  }
  try {
    if (ttlType === "EX" && typeof ttlValue === "number") {
      return await redis.setEx(key, ttlValue, value);
    }
    return await redis.set(key, value);
  } catch (error) {
    console.error(
      `Redis SET compatibility failed for ${key}: ${error.message}`
    );
    throw error;
  }
};
module.exports.get = redisGetAsync;
module.exports.del = redisDelAsync;
