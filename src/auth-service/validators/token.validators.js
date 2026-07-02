const net = require("net");
const { body, param, query, oneOf } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { validate } = require("@validators/common");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

// ─── helpers ──────────────────────────────────────────────────────────────────

function _isValidIP(ip) {
  return net.isIP(ip) !== 0;
}

function _isValidIPRange(range) {
  const parts = (range || "").split("-");
  if (parts.length !== 2) return false;
  return _isValidIP(parts[0].trim()) && _isValidIP(parts[1].trim());
}

function _isValidIPPrefix(prefix) {
  return /^\/(12[0-8]|1[01]\d|[1-9]?\d)$/.test(prefix || "");
}

function _isValidMongoId(id) {
  return /^[a-f0-9]{24}$/i.test(id || "");
}

function _isValidISO8601(str) {
  if (!str) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function _isDateInFuture(dateStr) {
  return new Date(dateStr) > new Date();
}

function _mwError(next, msg) {
  return next(new HttpError("Validation Error", httpStatus.BAD_REQUEST, { msg }));
}

// ─── dual-purpose validators ──────────────────────────────────────────────────
// When called as (data)         → pure-function mode: return undefined or { msg }
// When called as (req, res, next) → middleware mode: call next() or next(HttpError)

const validateTenant = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const tenant = isMW
    ? (reqOrData.query || {}).tenant
    : (reqOrData || {}).tenant;

  if (tenant) {
    if (typeof tenant !== "string") {
      const msg = "the tenant value is not among the expected ones";
      return isMW ? _mwError(next, msg) : { msg };
    }
    const t = tenant.toLowerCase().trim();
    const valid = (constants.TENANTS || []).map((v) => v.toLowerCase());
    if (!valid.includes(t)) {
      const msg = "the tenant value is not among the expected ones";
      return isMW ? _mwError(next, msg) : { msg };
    }
  }
  if (isMW) return next();
};

const validateAirqoTenantOnly = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const tenant = isMW
    ? (reqOrData.query || {}).tenant
    : (reqOrData || {}).tenant;

  if (tenant) {
    if (typeof tenant !== "string") {
      const msg = "the tenant value is not among the expected ones";
      return isMW ? _mwError(next, msg) : { msg };
    }
    const t = tenant.toLowerCase().trim();
    if (t !== "airqo") {
      const msg = "the tenant value is not among the expected ones";
      return isMW ? _mwError(next, msg) : { msg };
    }
  }
  if (isMW) return next();
};

