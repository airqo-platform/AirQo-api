const constants = require("@config/constants");
const rateLimit = require("express-rate-limit");
const { logObject, logText } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- rate-limit.middleware.js`
);
const httpStatus = require("http-status");

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
const rateLimitHandler = (req, res) => {
  try {
    const ip = extractIp(req);
    logger.warn(`Rate limit exceeded for IP: ${ip} on ${req.path}`);

    return res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
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
  const { keyGenerator: configKeyGenerator, ...restConfig } = config;
  try {
    return rateLimit({
      ...restConfig,
      store: rateStore,
      skip: skipFunction,
      handler: rateLimitHandler,
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
    if (token) return `token_verify_rl:${token}`;
    return `token_verify_rl:ip:${extractIp(req)}`;
  },
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
  tokenVerifyRateLimiter,

  // Subscription tier-aware limiter (apply after JWT auth)
  tierBasedRateLimiter,

  // Factory function
  createCustomRateLimiter,

  // Utility functions
  getRateLimitStatus,
  rateLimitHealthCheck,
  isWhitelisted,

  // Error handler (optional - for explicit error handling)
  onRateLimitError,
};
