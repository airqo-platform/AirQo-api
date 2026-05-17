const constants = require("@config/constants");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { logObject, logText } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- rate-limit.middleware.js`
);
const httpStatus = require("http-status");
const { TIER_RATE_LIMITS } = require("@config/tier-limits");

// Lazy-load Redis helpers so the middleware still starts when Redis is absent.
let _redisGetAsync = null;
let _redisSetAsync = null;
let _redisIncrAsync = null;
let _redisExpireAsync = null;
const _getRedis = () => {
  if (_redisGetAsync) return true;
  try {
    const redis = require("@config/redis");
    _redisGetAsync = redis.redisGetAsync;
    _redisSetAsync = redis.redisSetAsync;
    _redisIncrAsync = redis.redisIncrAsync;
    _redisExpireAsync = redis.redisExpireAsync;
    return !!(redis.redisUtils && redis.redisUtils.isAvailable());
  } catch (_) {
    return false;
  }
};

/**
 * PRODUCTION-HARDENED Rate Limiting Middleware
 *
 * Designed to NEVER break your deployment, even if:
 * - Redis is unavailable
 * - Redis connection fails mid-request
 * - rate-limit-redis package has issues
 * - Network issues occur
 *
 * Failsafe approach: If anything goes wrong, fall back gracefully
 *
 * IP Detection: Uses custom HAProxy headers (x-client-ip, x-client-original-ip)
 * matching your production token.util.js pattern - more secure than x-forwarded-for
 */

// ============================================
// CONFIGURATION
// ============================================

const USE_REDIS = (() => {
  const value = constants.USE_REDIS_RATE_LIMIT;
  if (typeof value === "boolean") return value;
  const strValue = String(value || "")
    .toLowerCase()
    .trim();
  return strValue === "true" || strValue === "1" || strValue === "yes";
})();

// Trusted IPs that should bypass rate limiting
const WHITELISTED_IPS = constants.RATE_LIMIT_WHITELIST
  ? constants.RATE_LIMIT_WHITELIST.split(",").map((ip) => ip.trim())
  : [];

// ============================================
// SAFE REDIS STORE INITIALIZATION
// ============================================

/**
 * Safely attempt to initialize Redis store
 * Returns null if anything fails - will use in-memory store
 */
const initializeRedisStore = () => {
  if (!USE_REDIS) {
    logger.info("📊 Rate Limiting: In-memory store (Redis disabled)");
    return null;
  }

  try {
    // Attempt to import Redis and RedisStore
    let RedisStore;
    let redis;

    try {
      RedisStore = require("rate-limit-redis");
    } catch (error) {
      logger.warn(
        "⚠️ rate-limit-redis package not found. Using in-memory store."
      );
      logger.warn("Install with: npm install rate-limit-redis");
      return null;
    }

    try {
      redis = require("@config/redis");
    } catch (error) {
      logger.warn("⚠️ Redis config not found. Using in-memory store.");
      return null;
    }

    // Check if Redis utilities are available
    if (!redis.redisUtils) {
      logger.warn("⚠️ Redis utilities not available. Using in-memory store.");
      return null;
    }

    // Check if Redis is actually available
    if (!redis.redisUtils.isAvailable()) {
      logger.warn(
        "⚠️ Redis not available at initialization. Using in-memory store."
      );
      return null;
    }

    // Attempt to create the store
    const store = new RedisStore({
      // @ts-expect-error - RedisStore accepts the v4 client
      sendCommand: (...args) => redis.sendCommand(args),
      prefix: "rl:",
    });

    logger.info(
      "✅ Rate Limiting: Using Redis store for distributed rate limiting"
    );
    return store;
  } catch (error) {
    logger.error(`❌ Failed to initialize Redis store: ${error.message}`);
    logger.warn("⚠️ Falling back to in-memory store");
    logObject("Redis store initialization error", error);
    return null;
  }
};

// Initialize store (null = in-memory fallback)
let rateStore = null;
try {
  rateStore = initializeRedisStore();
} catch (error) {
  logger.error(`Critical error during rate store init: ${error.message}`);
  rateStore = null; // Ensure we fall back to memory
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if an IP is whitelisted
 * Supports both exact IPs and CIDR ranges (e.g., 10.4.0.0/14)
 * Handles various IP formats and edge cases
 */
const isWhitelisted = (ip) => {
  if (!ip || ip === "unknown") return false;

  // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
  const cleanIp = ip.replace(/^::ffff:/, "");

  return WHITELISTED_IPS.some((whitelistedEntry) => {
    // Check if it's a CIDR range
    if (whitelistedEntry.includes("/")) {
      return isIpInCidr(cleanIp, whitelistedEntry);
    }

    // Exact match
    if (cleanIp === whitelistedEntry) return true;

    // Check with IPv6 prefix
    if (ip === whitelistedEntry) return true;

    return false;
  });
};

/**
 * Check if an IP is within a CIDR range
 * Supports IPv4 CIDR notation (e.g., 10.4.0.0/14)
 */
const isIpInCidr = (ip, cidr) => {
  try {
    const [range, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);

    const ipNum =
      ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>>
      0;
    const rangeNum =
      range
        .split(".")
        .reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;

    return (ipNum & mask) === (rangeNum & mask);
  } catch (error) {
    logger.error(
      `Error checking CIDR range ${cidr} for IP ${ip}: ${error.message}`
    );
    return false; // If CIDR check fails, don't whitelist
  }
};

/**
 * Extract IP from request - matches production token.util pattern
 * Uses custom headers set by HAProxy (more secure than x-forwarded-for)
 */
const extractIp = (req) => {
  // Match existing production logic from token.util.js
  const ip =
    req.headers["x-client-ip"] ||
    req.headers["x-client-original-ip"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown";

  return ip;
};

/**
 * Custom key generator that uses IP address
 */
const keyGenerator = (req) => {
  const ip = extractIp(req);
  return `rate_limit:${ip}`;
};

/**
 * Custom handler for rate limit exceeded
 * Never throws errors - always returns a response
 */
const rateLimitHandler = (req, res, message) => {
  try {
    const ip = extractIp(req);
    logger.warn(`Rate limit exceeded for IP: ${ip} on ${req.path}`);

    return res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      message:
        message || "Too many requests from this IP, please try again later.",
      errors: {
        message:
          "Rate limit exceeded. Please wait before making more requests.",
      },
    });
  } catch (error) {
    // If even the error handler fails, return basic response
    logger.error(`Error in rate limit handler: ${error.message}`);
    return res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Too many requests, please try again later.",
    });
  }
};

/**
 * Skip rate limiting for whitelisted IPs
 * Never throws errors
 */
const skipFunction = (req) => {
  try {
    const ip = extractIp(req);
    const shouldSkip = isWhitelisted(ip);

    if (shouldSkip) {
      logText(`Skipping rate limit for whitelisted IP: ${ip}`);
    }

    return shouldSkip;
  } catch (error) {
    logger.error(`Error in skip function: ${error.message}`);
    return false; // If error, don't skip (safer)
  }
};

/**
 * Error handler for rate limiter
 * If rate limiter throws error, log it but allow request through
 */
const onRateLimitError = (error, req, res, next) => {
  logger.error(`⚠️ Rate limiter error: ${error.message}`);
  logObject("Rate limiter error details", error);

  // Log but don't block the request - fail open for availability
  logger.warn(
    "Rate limiter failed - allowing request through for availability"
  );
  next();
};

// ============================================
// MIDDLEWARE FACTORIES
// ============================================

/**
 * Create a safe rate limiter with error handling
 */
const createSafeRateLimiter = (config) => {
  // Extract keyGenerator separately so callers can override the default
  // IP-based key. Placing ...config last would let callers override store,
  // skip, and handler too, which is undesirable — so we only allow
  // keyGenerator to be customised.
  // Extract message so the custom handler can surface it in the 429 body.
  const { keyGenerator: configKeyGenerator, message: configMessage, ...restConfig } = config;
  try {
    return rateLimit({
      ...restConfig,
      store: rateStore,
      skip: skipFunction,
      handler: (req, res) => rateLimitHandler(req, res, configMessage),
      keyGenerator: configKeyGenerator || keyGenerator,
      // Suppress the trust-proxy validation error — we use custom x-client-ip
      // headers via keyGenerator so req.ip trustworthiness is irrelevant here.
      validate: { trustProxy: false },
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
      requestWasSuccessful: (req, res) => res.statusCode < 400,
    });
  } catch (error) {
    logger.error(`Failed to create rate limiter: ${error.message}`);
    // Return a passthrough middleware if creation fails
    return (req, res, next) => {
      logger.warn("Rate limiter unavailable - passing through");
      next();
    };
  }
};

/**
 * Strict rate limiter for sensitive endpoints (e.g., token verification)
 * 200 requests per hour per IP
 */
const strictRateLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many token verification requests. Please try again later.",
});

/**
 * Standard rate limiter for most endpoints
 * 100 requests per hour per IP
 */
const standardRateLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Authentication rate limiter for login/signup endpoints
 * 5 attempts per 15 minutes
 */
const authRateLimiter = createSafeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts. Please try again later.",
});

/**
 * Write rate limiter for write operations
 * 50 requests per hour per IP
 */
const writeRateLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Read rate limiter for read-heavy endpoints
 * 300 requests per hour per IP
 */
const readRateLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Coarse IP-based guard for the /:token/verify endpoint.
 *
 * Applied before the per-token limiter to prevent high-cardinality bypass
 * attacks where an abuser rotates many unique (invalid) tokens from the same
 * IP, each getting its own fresh per-token bucket. 5000 req/hr per IP allows
 * a legitimate internal service running ~2-3 tokens at up to 2000 req/hr
 * each, while blocking any single IP that hammers the endpoint indiscriminately.
 */
const tokenVerifyIpRateLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many verification requests from this IP. Please try again later.",
});

/**
 * Token-keyed rate limiter for the /:token/verify endpoint.
 *
 * Keyed by the token value from req.params.token rather than IP so that:
 * - Each API client gets its own independent bucket regardless of the IP they
 *   call from (internal services sharing a cluster IP won't collide).
 * - External abuse of a single token is still capped.
 *
 * Limit: 2000 requests per hour per token — generous enough for busy
 * service-to-service callers (~33/min) but low enough to cap runaway callers.
 * Falls back to IP key if the token param is absent for any reason.
 */
const tokenVerifyRateLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many verification requests for this token. Please try again later.",
  keyGenerator: (req) => {
    const token = req.params.token;
    if (token) {
      // Hash the token so raw credentials are never stored in Redis keys or
      // visible in datastore inspection/metrics. A 16-char hex prefix of
      // SHA-256 gives 64 bits of collision resistance — sufficient for a
      // rate-limit key while keeping key size small.
      const hashed = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")
        .slice(0, 16);
      return `token_verify_rl:${hashed}`;
    }
    return `token_verify_rl:ip:${extractIp(req)}`;
  },
});

/**
 * Rate limiter for query-token-only endpoints (10 req/min per IP).
 * These endpoints intentionally block JWT — see specificRoutes in passport.js.
 */
const queryTokenRateLimiter = createSafeRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Too many requests. Query-token endpoints are limited to 10 requests per minute per IP.",
});

/**
 * Custom rate limiter factory
 */
const createCustomRateLimiter = ({ windowMs, max, message }) => {
  return createSafeRateLimiter({
    windowMs,
    max,
    message: message || "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Key generator that uses authenticated user ID instead of IP.
 * Falls back to IP if user is not authenticated.
 */
const userKeyGenerator = (req) => {
  if (req.user && req.user._id) {
    return `tier_rl:${req.user._id}`;
  }
  return `tier_rl:${extractIp(req)}`;
};

// Pre-built per-tier limiters (hourly window, keyed by user ID)
const freeTierLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: "Hourly request limit reached for Free tier. Upgrade to Standard or Premium for higher limits.",
});

const standardTierLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: "Hourly request limit reached for Standard tier. Upgrade to Premium for higher limits.",
});

const premiumTierLimiter = createSafeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: "Hourly request limit reached for Premium tier.",
});

/**
 * Subscription tier-aware rate limiter.
 * Reads req.user.subscriptionTier (set by JWT auth middleware) and applies
 * the matching pre-built limiter. Falls back to Free tier limits if the user
 * is unauthenticated or has no subscriptionTier set.
 *
 * Usage: apply AFTER enhancedJWTAuth so req.user is populated.
 */
const tierBasedRateLimiter = (req, res, next) => {
  try {
    const tier = req.user?.subscriptionTier || "Free";
    if (tier === "Premium") return premiumTierLimiter(req, res, next);
    if (tier === "Standard") return standardTierLimiter(req, res, next);
    return freeTierLimiter(req, res, next);
  } catch (error) {
    logger.error(`tierBasedRateLimiter error: ${error.message}`);
    next(); // Fail open — never block a request due to rate-limiter error
  }
};

// ============================================
// EXTENDED (DAILY / WEEKLY / MONTHLY) USAGE LIMITERS
// ============================================

// Redis key format mirrors token.util.js so a shared counter covers both the
// JWT-auth path (this middleware) and the token-verify path (token.util.js).

// In-memory fallback when Redis is unavailable (same pattern as token.util.js).
// NOTE: during a Redis outage this Map and the _rlMemoryStore in token.util.js
// are separate instances, so a user hitting both the JWT-auth path (here) and
// the token-verify path (token.util.js) can consume up to 2× their quota from
// the in-memory stores independently. This is an acceptable trade-off for an
// outage window; the shared counter is restored as soon as Redis recovers.
const _extRlMemory = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _extRlMemory) {
    if (v.expiry < now) _extRlMemory.delete(k);
  }
}, 300000).unref();

/**
 * Increment and check a named rate-limit counter.
 * Uses atomic INCR+EXPIRE (same pattern as _checkRlCounter in token.util.js).
 * Falls back to _extRlMemory when Redis is unavailable. Never throws — fails open.
 */
const _checkExtCounter = async (key, limit, ttlSec, ttlMs) => {
  try {
    _getRedis();
    if (_redisIncrAsync) {
      try {
        const count = await _redisIncrAsync(key);
        if (count === null) throw new Error("Redis unavailable");
        if (count === 1) await _redisExpireAsync(key, ttlSec);
        return count <= limit;
      } catch (_) {
        // Redis call failed — fall through to memory
      }
    }

    const now = Date.now();
    const entry = _extRlMemory.get(key);
    if (!entry || entry.expiry < now) {
      _extRlMemory.set(key, { count: 1, expiry: now + ttlMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  } catch (err) {
    logger.error(`Non-critical: extended rate limit counter error key=${key}: ${err.message}`);
    return true; // Fail open
  }
};

/**
 * Async middleware that enforces daily, weekly, and monthly request quotas
 * for subscription-tier-aware endpoints.
 *
 * Must be applied AFTER auth middleware so req.user is populated.
 * Each period is controlled independently by its own feature flag (all default
 * to false) so they can be turned on one at a time without redeployment risk.
 *
 * Redis keys mirror those used in token.util.js (rl:tv:d/w/m) so that a user's
 * counter is shared across both the JWT-auth path and the token-verify path.
 */
const extendedUsageLimiter = async (req, res, next) => {
  try {
    // Unauthenticated requests are handled by other limiters; skip here.
    if (!req.user || !req.user._id) return next();

    const userId = String(req.user._id);
    const tier   = req.user.subscriptionTier || "Free";

    if (constants.ENABLE_DAILY_RATE_LIMITING) {
      const daySlot = Math.floor(Date.now() / 86400000);
      const ok = await _checkExtCounter(
        `rl:tv:d:${userId}:${daySlot}`,
        (TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free).dailyLimit,
        86401,
        86400000,
      );
      if (!ok) {
        logger.warn(`Daily limit exceeded: user=${userId} tier=${tier}`);
        return res.status(httpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          message: `Daily request limit reached for ${tier} tier`,
          errors: {
            message:
              tier === "Free"
                ? "Upgrade to Standard or Premium for higher API limits"
                : "You have exceeded your daily request limit",
          },
        });
      }
    }

    if (constants.ENABLE_WEEKLY_RATE_LIMITING) {
      // Monday-aligned: subtract 4 days to shift the Thursday-origin epoch
      // so slot boundaries fall on Mondays (00:00 UTC).
      const weekSlot = Math.floor((Date.now() - 4 * 86400000) / 604800000);
      const ok = await _checkExtCounter(
        `rl:tv:w:${userId}:${weekSlot}`,
        (TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free).weeklyLimit,
        604801,
        604800000,
      );
      if (!ok) {
        logger.warn(`Weekly limit exceeded: user=${userId} tier=${tier}`);
        return res.status(httpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          message: `Weekly request limit reached for ${tier} tier`,
          errors: {
            message:
              tier === "Free"
                ? "Upgrade to Standard or Premium for higher API limits"
                : "You have exceeded your weekly request limit",
          },
        });
      }
    }

    if (constants.ENABLE_MONTHLY_RATE_LIMITING) {
      const now      = new Date();
      const monthSlot = now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
      const ok = await _checkExtCounter(
        `rl:tv:m:${userId}:${monthSlot}`,
        (TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free).monthlyLimit,
        32 * 86400,
        32 * 86400000,
      );
      if (!ok) {
        logger.warn(`Monthly limit exceeded: user=${userId} tier=${tier}`);
        return res.status(httpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          message: `Monthly request limit reached for ${tier} tier`,
          errors: {
            message:
              tier === "Free"
                ? "Upgrade to Standard or Premium for higher API limits"
                : "You have exceeded your monthly request limit",
          },
        });
      }
    }

    return next();
  } catch (err) {
    // Never block a request due to rate-limiter error
    logger.error(`extendedUsageLimiter error: ${err.message}`);
    return next();
  }
};

// ============================================
// HEALTH CHECK & MONITORING
// ============================================

/**
 * Get rate limiting configuration status
 */
const getRateLimitStatus = () => {
  try {
    let redisAvailable = false;
    let redisConnected = false;

    try {
      const redis = require("@config/redis");
      redisAvailable = redis.redisUtils && redis.redisUtils.isAvailable();
      redisConnected = redisAvailable;
    } catch (error) {
      // Redis not available
    }

    return {
      enabled: true,
      store: rateStore ? "redis" : "memory",
      redisConfigured: USE_REDIS,
      redisConnected: redisConnected,
      whitelistedIPs: WHITELISTED_IPS.length,
      storeInitialized: rateStore !== null,
      failsafe: true, // Always fails open if errors occur
    };
  } catch (error) {
    logger.error(`Error getting rate limit status: ${error.message}`);
    return {
      enabled: true,
      store: "memory",
      error: error.message,
    };
  }
};

/**
 * Middleware to monitor rate limiter health
 * Can be used in health check endpoints
 */
const rateLimitHealthCheck = async (req, res, next) => {
  const status = getRateLimitStatus();
  req.rateLimitHealth = status;
  next();
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Pre-configured limiters (safe by default)
  strictRateLimiter,
  standardRateLimiter,
  authRateLimiter,
  writeRateLimiter,
  readRateLimiter,
  tokenVerifyIpRateLimiter,
  tokenVerifyRateLimiter,
  queryTokenRateLimiter,

  // Subscription tier-aware limiters (apply after JWT auth)
  tierBasedRateLimiter,
  extendedUsageLimiter,

  // Factory function
  createCustomRateLimiter,

  // Utility functions
  getRateLimitStatus,
  rateLimitHealthCheck,
  isWhitelisted,

  // Error handler (optional - for explicit error handling)
  onRateLimitError,
};
