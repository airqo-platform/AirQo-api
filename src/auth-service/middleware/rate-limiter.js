//src/auth-service/middleware/rate-limiter.js
// middleware/rate-limiter.js - Modern Redis v4 Compatible with rate-limit-redis
const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis"); // Named import
const redis = require("@config/redis");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- rate-limiter`);

// Cache for limiters to avoid recreating them constantly
const limiterCache = new Map();

// Enhanced Redis availability check
const isRedisAvailable = () => {
  try {
    return redis && redis.isOpen && redis.isReady;
  } catch (error) {
    logger.warn(`Redis availability check failed: ${error.message}`);
    return false;
  }
};

// Test Redis connectivity with timeout
const testRedisConnectivity = async (timeoutMs = 3000) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const pingPromise = redis.ping();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis ping timeout")), timeoutMs)
    );

    const result = await Promise.race([pingPromise, timeoutPromise]);
    return result === "PONG";
  } catch (error) {
    logger.warn(`Redis connectivity test failed: ${error.message}`);
    return false;
  }
};

// Create Redis store with modern rate-limit-redis
const createRedisStore = (options) => {
  try {
    return new RedisStore({
      // Function to send commands to Redis
      sendCommand: (...args) => redis.sendCommand(args),

      // Key prefix for this store
      prefix: options.prefix || "rl:",

      // Whether to reset the expiry for a key whenever its hit count changes
      resetExpiryOnChange: true,
    });
  } catch (error) {
    logger.error(`Failed to create RedisStore: ${error.message}`);
    throw error;
  }
};

// Create rate limiter configuration
const createLimiterConfig = (options, useRedis = false) => {
  const config = {
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: options.message,
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: Math.ceil(options.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,

    // Custom key generator for more granular control
    keyGenerator: (req) => {
      const forwarded = req.headers["x-forwarded-for"];
      const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip;
      const userAgent = req.headers["user-agent"] || "unknown";

      // Create a compound key for better rate limiting
      return `${ip}:${userAgent.slice(0, 50)}`;
    },

    // Custom handler for when limit is exceeded
    handler: (req, res) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);

      logger.warn(`Rate limit exceeded for ${req.ip} on ${options.prefix}`, {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        path: req.path,
        method: req.method,
      });

      res.status(429).json({
        error: options.message,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: retryAfter,
        limit: options.max,
        windowMs: options.windowMs,
      });
    },

    // Skip function for certain conditions
    skip: (req) => {
      // Skip rate limiting for health checks
      if (req.path === "/health" || req.path === "/ping") {
        return true;
      }

      // Skip for whitelisted IPs (if configured)
      const whitelistedIPs = constants.RATE_LIMIT_WHITELIST || [];
      if (whitelistedIPs.includes(req.ip)) {
        return true;
      }

      return false;
    },
  };

  // Add Redis store if available
  if (useRedis) {
    try {
      config.store = createRedisStore({
        prefix: `rl:${options.prefix}:`,
        keyGenerator: config.keyGenerator,
      });

      logger.debug(`Redis store configured for ${options.prefix}`);
    } catch (error) {
      logger.warn(
        `Failed to configure Redis store for ${options.prefix}: ${error.message}`
      );
      // Will fall back to memory store
    }
  }

  return config;
};

// Create a dynamic limiter that checks Redis at runtime
const createDynamicLimiter = (options) => {
  const cacheKey = `${options.prefix}_${options.windowMs}_${options.max}`;

  return async (req, res, next) => {
    try {
      // Test Redis connectivity at runtime
      const redisConnected = await testRedisConnectivity(2000);
      const useRedis = redisConnected && isRedisAvailable();

      const limiterKey = useRedis ? `redis_${cacheKey}` : `memory_${cacheKey}`;

      // Create or get cached limiter
      if (!limiterCache.has(limiterKey)) {
        const config = createLimiterConfig(options, useRedis);
        const limiter = rateLimit(config);

        limiterCache.set(limiterKey, limiter);

        if (useRedis) {
          logger.debug(
            `Created Redis-backed rate limiter for ${options.prefix}`
          );
        } else {
          logger.warn(
            `⚠️ Redis not available. Created memory-backed rate limiter for ${options.prefix}`
          );
        }
      }

      const limiter = limiterCache.get(limiterKey);
      return limiter(req, res, next);
    } catch (error) {
      // Critical error handling - always fallback to memory store
      logger.error(
        `Rate limiter critical error for ${options.prefix}: ${error.message}`
      );

      const fallbackKey = `fallback_${cacheKey}`;

      if (!limiterCache.has(fallbackKey)) {
        const fallbackConfig = createLimiterConfig(options, false);
        const fallbackLimiter = rateLimit(fallbackConfig);

        limiterCache.set(fallbackKey, fallbackLimiter);
        logger.info(`Created fallback memory limiter for ${options.prefix}`);
      }

      return limiterCache.get(fallbackKey)(req, res, next);
    }
  };
};

// Environment-based bypassing
const shouldBypassRateLimiting = () => {
  return (
    constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT" &&
    constants.BYPASS_RATE_LIMIT === true
  );
};

// Conditional rate limiter wrapper
const conditionalRateLimiter = (limiter) => {
  return (req, res, next) => {
    if (shouldBypassRateLimiting()) {
      logger.info(
        `Rate limiting bypassed for ${req.path} in ${constants.ENVIRONMENT} environment`
      );
      return next();
    }
    return limiter(req, res, next);
  };
};

// Define rate limiters with enhanced configurations
const brandedLoginLimiter = createDynamicLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  prefix: "branded_login",
  message:
    "Too many login attempts from this IP. Please try again in 15 minutes.",
});

const registrationLimiter = createDynamicLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  prefix: "registration",
  message:
    "Too many registration attempts from this IP. Please try again in 1 hour.",
});

const loginLimiter = createDynamicLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  prefix: "login_attempts",
  message:
    "Too many login attempts from this IP. Please try again in 15 minutes.",
});

// Additional specialized limiters
const passwordResetLimiter = createDynamicLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset requests per hour
  prefix: "password_reset",
  message: "Too many password reset requests. Please try again in 1 hour.",
});

const apiLimiter = createDynamicLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 API requests per window
  prefix: "api_general",
  message: "API rate limit exceeded. Please slow down your requests.",
});

// Enhanced monitoring and debugging utilities
const getRateLimiterStats = async () => {
  const redisAvailable = isRedisAvailable();
  let redisConnectivity = false;

  if (redisAvailable) {
    redisConnectivity = await testRedisConnectivity();
  }

  return {
    redis: {
      available: redisAvailable,
      connected: redisConnectivity,
      client: {
        isOpen: redis?.isOpen || false,
        isReady: redis?.isReady || false,
      },
    },
    cache: {
      size: limiterCache.size,
      keys: Array.from(limiterCache.keys()),
      types: {
        redis: Array.from(limiterCache.keys()).filter((k) =>
          k.startsWith("redis_")
        ).length,
        memory: Array.from(limiterCache.keys()).filter((k) =>
          k.startsWith("memory_")
        ).length,
        fallback: Array.from(limiterCache.keys()).filter((k) =>
          k.startsWith("fallback_")
        ).length,
      },
    },
    environment: {
      current: constants.ENVIRONMENT,
      bypassEnabled: shouldBypassRateLimiting(),
    },
  };
};

const clearLimiterCache = () => {
  const stats = {
    previousSize: limiterCache.size,
    clearedKeys: Array.from(limiterCache.keys()),
  };

  limiterCache.clear();

  logger.info(`Rate limiter cache cleared`, stats);

  return {
    success: true,
    message: `Cleared ${stats.previousSize} cached limiters`,
    details: stats,
  };
};

// Health check for rate limiter system
const healthCheck = async () => {
  try {
    const stats = await getRateLimiterStats();

    return {
      status: "healthy",
      redis: stats.redis.connected ? "connected" : "disconnected",
      fallbackReady: true,
      cacheSize: stats.cache.size,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`Rate limiter health check failed: ${error.message}`);

    return {
      status: "degraded",
      redis: "error",
      fallbackReady: true,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  logger.info("Shutting down rate limiter...");

  try {
    // Clear cache
    clearLimiterCache();

    // Close Redis connections if needed
    if (redis && redis.isOpen) {
      logger.info(
        "Rate limiter cache cleared, Redis connection managed externally"
      );
    }

    return { success: true };
  } catch (error) {
    logger.error(`Error during rate limiter shutdown: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Export all limiters and utilities
module.exports = {
  // Main rate limiters
  login: conditionalRateLimiter(loginLimiter),
  brandedLogin: conditionalRateLimiter(brandedLoginLimiter),
  registration: conditionalRateLimiter(registrationLimiter),
  passwordReset: conditionalRateLimiter(passwordResetLimiter),
  apiGeneral: conditionalRateLimiter(apiLimiter),

  // Utility functions
  getRateLimiterStats,
  clearLimiterCache,
  healthCheck,
  gracefulShutdown,
  isRedisAvailable,
  testRedisConnectivity,

  // Advanced utilities
  createDynamicLimiter,
  conditionalRateLimiter,

  // For testing purposes
  __internal: {
    limiterCache,
    createLimiterConfig,
    createRedisStore,
  },
};
