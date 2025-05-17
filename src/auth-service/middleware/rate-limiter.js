// middleware/rate-limiter.js
const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const redis = require("@config/redis");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- rate-limiter`);

// Create a more robust limiter that falls back to memory store if Redis fails
const createLimiter = (options) => {
  try {
    // Check if Redis is connected
    if (redis && redis.connected) {
      return rateLimit({
        store: new RedisStore({
          client: redis,
          prefix: `rate_limit:${options.prefix}:`,
        }),
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        skipFailedRequests: false, // Don't skip failed requests
        ...options,
      });
    } else {
      // Fallback to memory store if Redis is not connected
      logger.warn(
        `Redis not connected. Using memory store for rate limiting (${options.prefix})`
      );
      return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        message: options.message,
        standardHeaders: true,
        legacyHeaders: false,
        skipFailedRequests: false,
      });
    }
  } catch (error) {
    // Log the error and fallback to memory store
    logger.error(
      `Rate limiter error: ${error.message}. Using memory store fallback.`
    );
    return rateLimit({
      windowMs: options.windowMs,
      max: options.max,
      message: options.message,
      standardHeaders: true,
      legacyHeaders: false,
    });
  }
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

// Create the actual limiters with fallback options
const brandedLoginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  prefix: "branded_login",
  message: "Too many login attempts, please try again later",
});

const registrationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  prefix: "registration",
  message: "Too many registration attempts, please try again later",
});

module.exports = {
  brandedLogin: conditionalRateLimiter(brandedLoginLimiter),
  registration: conditionalRateLimiter(registrationLimiter),
};
