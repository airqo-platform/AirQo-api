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
  validatePagination,
  validateIpRange,
  validateMultipleIpRanges,
  validateIpRangeIdParam,
  validateIpParam,
  validateIpPrefix,
  validateMultipleIpPrefixes,
  validateIdParam,
} = require("@validators/token.validators");

const { validate, headers, pagination } = require("@validators/common");

const { strictRateLimiter } = require("@middleware/rate-limit.middleware");

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
  createTokenController.listExpired
);

// List expiring tokens
router.get(
  "/expiring",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listExpiring
);

// List tokens with unknown IPs
router.get(
  "/unknown-ip",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listUnknownIPs
);

// Create new token
router.post(
  "/",
  validateTenant,
  validateTokenCreate,
  enhancedJWTAuth,
  createTokenController.create
);

// Regenerate token
router.put(
  "/:token/regenerate",
  validateTenant,
  validateTokenParam,
  validateTokenUpdate,
  enhancedJWTAuth,
  createTokenController.regenerate
);

// Update token
router.put(
  "/:token/update",
  validateTenant,
  validateTokenParam,
  validateTokenUpdate,
  enhancedJWTAuth,
  createTokenController.update
);

// Delete token
router.delete(
  "/:token",
  validateTenant,
  validateTokenParam,
  enhancedJWTAuth,
  createTokenController.delete
);

router.get(
  "/:token/verify",
  validateTenant,
  validateTokenParam,
  // strictRateLimiter,
  createTokenController.verify
);

/******************** blacklisted IP addresses *********************/
// Blacklist single IP
router.post(
  "/blacklist-ip",
  validateTenant,
  validateSingleIp,
  enhancedJWTAuth,
  createTokenController.blackListIp
);

// Blacklist multiple IPs
router.post(
  "/blacklist-ips",
  validateAirqoTenantOnly,
  validateMultipleIps,
  enhancedJWTAuth,
  createTokenController.blackListIps
);

router.delete(
  "/blacklist-ip/:ip",
  validateTenant,
  validateIpParam,
  enhancedJWTAuth,
  createTokenController.removeBlacklistedIp
);

router.get(
  "/blacklist-ip",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listBlacklistedIp
);

/******************** blacklisted IP address RANGES *********************/
router.post(
  "/blacklist-ip-range",
  validateTenant,
  validateIpRange,
  enhancedJWTAuth,
  createTokenController.blackListIpRange
);
router.post(
  "/blacklist-ip-range/bulk",
  validateTenant,
  validateMultipleIpRanges,
  enhancedJWTAuth,
  createTokenController.bulkInsertBlacklistIpRanges
);
router.delete(
  "/blacklist-ip-range/:id",
  validateTenant,
  validateIpRangeIdParam,
  enhancedJWTAuth,
  createTokenController.removeBlacklistedIpRange
);
router.get(
  "/blacklist-ip-range",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listBlacklistedIpRange
);

/******************** whitelisted IP addresses ************************/
router.post(
  "/whitelist-ip",
  validateTenant,
  validateSingleIp,
  enhancedJWTAuth,
  createTokenController.whiteListIp
);

router.post(
  "/bulk-whitelist-ip",
  validateTenant,
  validateMultipleIps,
  enhancedJWTAuth,
  createTokenController.bulkWhiteListIps
);

router.delete(
  "/whitelist-ip/:ip",
  validateTenant,
  validateIpParam,
  enhancedJWTAuth,
  createTokenController.removeWhitelistedIp
);
router.get(
  "/whitelist-ip",
  validateTenant,
  pagination(),
  enhancedJWTAuth,
  createTokenController.listWhitelistedIp
);

/********************  ip prefixes ***************************************/
router.post(
  "/ip-prefix",
  validateTenant,
  validateIpPrefix,
  enhancedJWTAuth,
  createTokenController.ipPrefix
);

router.post(
  "/ip-prefix/bulk",
  validateTenant,
  validateMultipleIpPrefixes,
  enhancedJWTAuth,
  createTokenController.bulkInsertIpPrefix
);

router.delete(
  "/ip-prefix/:id",
  validateTenant,
  validateIdParam,
  enhancedJWTAuth,
  createTokenController.removeIpPrefix
);

router.get(
  "/ip-prefix",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listIpPrefix
);

/********************  blacklisted ip prefixes ****************************/
router.post(
  "/blacklist-ip-prefix",
  validateTenant,
  validateIpPrefix,
  enhancedJWTAuth,
  createTokenController.blackListIpPrefix
);
router.post(
  "/blacklist-ip-prefix/bulk",
  validateTenant,
  validateMultipleIpPrefixes,
  enhancedJWTAuth,
  createTokenController.bulkInsertBlacklistIpPrefix
);
router.delete(
  "/blacklist-ip-prefix/:id",
  validateTenant,
  validateIdParam,
  enhancedJWTAuth,
  createTokenController.removeBlacklistedIpPrefix
);
router.get(
  "/blacklist-ip-prefix",
  validateTenant,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  createTokenController.listBlacklistedIpPrefix
);

/*************************** Get TOKEN's information ********************* */
router.get(
  "/:token",
  validateTenant,
  validateTokenParam,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  createTokenController.list
);

module.exports = router;
