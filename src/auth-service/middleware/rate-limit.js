// middleware/redis-rate-limiter.js

const httpStatus = require("http-status");
const AccessTokenModel = require("@models/AccessToken");
const ClientModel = require("@models/Client");
const UserModel = require("@models/User");
const redis = require("@config/redis");
const { logObject, logText, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- redis-rate-limiter`
);
const isEmpty = require("is-empty");

/**
 * Get rate limit details for a user based on their subscription tier
 * @param {string} tier - The subscription tier (Free, Standard, Premium)
 * @returns {Object} The rate limits
 */
const getRateLimits = (tier = "Free") => {
  // Default rate limits by tier
  const defaultLimits = {
    Free: {
      hourly: 100,
      daily: 1000,
      monthly: 10000,
    },
    Standard: {
      hourly: 1000,
      daily: 10000,
      monthly: 100000,
    },
    Premium: {
      hourly: 5000,
      daily: 50000,
      monthly: 500000,
    },
  };

  // Return tier-based limits
  return defaultLimits[tier] || defaultLimits.Free;
};

/**
 * Redis-based rate limiter middleware
 */
const redisRateLimiter = async (req, res, next) => {
  try {
    const token = req.query.token || req.headers.token || req.params.token;

    if (!token) {
      return next();
    }

    // Find the token
    const accessToken = await AccessTokenModel("airqo")
      .findOne({ token })
      .select("client_id token tier");

    if (!accessToken) {
      return next();
    }

    // Get the client and user
    const client = await ClientModel("airqo")
      .findById(accessToken.client_id)
      .select("user_id rateLimit isActive");

    if (!client || !client.isActive) {
      return next();
    }

    const user = await UserModel("airqo")
      .findById(client.user_id)
      .select("subscriptionTier subscriptionStatus");

    if (!user || user.subscriptionStatus !== "active") {
      return next();
    }

    // Get applicable tier and rate limit
    const tier = accessToken.tier || user.subscriptionTier || "Free";
    const limits = getRateLimits(tier);

    // Generate Redis keys for this user/token
    const userId = client.user_id.toString();
    const hourlyKey = `rate:${userId}:hourly`;
    const dailyKey = `rate:${userId}:daily`;
    const monthlyKey = `rate:${userId}:monthly`;

    // Check if Redis is connected
    if (!redis.status || redis.status !== "ready") {
      logger.warn("Redis not available, skipping rate limiting");
      return next();
    }

    try {
      // Use Redis pipeline for better performance
      const pipeline = redis.pipeline();

      // Increment counters and check TTL
      pipeline.incr(hourlyKey);
      pipeline.ttl(hourlyKey);
      pipeline.incr(dailyKey);
      pipeline.ttl(dailyKey);
      pipeline.incr(monthlyKey);
      pipeline.ttl(monthlyKey);

      const results = await pipeline.exec();

      // Extract results (handling potential Redis errors)
      const hourlyCount = results[0][1];
      const hourlyTtl = results[1][1];
      const dailyCount = results[2][1];
      const dailyTtl = results[3][1];
      const monthlyCount = results[4][1];
      const monthlyTtl = results[5][1];

      // Set expiration if not already set
      const pipeline2 = redis.pipeline();

      if (hourlyTtl < 0) {
        pipeline2.expire(hourlyKey, 3600); // 1 hour
      }

      if (dailyTtl < 0) {
        pipeline2.expire(dailyKey, 86400); // 24 hours
      }

      if (monthlyTtl < 0) {
        pipeline2.expire(monthlyKey, 2592000); // 30 days
      }

      await pipeline2.exec();

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit-Hourly", limits.hourly);
      res.setHeader(
        "X-RateLimit-Remaining-Hourly",
        Math.max(0, limits.hourly - hourlyCount)
      );

      res.setHeader("X-RateLimit-Limit-Daily", limits.daily);
      res.setHeader(
        "X-RateLimit-Remaining-Daily",
        Math.max(0, limits.daily - dailyCount)
      );

      // Check if any limit is exceeded
      if (hourlyCount > limits.hourly) {
        logger.warn(
          `Hourly rate limit exceeded for user ${userId}, tier ${tier}`
        );
        return res.status(httpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          message: "Rate limit exceeded. Please try again later.",
          status: httpStatus.TOO_MANY_REQUESTS,
          errors: {
            message: "Hourly rate limit exceeded",
            limit: limits.hourly,
            current: hourlyCount,
            reset: "Please try again in less than an hour",
          },
        });
      }

      if (dailyCount > limits.daily) {
        logger.warn(
          `Daily rate limit exceeded for user ${userId}, tier ${tier}`
        );
        return res.status(httpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          message: "Rate limit exceeded. Please try again later.",
          status: httpStatus.TOO_MANY_REQUESTS,
          errors: {
            message: "Daily rate limit exceeded",
            limit: limits.daily,
            current: dailyCount,
            reset: "Please try again tomorrow",
          },
        });
      }

      if (monthlyCount > limits.monthly) {
        logger.warn(
          `Monthly rate limit exceeded for user ${userId}, tier ${tier}`
        );
        return res.status(httpStatus.PAYMENT_REQUIRED).json({
          success: false,
          message:
            "You have exceeded your monthly API quota. Please upgrade your subscription.",
          status: httpStatus.PAYMENT_REQUIRED,
          errors: {
            message: "Monthly API quota exceeded",
          },
        });
      }

      // Track this API call asynchronously
      Promise.resolve().then(async () => {
        try {
          // Update last used timestamp for the token
          await AccessTokenModel("airqo").findOneAndUpdate(
            { token },
            {
              last_used_at: new Date(),
              last_ip_address:
                req.ip ||
                req.headers["x-client-ip"] ||
                req.headers["x-client-original-ip"],
            }
          );
        } catch (error) {
          logger.error(`Error tracking API usage: ${error.message}`);
        }
      });

      next();
    } catch (redisError) {
      // Redis errors should not block API access
      logger.error(`Redis error: ${redisError.message}`);
      next();
    }
  } catch (error) {
    logger.error(`Rate limiter error: ${error.message}`);
    next();
  }
};

/**
 * Fallback memory-based rate limiter in case Redis is unavailable
 * Uses the same API and structure as the Redis version
 */
const memoryRateCache = new Map();

const memoryRateLimiter = async (req, res, next) => {
  try {
    const token = req.query.token || req.headers.token || req.params.token;

    if (!token) {
      return next();
    }

    // Find the token
    const accessToken = await AccessTokenModel("airqo")
      .findOne({ token })
      .select("client_id token tier");

    if (!accessToken) {
      return next();
    }

    // Get the client and user
    const client = await ClientModel("airqo")
      .findById(accessToken.client_id)
      .select("user_id rateLimit isActive");

    if (!client || !client.isActive) {
      return next();
    }

    const user = await UserModel("airqo")
      .findById(client.user_id)
      .select("subscriptionTier subscriptionStatus");

    if (!user || user.subscriptionStatus !== "active") {
      return next();
    }

    // Get applicable tier and rate limit
    const tier = accessToken.tier || user.subscriptionTier || "Free";
    const limits = getRateLimits(tier);

    // Generate cache keys for this user/token
    const userId = client.user_id.toString();
    const now = Date.now();

    // Initialize or get cache entry
    if (!memoryRateCache.has(userId)) {
      memoryRateCache.set(userId, {
        hourly: {
          count: 0,
          reset: now + 3600000, // 1 hour
        },
        daily: {
          count: 0,
          reset: now + 86400000, // 24 hours
        },
        monthly: {
          count: 0,
          reset: now + 2592000000, // 30 days
        },
        expires: now + 2592000000, // Cache entry expires after 30 days
      });
    }

    const entry = memoryRateCache.get(userId);

    // Reset counters if time has elapsed
    if (entry.hourly.reset < now) {
      entry.hourly.count = 0;
      entry.hourly.reset = now + 3600000;
    }

    if (entry.daily.reset < now) {
      entry.daily.count = 0;
      entry.daily.reset = now + 86400000;
    }

    if (entry.monthly.reset < now) {
      entry.monthly.count = 0;
      entry.monthly.reset = now + 2592000000;
    }

    // Increment counters
    entry.hourly.count++;
    entry.daily.count++;
    entry.monthly.count++;

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit-Hourly", limits.hourly);
    res.setHeader(
      "X-RateLimit-Remaining-Hourly",
      Math.max(0, limits.hourly - entry.hourly.count)
    );

    res.setHeader("X-RateLimit-Limit-Daily", limits.daily);
    res.setHeader(
      "X-RateLimit-Remaining-Daily",
      Math.max(0, limits.daily - entry.daily.count)
    );

    // Check if any limit is exceeded
    if (entry.hourly.count > limits.hourly) {
      logger.warn(
        `Hourly rate limit exceeded for user ${userId}, tier ${tier}`
      );
      return res.status(httpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        message: "Rate limit exceeded. Please try again later.",
        status: httpStatus.TOO_MANY_REQUESTS,
        errors: {
          message: "Hourly rate limit exceeded",
          limit: limits.hourly,
          current: entry.hourly.count,
          reset: new Date(entry.hourly.reset).toISOString(),
        },
      });
    }

    if (entry.daily.count > limits.daily) {
      logger.warn(`Daily rate limit exceeded for user ${userId}, tier ${tier}`);
      return res.status(httpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        message: "Rate limit exceeded. Please try again later.",
        status: httpStatus.TOO_MANY_REQUESTS,
        errors: {
          message: "Daily rate limit exceeded",
          limit: limits.daily,
          current: entry.daily.count,
          reset: new Date(entry.daily.reset).toISOString(),
        },
      });
    }

    if (entry.monthly.count > limits.monthly) {
      logger.warn(
        `Monthly rate limit exceeded for user ${userId}, tier ${tier}`
      );
      return res.status(httpStatus.PAYMENT_REQUIRED).json({
        success: false,
        message:
          "You have exceeded your monthly API quota. Please upgrade your subscription.",
        status: httpStatus.PAYMENT_REQUIRED,
        errors: {
          message: "Monthly API quota exceeded",
        },
      });
    }

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      // ~1% chance to clean up on each request
      for (const [key, data] of memoryRateCache.entries()) {
        if (data.expires < now) {
          memoryRateCache.delete(key);
        }
      }
    }

    next();
  } catch (error) {
    logger.error(`Memory rate limiter error: ${error.message}`);
    next();
  }
};

/**
 * Combined rate limiter that tries Redis first, falls back to memory
 */
const rateLimiter = async (req, res, next) => {
  // Check if Redis is available
  try {
    const pingResult = await redis.ping();
    if (pingResult === "PONG") {
      return redisRateLimiter(req, res, next);
    }
  } catch (err) {
    logger.warn(
      `Redis not available, using memory rate limiting: ${err.message}`
    );
  }

  // Fallback to memory-based rate limiting
  return memoryRateLimiter(req, res, next);
};

module.exports = rateLimiter;
