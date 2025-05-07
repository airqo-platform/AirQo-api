// validators/health.validators.js
const expressRateLimit = require("express-rate-limit"); // Renamed import
const constants = require("@config/constants");

// Rate limiter for message broker health endpoint - 10 requests per minute
const brokerHealthRateLimiter = expressRateLimit({
  windowMs: constants.HEALTH_CHECK_RATE_LIMIT_WINDOW_MS || 60 * 1000, // 1 minute
  max: constants.HEALTH_CHECK_RATE_LIMIT_MAX || 10, // Limit each IP to 10 requests per minute
  message: "Too many health check requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Less restrictive rate limiter for internal health checks - 60 requests per minute
const internalHealthRateLimiter = expressRateLimit({
  windowMs: constants.HEALTH_CHECK_RATE_LIMIT_WINDOW_MS || 60 * 1000, // 1 minute
  max: constants.HEALTH_CHECK_RATE_LIMIT_MAX * 6 || 60, // Limit each IP to 60 requests per minute
  message: "Too many internal health check requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply the rate limiter as middleware
const rateLimit = (req, res, next) => {
  return brokerHealthRateLimiter(req, res, next);
};

// Apply the internal rate limiter as middleware
const internalRateLimit = (req, res, next) => {
  return internalHealthRateLimiter(req, res, next);
};

// Middleware to validate API key for internal endpoints
const apiKey = (req, res, next) => {
  const apiKey = req.header("X-API-Key");

  if (!apiKey || apiKey !== constants.INTERNAL_API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
      errors: { message: "Invalid or missing API key" },
    });
  }

  next();
};

module.exports = {
  rateLimit,
  internalRateLimit,
  apiKey,
};
