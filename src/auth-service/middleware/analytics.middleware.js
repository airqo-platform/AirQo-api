const analyticsService = require("@services/analytics.service");
const crypto = require("crypto");
const constants = require("@config/constants");

// Helper functions (can be kept or removed, but their calls will be commented out)
/**
 * Helper to anonymize IPv4/IPv6 address
 */
function anonymizeIp(ip) {
  if (!ip) return "";
  // IPv4: replace last octet with 0
  if (ip.includes(".")) {
    const parts = ip.split(".");
    parts[3] = "0";
    return parts.join(".");
  }
  // IPv6: zero out last block
  if (ip.includes(":")) {
    const parts = ip.split(":");
    parts[parts.length - 1] = "0000";
    return parts.join(":");
  }
  return ip;
}
/**
 * Helper to hash user agent string
 */
function hashUserAgent(ua) {
  if (!ua) return "";
  return crypto.createHash("sha256").update(ua).digest("hex");
}
/**
 * Helper to sanitize path (remove emails, tokens, etc.)
 */
function sanitizePath(path) {
  if (!path) return "";
  // Remove email addresses
  path = path.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[email]"
  );
  // Remove tokens (simple: long hex strings)
  path = path.replace(/\b[a-f0-9]{32,}\b/gi, "[token]");
  return path;
}

/**
 * Middleware to track API requests
 */
const trackAPIRequest = (req, res, next) => {
  if (constants.POSTHOG_ENABLED && constants.POSTHOG_TRACK_API_REQUESTS) {
    const startTime = Date.now();
    // DNT/GPC header opt-out
    if (req.headers["dnt"] === "1" || req.headers["sec-gpc"] === "1") {
      return next();
    }

    const cleanup = () => {
      res.removeListener("finish", logRequest);
      res.removeListener("close", logRequest);
    };

    const logRequest = () => {
      const duration = Date.now() - startTime;
      analyticsService.track(
        req.analyticsUserId || "anonymous",
        "api_request",
        {
          method: req.method,
          path: sanitizePath(req.path),
          statusCode: res.statusCode,
          duration,
        }
      );
      cleanup();
    };

    res.on("finish", logRequest);
    res.on("close", logRequest);
  }
  next();
};
/**
 * Middleware to extract and attach user ID for tracking
 */
const attachUserId = (req, res, next) => {
  if (constants.POSTHOG_ENABLED) {
    req.analyticsUserId =
      req.user?.id ||
      req.user?._id?.toString() ||
      req.session?.userId ||
      "anonymous";
  }
  next();
};

module.exports = {
  trackAPIRequest,
  attachUserId,
};
