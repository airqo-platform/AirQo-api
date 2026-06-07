const { query, body, param, oneOf } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { validate } = require("@validators/common");

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(constants.TENANTS)
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
  // Security / resource-binding fields — all optional partial updates.
  // NOTE: tier and scopes are intentionally excluded. Allowing end users to
  // set tier would let anyone self-upgrade to Premium and bypass rate limits.
  // Allowing end users to set scopes would let them grant themselves access to
  // data types beyond their subscription. Both fields must only be changed by
  // admins via a privileged internal flow (e.g. direct DB update or a future
  // admin-only endpoint with role enforcement).
  body("allowed_grids")
    .optional()
    .isArray()
    .withMessage("allowed_grids must be an array"),
  body("allowed_grids.*")
    .isString()
    .withMessage("each grid ID must be a string"),
  body("allowed_cohorts")
    .optional()
    .isArray()
    .withMessage("allowed_cohorts must be an array"),
  body("allowed_cohorts.*")
    .isString()
    .withMessage("each cohort ID must be a string"),
  body("allowed_origins")
    .optional()
    .isArray()
    .withMessage("allowed_origins must be an array"),
  body("allowed_origins.*")
    .isString()
    .withMessage("each origin must be a string"),
  body("access_schedule")
    .optional()
    .isObject()
    .withMessage("access_schedule must be an object"),
  body("access_schedule.enabled")
    .optional()
    .isBoolean()
    .withMessage("access_schedule.enabled must be a boolean"),
  body("access_schedule.allowed_days")
    .optional()
    .isArray()
    .withMessage("access_schedule.allowed_days must be an array"),
  body("access_schedule.allowed_days.*")
    .isInt({ min: 0, max: 6 })
    .withMessage("each day must be an integer between 0 (Sunday) and 6 (Saturday)"),
  body("access_schedule.allowed_hours_utc.start")
    .optional()
    .isInt({ min: 0, max: 23 })
    .withMessage("allowed_hours_utc.start must be an integer between 0 and 23"),
  body("access_schedule.allowed_hours_utc.end")
    .optional()
    .isInt({ min: 0, max: 23 })
    .withMessage("allowed_hours_utc.end must be an integer between 0 and 23"),
  body("request_pattern")
    .optional()
    .isObject()
    .withMessage("request_pattern must be an object"),
  body("request_pattern.auto_suspended")
    .optional()
    .isBoolean()
    .withMessage("request_pattern.auto_suspended must be a boolean"),
  // anomaly_score is intentionally excluded — allowing callers to reset their
  // own score would let them bypass the anomaly detector indefinitely.
  validate,
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
  validate,
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
    .isFQDN()
    .withMessage("domain must be a valid domain name (e.g., example.com)")
    .trim()
    .toLowerCase(),
  body("reason")
    .optional()
    .isString()
    .withMessage("reason must be a string")
    .trim(),
  validate,
];

const listBlockedDomains = [validate];

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
    .bail()
    .isFQDN()
    .withMessage("domain must be a valid domain name (e.g., example.com)")
    .trim()
    .toLowerCase(),
  validate,
];

/******************** BlockedASN validators ***********************************/
const createBlockedASN = [
  body("provider")
    .exists()
    .withMessage("provider is required")
    .bail()
    .isString()
    .withMessage("provider must be a string")
    .bail()
    .notEmpty()
    .withMessage("provider cannot be empty")
    .trim(),
  body("asn")
    .optional()
    .isString()
    .withMessage("asn must be a string")
    .trim(),
  body("cidr_ranges")
    .optional()
    .isArray()
    .withMessage("cidr_ranges must be an array"),
  body("cidr_ranges.*")
    .isString()
    .withMessage("each CIDR range must be a string")
    .bail()
    .matches(
      /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\/(3[0-2]|[12]\d|\d)$/
    )
    .withMessage("each CIDR range must be valid IPv4 CIDR notation (e.g. 192.0.2.0/24)"),
  body("reason")
    .optional()
    .isString()
    .withMessage("reason must be a string")
    .trim(),
  body("active")
    .optional()
    .isBoolean()
    .withMessage("active must be a boolean"),
  validate,
];

const listBlockedASNs = [validate];

const deleteBlockedASN = [
  param("id")
    .exists()
    .withMessage("the id param is missing in the request")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("id cannot be empty")
    .bail()
    .isMongoId()
    .withMessage("id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
  validate,
];

/******************** FlaggedToken validators *********************************/
const listFlaggedTokens = [
  query("resolved")
    .optional()
    .isBoolean()
    .withMessage("resolved must be a boolean"),
  validate,
];

const resolveFlaggedToken = [
  param("id")
    .exists()
    .withMessage("the id param is missing in the request")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("id cannot be empty")
    .bail()
    .isMongoId()
    .withMessage("id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
  body("note")
    .optional()
    .isString()
    .withMessage("note must be a string")
    .trim(),
  validate,
];

module.exports = {
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
  validateIpPrefix,
  validateMultipleIpPrefixes,
  validateIdParam,
  validateBotLikeIPStats,
  createBlockedDomain,
  listBlockedDomains,
  removeBlockedDomain,
  createBlockedASN,
  listBlockedASNs,
  deleteBlockedASN,
  listFlaggedTokens,
  resolveFlaggedToken,
};
