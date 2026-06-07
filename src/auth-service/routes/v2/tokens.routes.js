const express = require("express");
const router = express.Router();
const createTokenController = require("@controllers/token.controller");
const { enhancedJWTAuth } = require("@middleware/passport");
const {
  validateTenant,
  validateAirqoTenantOnly,
  validateTokenParam,
  validateTokenCreate,
  validateTokenUpdate,
  validateSingleIp,
  validateMultipleIps,
  validateIpRange,
  validateMultipleIpRanges,
  validateIpRangeIdParam,
  validateIpParam,
  validateBotLikeIPStats,
  validateIpPrefix,
  validateMultipleIpPrefixes,
  createBlockedDomain,
  listBlockedDomains,
  removeBlockedDomain,
  validateIdParam,
  createBlockedASN,
  listBlockedASNs,
  deleteBlockedASN,
  listFlaggedTokens,
  resolveFlaggedToken,
} = require("@validators/token.validators");

const { validate, headers, pagination } = require("@validators/common");

const { tokenVerifyIpRateLimiter, tokenVerifyRateLimiter } = require("@middleware/rate-limit.middleware");

const domainBlockingMiddleware = require("@middleware/domain-blocking.middleware");
const honeypotHandler = require("@middleware/honeypot.middleware");
// Apply common middleware
router.use(headers); // Keep headers global

/******************** tokens ***********************************/
// List all tokens
router.get("/", validateTenant, enhancedJWTAuth, createTokenController.list);

// List expired tokens
router.get(
  "/expired",
  validateTenant,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createTokenController.listExpired,
);

// List expiring tokens
router.get(
  "/expiring",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listExpiring,
);

// List tokens with unknown IPs
router.get(
  "/unknown-ip",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listUnknownIPs,
);

// Create new token
router.post(
  "/",
  validateTenant,
  validateTokenCreate,
  enhancedJWTAuth,
  createTokenController.create,
);

// Regenerate token
router.put(
  "/:token/regenerate",
  validateTenant,
  validateTokenParam,
  validateTokenUpdate,
  enhancedJWTAuth,
  createTokenController.regenerate,
);

// Update token (legacy path — kept for backwards compatibility)
router.put(
  "/:token/update",
  validateTenant,
  validateTokenParam,
  validateTokenUpdate,
  enhancedJWTAuth,
  createTokenController.update,
);

// Update token (REST-idiomatic alias — same controller, cleaner path)
router.patch(
  "/:token",
  validateTenant,
  validateTokenParam,
  validateTokenUpdate,
  enhancedJWTAuth,
  createTokenController.update,
);

// Delete token
router.delete(
  "/:token",
  validateTenant,
  validateTokenParam,
  enhancedJWTAuth,
  createTokenController.delete,
);

router.get(
  "/:token/verify",
  validateTenant,
  // domainBlockingMiddleware, // Temporarily disabled for performance monitoring
  validateTokenParam,
  tokenVerifyIpRateLimiter,
  tokenVerifyRateLimiter,
  createTokenController.verify,
);

/******************** blacklisted IP addresses *********************/
// Blacklist single IP
router.post(
  "/blacklist-ip",
  validateTenant,
  validateSingleIp,
  enhancedJWTAuth,
  createTokenController.blackListIp,
);

// Blacklist multiple IPs
router.post(
  "/blacklist-ips",
  validateAirqoTenantOnly,
  validateMultipleIps,
  enhancedJWTAuth,
  createTokenController.blackListIps,
);

router.delete(
  "/blacklist-ip/:ip",
  validateTenant,
  validateIpParam,
  enhancedJWTAuth,
  createTokenController.removeBlacklistedIp,
);

router.get(
  "/blacklist-ip",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listBlacklistedIp,
);

/******************** blacklisted IP address RANGES *********************/
router.post(
  "/blacklist-ip-range",
  validateTenant,
  validateIpRange,
  enhancedJWTAuth,
  createTokenController.blackListIpRange,
);
router.post(
  "/blacklist-ip-range/bulk",
  validateTenant,
  validateMultipleIpRanges,
  enhancedJWTAuth,
  createTokenController.bulkInsertBlacklistIpRanges,
);
router.delete(
  "/blacklist-ip-range/:id",
  validateTenant,
  validateIpRangeIdParam,
  enhancedJWTAuth,
  createTokenController.removeBlacklistedIpRange,
);
router.get(
  "/blacklist-ip-range",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listBlacklistedIpRange,
);

/******************** whitelisted IP addresses ************************/
router.post(
  "/whitelist-ip",
  validateTenant,
  validateSingleIp,
  enhancedJWTAuth,
  createTokenController.whiteListIp,
);

router.post(
  "/bulk-whitelist-ip",
  validateTenant,
  validateMultipleIps,
  enhancedJWTAuth,
  createTokenController.bulkWhiteListIps,
);

