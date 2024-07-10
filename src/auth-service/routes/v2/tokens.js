const express = require("express");
const router = express.Router();
const createTokenController = require("@controllers/create-token");
const { check, oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const rateLimitMiddleware = require("@middleware/rate-limit");

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(validatePagination);

/******************** tokens ***********************************/
router.get(
  "/",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .trim()
      .toLowerCase()
      .bail()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.list
);
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body("name")
      .exists()
      .withMessage("the name is missing in your request")
      .trim(),
    body("client_id")
      .exists()
      .withMessage(
        "a token requirement is missing in request, consider using the client_id"
      )
      .bail()
      .notEmpty()
      .withMessage("this client_id cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("client_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("expires")
        .optional()
        .notEmpty()
        .withMessage("expires cannot be empty if provided")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("expires must be a valid datetime.")
        .bail()
        .isAfter(new Date().toISOString().slice(0, 10))
        .withMessage("the date should not be before the current date")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.create
);
router.put(
  "/:token/regenerate",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("token")
      .exists()
      .withMessage("the token parameter is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("token must not be empty")
      .trim(),
  ]),
  oneOf([
    [
      body("expires")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("expires cannot be empty if provided")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("expires must be a valid datetime.")
        .bail()
        .isAfter(new Date().toISOString().slice(0, 10))
        .withMessage("the date should not be before the current date")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.regenerate
);
router.put(
  "/:token/update",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("token")
      .exists()
      .withMessage("the token parameter is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("token must not be empty")
      .trim(),
  ]),
  oneOf([
    [
      body("expires")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("expires cannot be empty if provided")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("expires must be a valid datetime.")
        .bail()
        .isAfter(new Date().toISOString().slice(0, 10))
        .withMessage("the date should not be before the current date")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.update
);
router.delete(
  "/:token",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("token")
      .exists()
      .withMessage("the token parameter is missing in the request")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the token must not be empty"),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.delete
);
router.get(
  "/:token/verify",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("token")
        .exists()
        .withMessage("the token param is missing in the request")
        .bail()
        .trim()
        .notEmpty()
        .withMessage("the token must not be empty"),
    ],
  ]),
  // rateLimitMiddleware,
  createTokenController.verify
);
/******************** unknown IP addresses *************************/
router.get(
  "/unknown-ip",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.listUnknownIPs
);

/******************** blacklisted IP addresses *********************/
router.post(
  "/blacklist-ip",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body("ip")
      .exists()
      .withMessage("the ip is missing in your request body")
      .bail()
      .notEmpty()
      .withMessage("the ip should not be empty if provided")
      .trim()
      .bail()
      .isIP()
      .withMessage("Invalid IP address"),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.blackListIp
);
router.post(
  "/blacklist-ips",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("ips")
        .exists()
        .withMessage("the ips are missing in your request body")
        .bail()
        .notEmpty()
        .withMessage("the ips should not be empty in the request body")
        .bail()
        .notEmpty()
        .withMessage("the ips should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the ips should be an array"),
      body("ips.*")
        .notEmpty()
        .withMessage("Provided ips should NOT be empty")
        .bail()
        .isIP()
        .withMessage("IP address provided must be a valid IP address"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.blackListIps
);
router.delete(
  "/blacklist-ip/:ip",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("ip")
      .exists()
      .withMessage("the ip parameter is missing in the request")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the ip must not be empty")
      .bail()
      .isIP()
      .withMessage("Invalid IP address"),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.removeBlacklistedIp
);
router.get(
  "/blacklist-ip",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.listBlacklistedIp
);

/******************** blacklisted IP address RANGES *********************/
router.post(
  "/blacklist-ip-range",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body("range")
      .exists()
      .withMessage("the range is missing in your request body")
      .bail()
      .notEmpty()
      .withMessage("the range should not be empty if provided")
      .trim(),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.blackListIpRange
);
router.post(
  "/blacklist-ip-range/bulk",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("ranges")
        .exists()
        .withMessage("the ranges are missing in your request body")
        .bail()
        .notEmpty()
        .withMessage("the ranges should not be empty in the request body")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the ranges should be an array"),
      body("ranges.*")
        .notEmpty()
        .withMessage("Provided range should NOT be empty"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.bulkInsertBlacklistIpRanges
);
router.delete(
  "/blacklist-ip-range/:id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("id")
      .exists()
      .withMessage("the id param is missing in the request")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the id cannot be empty when provided")
      .bail()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.removeBlacklistedIpRange
);
router.get(
  "/blacklist-ip-range",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.listBlacklistedIpRange
);

/******************** whitelisted IP addresses ************************/
router.post(
  "/whitelist-ip",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body("ip")
      .exists()
      .withMessage("the ip is missing in your request body")
      .bail()
      .notEmpty()
      .withMessage("the ip should not be empty if provided")
      .trim()
      .bail()
      .isIP()
      .withMessage("Invalid IP address"),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.whiteListIp
);
router.delete(
  "/whitelist-ip/:ip",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("ip")
      .exists()
      .withMessage("the ip parameter is missing in the request")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the ip must not be empty")
      .bail()
      .isIP()
      .withMessage("Invalid IP address"),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.removeWhitelistedIp
);
router.get(
  "/whitelist-ip",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.listWhitelistedIp
);

/********************  ip prefixes ***************************************/
router.post(
  "/ip-prefix",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body("prefix")
      .exists()
      .withMessage("the prefix is missing in your request body")
      .bail()
      .notEmpty()
      .withMessage("the prefix should not be empty if provided")
      .trim(),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.ipPrefix
);
router.post(
  "/ip-prefix/bulk",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("prefixes")
        .exists()
        .withMessage("the prefixes are missing in your request body")
        .bail()
        .notEmpty()
        .withMessage("the prefixes should not be empty in the request body")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the prefixes should be an array"),
      body("prefixes.*")
        .notEmpty()
        .withMessage("Provided prefix should NOT be empty"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.bulkInsertIpPrefix
);
router.delete(
  "/ip-prefix/:id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("id")
      .exists()
      .withMessage("the id param is missing in the request")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the id cannot be empty when provided")
      .bail()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.removeIpPrefix
);
router.get(
  "/ip-prefix",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.listIpPrefix
);

/********************  blacklisted ip prefixes ****************************/
router.post(
  "/blacklist-ip-prefix",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body("prefix")
      .exists()
      .withMessage("the prefix is missing in your request body")
      .bail()
      .notEmpty()
      .withMessage("the prefix should not be empty if provided")
      .trim(),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.blackListIpPrefix
);
router.post(
  "/blacklist-ip-prefix/bulk",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("prefixes")
        .exists()
        .withMessage("the prefixes are missing in your request body")
        .bail()
        .notEmpty()
        .withMessage("the prefixes should not be empty in the request body")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the ranges should be an array"),
      body("prefixes.*")
        .notEmpty()
        .withMessage("Provided prefix should NOT be empty"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.bulkInsertBlacklistIpPrefix
);
router.delete(
  "/blacklist-ip-prefix/:id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("id")
      .exists()
      .withMessage("the id param is missing in the request")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("the id cannot be empty when provided")
      .bail()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.removeBlacklistedIpPrefix
);
router.get(
  "/blacklist-ip-prefix",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.listBlacklistedIpPrefix
);

/*************************** Get TOKEN's information ********************* */

router.get(
  "/:token",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("token")
        .exists()
        .withMessage("the token param is missing in the request")
        .bail()
        .trim()
        .notEmpty()
        .withMessage("the token must not be empty"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createTokenController.list
);

module.exports = router;
