const analyticsService = require("@services/analytics.service");

/**
 * Middleware to track API requests
 */
const trackAPIRequest = (req, res, next) => {
  const startTime = Date.now();

  // Capture response after it's sent
  res.on("finish", () => {
    const duration = Date.now() - startTime;

    analyticsService.track(req.analyticsUserId || "anonymous", "api_request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });
  });

  next();
};

/**
 * Middleware to extract and attach user ID for tracking
 */
const attachUserId = (req, res, next) => {
  // Get user ID from various sources
  req.analyticsUserId =
    req.user?.id ||
    req.user?._id ||
    req.session?.userId ||
    req.headers["x-device-id"] ||
    "anonymous";

  next();
};

module.exports = {
  trackAPIRequest,
  attachUserId,
};