const validateTokenParam = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const token = isMW
    ? (reqOrData.params || {}).token
    : (reqOrData || {}).token;

  if (token === undefined || token === null) {
    const msg = "the token parameter is missing in the request";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (token === "") {
    const msg = "token must not be empty";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (isMW) return next();
};

// ── validateTokenCreate ───────────────────────────────────────────────────────
// Pure mode: takes array of { fieldName: value } objects
// MW mode:   validates req.body

function _validateTokenCreateItems(items) {
  if (!items || items.length === 0) {
    return { msg: "the name is missing in your request" };
  }
  for (const item of items) {
    if ("client_id" in item) {
      const id = item.client_id;
      if (!id || !_isValidMongoId(id)) {
        return { msg: "this client_id cannot be empty" };
      }
    }
    if ("expires" in item) {
      const exp = item.expires;
      if (!_isValidISO8601(exp)) {
        return { msg: "expires must be a valid datetime." };
      }
      if (_isDateInFuture(exp)) {
        return { msg: "the date should not be before the current date" };
      }
    }
  }
}

const validateTokenCreate = (itemsOrReq, res, next) => {
  if (Array.isArray(itemsOrReq)) {
    return _validateTokenCreateItems(itemsOrReq);
  }
  // middleware mode
  const body = (itemsOrReq || {}).body || {};
  if (!body.name) {
    return _mwError(next, "the name is missing in your request");
  }
  const items = Object.keys(body).map((k) => ({ [k]: body[k] }));
  const err = _validateTokenCreateItems(items.length ? items : []);
  if (err) return _mwError(next, err.msg);
  next();
};

// ── validateTokenUpdate ───────────────────────────────────────────────────────

function _validateTokenUpdateItems(items) {
  if (!items || items.length === 0) return undefined;
  for (const item of items) {
    if ("expires" in item) {
      const exp = item.expires;
      if (!_isValidISO8601(exp)) {
        return { msg: "expires must be a valid datetime." };
      }
      if (_isDateInFuture(exp)) {
        return { msg: "the date should not be before the current date" };
      }
    }
    if ("bypass_anomaly_detection" in item) {
      if (typeof item.bypass_anomaly_detection !== "boolean") {
        return { msg: "bypass_anomaly_detection must be a boolean" };
      }
    }
  }
}

const validateTokenUpdate = (itemsOrReq, res, next) => {
  if (Array.isArray(itemsOrReq)) {
    return _validateTokenUpdateItems(itemsOrReq);
  }
  // middleware mode — check body fields + admin guard for bypass_anomaly_detection
  const req = itemsOrReq || {};
  const b = req.body || {};
  const items = Object.keys(b).map((k) => ({ [k]: b[k] }));
  const err = _validateTokenUpdateItems(items);
  if (err) return _mwError(next, err.msg);

  // Admin check for bypass_anomaly_detection (middleware-only guard)
  if ("bypass_anomaly_detection" in b) {
    if (!req.user) {
      return _mwError(
        next,
        "bypass_anomaly_detection can only be set by administrators"
      );
    }
    const email = (req.user.email || "").toLowerCase();
    const isAdmin = (constants.SUPER_ADMIN_EMAIL_ALLOWLIST || []).some(
      (e) => e.toLowerCase() === email
    );
    if (!isAdmin) {
      return _mwError(
        next,
        "bypass_anomaly_detection can only be set by administrators"
      );
    }
  }
  next();
};

// ── single IP ─────────────────────────────────────────────────────────────────

const validateSingleIp = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const ip = isMW ? (reqOrData.body || {}).ip : (reqOrData || {}).ip;

  if (ip === undefined || ip === null) {
    const msg = "the ip is missing in your request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (ip === "") {
    const msg = "the ip should not be empty if provided";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!_isValidIP(ip)) {
    const msg = "Invalid IP address";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (isMW) return next();
};

// ── multiple IPs ──────────────────────────────────────────────────────────────

const validateMultipleIps = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const ips = isMW ? (reqOrData.body || {}).ips : (reqOrData || {}).ips;

  if (ips === undefined || ips === null) {
    const msg = "the ips are missing in your request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!Array.isArray(ips)) {
    const msg = "the ips should be an array";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (ips.length === 0) {
    const msg = "the ips should not be empty in the request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  for (const ip of ips) {
    if (ip === "" || ip === null || ip === undefined) {
      const msg = "Provided ips should NOT be empty";
      return isMW ? _mwError(next, msg) : { msg };
    }
    if (!_isValidIP(ip)) {
      const msg = "IP address provided must be a valid IP address";
      return isMW ? _mwError(next, msg) : { msg };
    }
  }
  if (isMW) return next();
};

// ── pagination ────────────────────────────────────────────────────────────────

const validatePagination = (req, res, next) => {
  if (!req.query) req.query = {};
  const rawLimit = req.query.limit;
  const rawSkip = req.query.skip;

  let limit = rawLimit !== undefined ? parseInt(rawLimit, 10) : 100;
  let skip = rawSkip !== undefined ? parseInt(rawSkip, 10) : 0;

  if (isNaN(limit)) limit = 100;
  if (limit < 1) limit = 1;
  if (limit > 1000) limit = 1000;

  if (isNaN(skip) || skip < 0) skip = 0;

  req.query.limit = limit;
  req.query.skip = skip;
  next();
};

// ── IP param ──────────────────────────────────────────────────────────────────

const validateIpParam = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const ip = isMW ? (reqOrData.params || {}).ip : (reqOrData || {}).ip;

  if (ip === undefined || ip === null) {
    const msg = "the ip parameter is missing in the request";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (ip === "") {
    const msg = "the ip must not be empty";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!_isValidIP(ip)) {
    const msg = "Invalid IP address";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (isMW) return next();
};

// ── IP range ──────────────────────────────────────────────────────────────────

const validateIpRange = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const range = isMW ? (reqOrData.body || {}).range : (reqOrData || {}).range;

  if (range === undefined || range === null) {
    const msg = "the range is missing in your request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (range === "") {
    const msg = "the range should not be empty if provided";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!_isValidIPRange(range)) {
    const msg = "Invalid IP address";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (isMW) return next();
};

// ── multiple IP ranges ────────────────────────────────────────────────────────

const validateMultipleIpRanges = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const ranges = isMW
    ? (reqOrData.body || {}).ranges
    : (reqOrData || {}).ranges;

  if (ranges === undefined || ranges === null) {
    const msg = "the ranges are missing in your request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!Array.isArray(ranges)) {
    const msg = "the ranges should be an array";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (ranges.length === 0) {
    const msg = "the ranges should not be empty in the request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  for (const range of ranges) {
    if (range === "" || range === null || range === undefined) {
      const msg = "Provided range should NOT be empty";
      return isMW ? _mwError(next, msg) : { msg };
    }
    if (!_isValidIPRange(range)) {
      const msg = "IP address provided must be a valid IP address";
      return isMW ? _mwError(next, msg) : { msg };
    }
  }
  if (isMW) return next();
};

// ── IP range ID param ─────────────────────────────────────────────────────────

const validateIpRangeIdParam = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const id = isMW ? (reqOrData.params || {}).id : (reqOrData || {}).id;

  if (id === undefined || id === null) {
    const msg = "the id param is missing in the request";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (id === "") {
    const msg = "the id cannot be empty when provided";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!_isValidMongoId(id)) {
    const msg = "the id must be an object ID";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (isMW) return next();
};

// ── IP prefix ─────────────────────────────────────────────────────────────────

const validateIpPrefix = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const prefix = isMW
    ? (reqOrData.body || {}).prefix
    : (reqOrData || {}).prefix;

  if (prefix === undefined || prefix === null) {
    const msg = "the prefix is missing in your request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (prefix === "") {
    const msg = "the prefix should not be empty if provided";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!_isValidIPPrefix(prefix)) {
    const msg = "Invalid IP address";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (isMW) return next();
};

// ── multiple IP prefixes ──────────────────────────────────────────────────────

const validateMultipleIpPrefixes = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const prefixes = isMW
    ? (reqOrData.body || {}).prefixes
    : (reqOrData || {}).prefixes;

  if (prefixes === undefined || prefixes === null) {
    const msg = "the prefixes are missing in your request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!Array.isArray(prefixes)) {
    const msg = "the prefixes should be an array";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (prefixes.length === 0) {
    const msg = "the prefixes should not be empty in the request body";
    return isMW ? _mwError(next, msg) : { msg };
  }
  for (const prefix of prefixes) {
    if (prefix === "" || prefix === null || prefix === undefined) {
      const msg = "Provided prefix should NOT be empty";
      return isMW ? _mwError(next, msg) : { msg };
    }
    if (!_isValidIPPrefix(prefix)) {
      const msg = "IP address provided must be a valid IP address";
      return isMW ? _mwError(next, msg) : { msg };
    }
  }
  if (isMW) return next();
};

// ── generic ID param ──────────────────────────────────────────────────────────

const validateIdParam = (reqOrData, res, next) => {
  const isMW = typeof next === "function";
  const id = isMW ? (reqOrData.params || {}).id : (reqOrData || {}).id;

  if (id === undefined || id === null) {
    const msg = "the id param is missing in the request";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (id === "") {
    const msg = "the id cannot be empty when provided";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (!_isValidMongoId(id)) {
    const msg = "the id must be an object ID";
    return isMW ? _mwError(next, msg) : { msg };
  }
  if (isMW) return next();
};

// ─── express-validator-based validators (not unit-tested directly) ─────────────

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
    .withMessage(
      "each CIDR range must be valid IPv4 CIDR notation (e.g. 192.0.2.0/24)"
    ),
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
  createBlockedASN,
  listBlockedASNs,
  deleteBlockedASN,
  listFlaggedTokens,
  resolveFlaggedToken,
};
