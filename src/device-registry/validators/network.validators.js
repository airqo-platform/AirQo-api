// network.validators.js
const { query, body, param, validationResult } = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Validation error", httpStatus.BAD_REQUEST, errors.mapped())
    );
  }
  next();
};

// Reusable building blocks (mirrors the pattern in cohorts.validators.js)
const tenant = [
  query("tenant")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .toLowerCase()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
];

const paramObjectId = (field) =>
  param(field)
    .exists()
    .withMessage(`the ${field} is missing in request`)
    .bail()
    .trim()
    .isMongoId()
    .withMessage(`${field} must be an object ID`)
    .bail()
    .customSanitizer((value) => ObjectId(value));

// ── Network validators ────────────────────────────────────────────────────────

const createNetwork = [
  ...tenant,
  body("admin_secret")
    .exists()
    .withMessage("the admin secret is required")
    .bail()
    .isString()
    .withMessage("the admin secret must be a string")
    .bail()
    .notEmpty()
    .withMessage("the admin secret should not be empty"),
  body("net_name")
    .exists()
    .withMessage("the net_name is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("the net_name must not be empty"),
  body("net_email")
    .exists()
    .withMessage("the net_email is required")
    .bail()
    .trim()
    .isEmail()
    .withMessage("the net_email is not a valid email address"),
  body("net_website")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("the net_website must not be empty if provided")
    .bail()
    .isURL()
    .withMessage("the net_website is not a valid URL"),
  body("net_category")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("the net_category must not be empty if provided"),
  body("net_description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("the net_description must not be empty if provided"),
  handleValidationErrors,
];

const UPDATABLE_NETWORK_FIELDS = new Set([
  "net_name",
  "net_acronym",
  "net_status",
  "net_email",
  "net_website",
  "net_category",
  "net_description",
  "net_profile_picture",
  "net_manager",
  "net_manager_username",
  "net_manager_firstname",
  "net_manager_lastname",
  "net_data_source",
  "net_api_key",
  "adapter",
]);

const rejectUnknownBodyFields = (req, res, next) => {
  const keys = Object.keys(req.body || {});
  const unknown = keys.filter((k) => !UPDATABLE_NETWORK_FIELDS.has(k));
  const dangerous = keys.filter((k) => k.startsWith("$") || k.includes("."));
  const rejected = [...new Set([...unknown, ...dangerous])];
  if (rejected.length > 0) {
    return next(
      new HttpError("Validation error", httpStatus.BAD_REQUEST, {
        body: {
          msg: `Unknown or disallowed fields: ${rejected.join(", ")}`,
          value: rejected,
        },
      })
    );
  }
  next();
};

const updateNetwork = [
  ...tenant,
  paramObjectId("net_id"),
  rejectUnknownBodyFields,
  handleValidationErrors,
];

const deleteNetwork = [
  ...tenant,
  paramObjectId("net_id"),
  handleValidationErrors,
];

const listNetworks = [...tenant, handleValidationErrors];

const getNetwork = [
  ...tenant,
  paramObjectId("net_id"),
  handleValidationErrors,
];

module.exports = {
  createNetwork,
  updateNetwork,
  deleteNetwork,
  listNetworks,
  getNetwork,
};
