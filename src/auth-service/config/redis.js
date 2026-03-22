// src/auth-service/config/redis.js - Redis v5 with Simple Function Exports
const { createClient } = require("redis");
const constants = require("./constants");

const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;

console.log(`Redis connecting to: ${REDIS_SERVER}:${REDIS_PORT}`);

// Redis v5 configuration
const redis = createClient({
  url: `redis://${REDIS_SERVER}:${REDIS_PORT}`,
  // ── RESP protocol version ─────────────────────────────────────────────
  // redis@5 defaults to RESP3 which changes the return types of certain
  // commands (e.g. HGETALL returns a Map instead of a plain object).
  // Setting RESP: 2 keeps the same return types as redis@4, ensuring
  // backward compatibility across all existing callers in the codebase.
  RESP: 2,
  socket: {
    connectTimeout: 10000, // 10 seconds
    // ── Reconnect strategy ────────────────────────────────────────────────
    // Previously stopped after 3 retries, which caused permanent connection
    // loss when Redis restarted (e.g. K8s pod eviction/upgrade). Replaced
    // with exponential back-off capped at 30 s. The strategy never returns
    // an Error, so the client keeps retrying indefinitely — matching the
    // expectation that Redis is always available in the cluster.
    reconnectStrategy: (retries) => {
      const delay = Math.min(Math.pow(2, retries) * 100, 30000); // 100ms, 200ms, 400ms … 30s
      console.warn(
        `[redis] reconnect attempt ${retries + 1}, waiting ${delay}ms`
      );
      return delay;
    },
  },
  // ── Offline queue ────────────────────────────────────────────────────────
  // Keeping the offline queue enabled (default) so that commands issued
  // while Redis is momentarily reconnecting are queued and replayed once
  // the connection is restored. Previously this was disabled, causing every
  // session read / cache write to throw immediately during any Redis blip —
  // the root cause of the intermittent application-level connection errors
  // reported in production.
  //
  // The rate-limiter uses its own isRedisAvailable() guard and falls back to
  // in-memory mode, so it is unaffected by this change.
  // disableOfflineQueue is intentionally NOT set (defaults to false).
});

// Event handlers for Redis v4
redis.on("connect", () => {
  console.log(`[redis] connected to ${REDIS_SERVER}:${REDIS_PORT}`);
});

redis.on("ready", () => {
  console.log("[redis] connection ready");
});

redis.on("error", (error) => {
  if (error.code === "ECONNREFUSED") {
    console.warn(
      `[redis] connection refused — is Redis running on ${REDIS_SERVER}:${REDIS_PORT}?`
    );
  } else if (error.code === "ETIMEDOUT") {
    console.warn(`[redis] connection timeout to ${REDIS_SERVER}:${REDIS_PORT}`);
  } else if (error.code === "ENOTFOUND") {
    console.error(`[redis] host not found: ${REDIS_SERVER}`);
  } else {
    console.error(`[redis] error: ${error.message}`, {
      code: error.code,
      stack: error.stack?.substring(0, 500),
    });
  }
});

redis.on("end", () => {
  console.log("[redis] connection ended");
});

redis.on("reconnecting", () => {
  console.log("[redis] reconnecting…");
});

// Initialize connection
(async () => {
  try {
    await redis.connect();
    console.log("[redis] client connected successfully");
  } catch (error) {
    // Log but do not crash — the reconnect strategy will keep retrying.
    console.error("[redis] initial connection failed:", error.message);
  }
})();

// ── Graceful shutdown ─────────────────────────────────────────────────────
// Handle both SIGTERM (K8s pod termination) and SIGINT (Ctrl-C / local dev).
const disconnectRedis = async (signal) => {
  console.log(`[redis] graceful shutdown on ${signal}…`);
  try {
    if (redis.isOpen) {
      await redis.disconnect();
      console.log("[redis] disconnected");
    }
  } catch (error) {
    console.error("[redis] error during disconnect:", error.message);
  }
};

process.on("SIGTERM", () => disconnectRedis("SIGTERM"));
process.on("SIGINT", () => disconnectRedis("SIGINT"));

// ── Wrapper functions ─────────────────────────────────────────────────────
// All wrappers guard against !redis.isOpen so callers get null / 0 / false
// rather than throwing when Redis is momentarily unavailable.

const redisGetAsync = async (key) => {
  if (!redis.isOpen) {
    console.warn(`[redis] not available for GET ${key}`);
    return null;
  }
  try {
    return await redis.get(key);
  } catch (error) {
    console.error(`[redis] GET failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisSetAsync = async (key, value, ttlSeconds = null) => {
  if (!redis.isOpen) {
    console.warn(`[redis] not available for SET ${key}`);
    return null;
  }
  try {
    if (ttlSeconds) {
      return await redis.setEx(key, ttlSeconds, value);
    } else {
      return await redis.set(key, value);
    }
  } catch (error) {
    console.error(`[redis] SET failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisExpireAsync = async (key, seconds) => {
  if (!redis.isOpen) {
    console.warn(`[redis] not available for EXPIRE ${key}`);
    return 0;
  }
  try {
    return await redis.expire(key, seconds);
  } catch (error) {
    console.error(`[redis] EXPIRE failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisDelAsync = async (key) => {
  if (!redis.isOpen) {
    console.warn(`[redis] not available for DEL ${key}`);
    return 0;
  }
  try {
    return await redis.del(key);
  } catch (error) {
    console.error(`[redis] DEL failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisSetWithTTLAsync = async (key, value, ttlSeconds) => {
  if (!redis.isOpen) {
    console.warn(`[redis] not available for SETEX ${key}`);
    return null;
  }
  try {
    return await redis.setEx(key, ttlSeconds, value);
  } catch (error) {
    console.error(`[redis] SETEX failed for ${key}: ${error.message}`);
    throw error;
  }
};

const redisSetNXAsync = async (key, value, ttlSeconds) => {
  if (!redis.isOpen) {
    console.warn(`[redis] not available for SETNX ${key}`);
    throw new Error("Redis not available for distributed lock");
  }
  if (!ttlSeconds || ttlSeconds <= 0) {
    throw new Error(`Invalid TTL for lock: ${ttlSeconds}`);
  }
  try {
    const result = await redis.set(key, value, {
      EX: ttlSeconds,
      NX: true,
    });
    return result === "OK";
  } catch (error) {
    console.error(`[redis] SETNX failed for ${key}: ${error.message}`);
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

// ── Utility helpers ───────────────────────────────────────────────────────

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
      console.warn(`[redis] ping failed: ${error.message}`);
      return false;
    }
  },
};

const redisWrapper = {
  redisGetAsync,
  redisSetAsync,
  redisExpireAsync,
  redisDelAsync,
  redisPingAsync,
  redisUtils,
  redisSetWithTTLAsync,
  redisSetNXAsync,
  get: redisGetAsync,
  del: redisDelAsync,
};

// Compatibility export for ioredis.set(key, value, 'EX', seconds) callers
redisWrapper.set = async (key, value, ttlType, ttlValue) => {
  if (!redis.isOpen) {
    console.warn(`[redis] not available for SET ${key}`);
    return null;
  }
  try {
    if (ttlType === "EX" && typeof ttlValue === "number") {
      return await redis.setEx(key, ttlValue, value);
    }
    return await redis.set(key, value);
  } catch (error) {
    console.error(`[redis] SET compatibility failed for ${key}: ${error.message}`);
    throw error;
  }
};

module.exports = redisWrapper;
module.exports.redis = redis; // Raw client — used by connect-redis and rbac cache
