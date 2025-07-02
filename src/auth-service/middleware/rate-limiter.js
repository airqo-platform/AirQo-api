// middleware/rate-limiter.js
const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const redis = require("@config/redis");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- rate-limiter`);

// Cache for limiters to avoid recreating them constantly
const limiterCache = new Map();

// Simple function to check if Redis is available
const isRedisAvailable = () => {
  try {
    return redis && redis.connected && redis.ready;
  } catch (error) {
    return false;
  }
};

// Create a dynamic limiter that checks Redis at runtime
const createDynamicLimiter = (options) => {
  const cacheKey = `${options.prefix}_${options.windowMs}_${options.max}`;

  return (req, res, next) => {
    try {
      // Check Redis availability at runtime using built-in properties
      const useRedis = isRedisAvailable();

      if (useRedis) {
        // Use Redis store
        const redisKey = `redis_${cacheKey}`;

        if (!limiterCache.has(redisKey)) {
          const redisLimiter = rateLimit({
            store: new RedisStore({
              client: redis,
              prefix: `rate_limit:${options.prefix}:`,
            }),
            standardHeaders: true,
            legacyHeaders: false,
            skipFailedRequests: false,
            windowMs: options.windowMs,
            max: options.max,
            message: options.message,
          });

          limiterCache.set(redisKey, redisLimiter);
        }

        return limiterCache.get(redisKey)(req, res, next);
      } else {
        // Use memory store fallback
        logger.warn(
          `⚠️ Redis not connected. Using memory store for rate limiting (${options.prefix})`
        );

        const memoryKey = `memory_${cacheKey}`;

        if (!limiterCache.has(memoryKey)) {
          const memoryLimiter = rateLimit({
            windowMs: options.windowMs,
            max: options.max,
            message: options.message,
            standardHeaders: true,
            legacyHeaders: false,
            skipFailedRequests: false,
          });

          limiterCache.set(memoryKey, memoryLimiter);
        }

        return limiterCache.get(memoryKey)(req, res, next);
      }
    } catch (error) {
      // Log error and fallback to memory store
      logger.error(
        `Rate limiter error: ${error.message}. Using memory store fallback.`
      );

      const fallbackKey = `fallback_${cacheKey}`;

      if (!limiterCache.has(fallbackKey)) {
        const fallbackLimiter = rateLimit({
          windowMs: options.windowMs,
          max: options.max,
          message: options.message,
          standardHeaders: true,
          legacyHeaders: false,
        });

        limiterCache.set(fallbackKey, fallbackLimiter);
      }

      return limiterCache.get(fallbackKey)(req, res, next);
    }
  };
};

// Option to bypass rate limiting in development environments
const shouldBypassRateLimiting = () => {
  return (
    constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT" &&
    constants.BYPASS_RATE_LIMIT === true
  );
};

// Create a middleware that either applies rate limiting or skips it
const conditionalRateLimiter = (limiter) => {
  return (req, res, next) => {
    if (shouldBypassRateLimiting()) {
      logger.info("Rate limiting bypassed in non-production environment");
      return next();
    }
    return limiter(req, res, next);
  };
};

// Create the actual limiters - now they check Redis at runtime
const brandedLoginLimiter = createDynamicLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  prefix: "branded_login",
  message: "Too many login attempts, please try again later",
});

const registrationLimiter = createDynamicLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  prefix: "registration",
  message: "Too many registration attempts, please try again later",
});

module.exports = {
  brandedLogin: conditionalRateLimiter(brandedLoginLimiter),
  registration: conditionalRateLimiter(registrationLimiter),
};
