const analyticsService = require("@services/analytics.service");
const crypto = require("crypto");

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
  const startTime = Date.now();
  // DNT header opt-out
  if (req.headers["dnt"] === "1") {
    return next();
  }
  // Capture response after it's sent
  res.on("finish", () => {
    const duration = Date.now() - startTime;

    analyticsService.track(req.analyticsUserId || "anonymous", "api_request", {
      method: req.method,
      path: sanitizePath(req.path),
      statusCode: res.statusCode,
      duration,
      userAgent: hashUserAgent(req.get("user-agent")),
      ip: anonymizeIp(req.ip),
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
    req.user?._id?.toString() ||
    req.session?.userId ||
    req.headers["x-device-id"] ||
    "anonymous";

  next();
};

module.exports = {
  trackAPIRequest,
  attachUserId,
};