router.delete(
  "/whitelist-ip/:ip",
  validateTenant,
  validateIpParam,
  enhancedJWTAuth,
  createTokenController.removeWhitelistedIp,
);
router.get(
  "/whitelist-ip",
  validateTenant,
  pagination(),
  enhancedJWTAuth,
  createTokenController.listWhitelistedIp,
);

router.get(
  "/bot-like-ip-stats",
  validateTenant,
  pagination(),
  validateBotLikeIPStats,
  enhancedJWTAuth,
  createTokenController.getBotLikeIPStats,
);

router.get(
  "/whitelist/stats",
  validateTenant,
  pagination(),
  enhancedJWTAuth,
  createTokenController.getWhitelistedIPStats,
);

/********************  ip prefixes ***************************************/
router.post(
  "/ip-prefix",
  validateTenant,
  validateIpPrefix,
  enhancedJWTAuth,
  createTokenController.ipPrefix,
);

router.post(
  "/ip-prefix/bulk",
  validateTenant,
  validateMultipleIpPrefixes,
  enhancedJWTAuth,
  createTokenController.bulkInsertIpPrefix,
);

router.delete(
  "/ip-prefix/:id",
  validateTenant,
  validateIdParam,
  enhancedJWTAuth,
  createTokenController.removeIpPrefix,
);

router.get(
  "/ip-prefix",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listIpPrefix,
);

/********************  blacklisted ip prefixes ****************************/
router.post(
  "/blacklist-ip-prefix",
  validateTenant,
  validateIpPrefix,
  enhancedJWTAuth,
  createTokenController.blackListIpPrefix,
);
router.post(
  "/blacklist-ip-prefix/bulk",
  validateTenant,
  validateMultipleIpPrefixes,
  enhancedJWTAuth,
  createTokenController.bulkInsertBlacklistIpPrefix,
);
router.delete(
  "/blacklist-ip-prefix/:id",
  validateTenant,
  validateIdParam,
  enhancedJWTAuth,
  createTokenController.removeBlacklistedIpPrefix,
);
router.get(
  "/blacklist-ip-prefix",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listBlacklistedIpPrefix,
);

/******************** blocked domains ***********************************/
router.post(
  "/blocked-domains",
  validateTenant,
  createBlockedDomain,
  enhancedJWTAuth,
  createTokenController.createBlockedDomain,
);
router.get(
  "/blocked-domains",
  validateTenant,
  pagination(),
  listBlockedDomains,
  enhancedJWTAuth,
  createTokenController.listBlockedDomains,
);
router.delete(
  "/blocked-domains/:domain",
  validateTenant,
  removeBlockedDomain,
  enhancedJWTAuth,
  createTokenController.removeBlockedDomain,
);

/******************** Blocked ASN management *******************************/
router.post(
  "/blocked-asns",
  validateAirqoTenantOnly,
  createBlockedASN,
  enhancedJWTAuth,
  createTokenController.createBlockedASN,
);

router.get(
  "/blocked-asns",
  validateAirqoTenantOnly,
  listBlockedASNs,
  pagination(),
  enhancedJWTAuth,
  createTokenController.listBlockedASNs,
);

router.delete(
  "/blocked-asns/:id",
  validateAirqoTenantOnly,
  deleteBlockedASN,
  enhancedJWTAuth,
  createTokenController.deleteBlockedASN,
);

/******************** Flagged token management *****************************/
router.get(
  "/flagged-tokens",
  validateAirqoTenantOnly,
  listFlaggedTokens,
  pagination(),
  enhancedJWTAuth,
  createTokenController.listFlaggedTokens,
);

router.put(
  "/flagged-tokens/:id/resolve",
  validateAirqoTenantOnly,
  resolveFlaggedToken,
  enhancedJWTAuth,
  createTokenController.resolveFlaggedToken,
);

/******************** Cross-service honeypot flag endpoint **************
 * Called by downstream services (e.g. device-registry) to report a
 * honeypot hit for a token they cannot suspend themselves (token DB lives
 * only in auth-service).  Protected by JWT — not reachable from outside.
 *************************************************************************/
router.post(
  "/honeypot-flag",
  validateAirqoTenantOnly,
  enhancedJWTAuth,
  createTokenController.honeypotFlag,
);

/*************************** Honeypot routes *****************************
 * These paths look plausible but are NOT documented anywhere.
 * Any request reaching them is flagged and the token auto-suspended.
 *************************************************************************/
router.get("/export-all", honeypotHandler);
router.get("/dump", honeypotHandler);
router.get("/admin/export", honeypotHandler);
router.post("/bulk-export", honeypotHandler);
router.get("/internal/all-tokens", honeypotHandler);

/*************************** Get TOKEN's information ********************* */
router.get(
  "/:token",
  validateTenant,
  validateTokenParam,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  createTokenController.list,
);

module.exports = router;
