const express = require("express");
const router = express.Router();
const createTokenController = require("@controllers/token.controller");
const { setJWTAuth, authJWT } = require("@middleware/passport");
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

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

// Apply common middleware
router.use(headers);
router.use(validatePagination);

/******************** tokens ***********************************/
// List all tokens
router.get(
  "/",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.list
);

// List expired tokens
router.get(
  "/expired",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.listExpired
);

// List expiring tokens
router.get(
  "/expiring",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.listExpiring
);

// List tokens with unknown IPs
router.get(
  "/unknown-ip",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.listUnknownIPs
);

// Create new token
router.post(
  "/",
  validateTenant,
  validateTokenCreate,
  setJWTAuth,
  authJWT,
  createTokenController.create
);

// Regenerate token
router.put(
  "/:token/regenerate",
  validateTenant,
  validateTokenParam,
  validateTokenUpdate,
  setJWTAuth,
  authJWT,
  createTokenController.regenerate
);

// Update token
router.put(
  "/:token/update",
  validateTenant,
  validateTokenParam,
  validateTokenUpdate,
  setJWTAuth,
  authJWT,
  createTokenController.update
);

// Delete token
router.delete(
  "/:token",
  validateTenant,
  validateTokenParam,
  setJWTAuth,
  authJWT,
  createTokenController.delete
);

// Verify token
router.get(
  "/:token/verify",
  validateTenant,
  validateTokenParam,
  // rateLimitMiddleware,
  createTokenController.verify
);

/******************** blacklisted IP addresses *********************/
// Blacklist single IP
router.post(
  "/blacklist-ip",
  validateTenant,
  validateSingleIp,
  setJWTAuth,
  authJWT,
  createTokenController.blackListIp
);

// Blacklist multiple IPs
router.post(
  "/blacklist-ips",
  validateAirqoTenantOnly,
  validateMultipleIps,
  setJWTAuth,
  authJWT,
  createTokenController.blackListIps
);

router.delete(
  "/blacklist-ip/:ip",
  validateTenant,
  validateIpParam,
  setJWTAuth,
  authJWT,
  createTokenController.removeBlacklistedIp
);

router.get(
  "/blacklist-ip",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.listBlacklistedIp
);

/******************** blacklisted IP address RANGES *********************/
router.post(
  "/blacklist-ip-range",
  validateTenant,
  validateIpRange,
  setJWTAuth,
  authJWT,
  createTokenController.blackListIpRange
);
router.post(
  "/blacklist-ip-range/bulk",
  validateTenant,
  validateMultipleIpRanges,
  setJWTAuth,
  authJWT,
  createTokenController.bulkInsertBlacklistIpRanges
);
router.delete(
  "/blacklist-ip-range/:id",
  validateTenant,
  validateIpRangeIdParam,
  setJWTAuth,
  authJWT,
  createTokenController.removeBlacklistedIpRange
);
router.get(
  "/blacklist-ip-range",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.listBlacklistedIpRange
);

/******************** whitelisted IP addresses ************************/
router.post(
  "/whitelist-ip",
  validateTenant,
  validateSingleIp,
  setJWTAuth,
  authJWT,
  createTokenController.whiteListIp
);

router.post(
  "/bulk-whitelist-ip",
  validateTenant,
  validateMultipleIps,
  setJWTAuth,
  authJWT,
  createTokenController.bulkWhiteListIps
);

router.delete(
  "/whitelist-ip/:ip",
  validateTenant,
  validateIpParam,
  setJWTAuth,
  authJWT,
  createTokenController.removeWhitelistedIp
);
router.get(
  "/whitelist-ip",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.listWhitelistedIp
);

/********************  ip prefixes ***************************************/
router.post(
  "/ip-prefix",
  validateTenant,
  validateIpPrefix,
  setJWTAuth,
  authJWT,
  createTokenController.ipPrefix
);

router.post(
  "/ip-prefix/bulk",
  validateTenant,
  validateMultipleIpPrefixes,
  setJWTAuth,
  authJWT,
  createTokenController.bulkInsertIpPrefix
);

router.delete(
  "/ip-prefix/:id",
  validateTenant,
  validateIdParam,
  setJWTAuth,
  authJWT,
  createTokenController.removeIpPrefix
);

router.get(
  "/ip-prefix",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.listIpPrefix
);

/********************  blacklisted ip prefixes ****************************/
router.post(
  "/blacklist-ip-prefix",
  validateTenant,
  validateIpPrefix,
  setJWTAuth,
  authJWT,
  createTokenController.blackListIpPrefix
);
router.post(
  "/blacklist-ip-prefix/bulk",
  validateTenant,
  validateMultipleIpPrefixes,
  setJWTAuth,
  authJWT,
  createTokenController.bulkInsertBlacklistIpPrefix
);
router.delete(
  "/blacklist-ip-prefix/:id",
  validateTenant,
  validateIdParam,
  setJWTAuth,
  authJWT,
  createTokenController.removeBlacklistedIpPrefix
);
router.get(
  "/blacklist-ip-prefix",
  validateTenant,
  setJWTAuth,
  authJWT,
  createTokenController.listBlacklistedIpPrefix
);

/*************************** Get TOKEN's information ********************* */
router.get(
  "/:token",
  validateTenant,
  validateTokenParam,
  setJWTAuth,
  authJWT,
  createTokenController.list
);

module.exports = router;
