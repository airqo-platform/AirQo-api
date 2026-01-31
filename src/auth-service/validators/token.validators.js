const { query, body, param, oneOf } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const { handleValidationErrors, commonValidations } = require("./common");

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo", "airqount"])
    .withMessage("the tenant value is not among the expected ones"),
]);

const validateAirqoTenantOnly = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["airqo"])
    .withMessage("the tenant value is not among the expected ones"),
]);

const validateTokenParam = oneOf([
  param("token")
    .exists()
    .withMessage("the token parameter is missing in the request")
    .bail()
    .notEmpty()
    .withMessage("token must not be empty")
    .trim(),
]);

const validateTokenCreate = [
  oneOf([
    [
      body("name")
        .exists()
        .withMessage("the name is missing in your request")
        .trim(),
      body("client_id")
        .exists()
        .withMessage(
          "a token requirement is missing in request, consider using the client_id",
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
    ],
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
];

const validateTokenUpdate = [
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
];

const validateSingleIp = oneOf([
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
]);

const validateMultipleIps = oneOf([
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
]);

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const validateIpParam = oneOf([
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
]);

const validateIpRange = oneOf([
  body("range")
    .exists()
    .withMessage("the range is missing in your request body")
    .bail()
    .notEmpty()
    .withMessage("the range should not be empty if provided")
    .trim(),
]);

const validateMultipleIpRanges = oneOf([
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
]);

const validateIpRangeIdParam = oneOf([
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
]);

const validateIpPrefix = oneOf([
  body("prefix")
    .exists()
    .withMessage("the prefix is missing in your request body")
    .bail()
    .notEmpty()
    .withMessage("the prefix should not be empty if provided")
    .trim(),
]);

const validateMultipleIpPrefixes = oneOf([
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
]);

const validateIdParam = oneOf([
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
]);

const validateBotLikeIPStats = [
  query("endpoint_filter")
    .optional()
    .isString()
    .withMessage("endpoint_filter must be a string")
    .trim(),
  handleValidationErrors,
];
const createBlockedDomain = [
  body("domain")
    .exists()
    .withMessage("domain is required")
    .bail()
    .isString()
    .withMessage("domain must be a string")
    .bail()
    .notEmpty()
    .withMessage("domain cannot be empty")
    .bail()
    .isURL({ require_protocol: false, require_host: true })
    .withMessage("domain must be a valid domain name (e.g., example.com)")
    .trim()
    .toLowerCase(),
  body("reason")
    .optional()
    .isString()
    .withMessage("reason must be a string")
    .trim(),
  handleValidationErrors,
];

const listBlockedDomains = [
  ...commonValidations.pagination(),
  handleValidationErrors,
];

const removeBlockedDomain = [
  param("domain")
    .exists()
    .withMessage("domain is required in params")
    .bail()
    .isString()
    .withMessage("domain must be a string")
    .bail()
    .notEmpty()
    .withMessage("domain cannot be empty")
    .trim()
    .toLowerCase(),
  handleValidationErrors,
];

module.exports = {
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
  validateBotLikeIPStats,
  createBlockedDomain,
  listBlockedDomains,
  removeBlockedDomain,
};
