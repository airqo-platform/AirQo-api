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
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
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
    .notEmpty()
    .withMessage("the net_name must not be empty")
    .trim(),
  body("net_email")
    .exists()
    .withMessage("the net_email is required")
    .bail()
    .isEmail()
    .withMessage("the net_email is not a valid email address")
    .trim(),
  body("net_website")
    .optional()
    .notEmpty()
    .withMessage("the net_website must not be empty if provided")
    .bail()
    .isURL()
    .withMessage("the net_website is not a valid URL")
    .trim(),
  body("net_category")
    .optional()
    .notEmpty()
    .withMessage("the net_category must not be empty if provided")
    .trim(),
  body("net_description")
    .optional()
    .notEmpty()
    .withMessage("the net_description must not be empty if provided")
    .trim(),
  handleValidationErrors,
];

const updateNetwork = [
  ...tenant,
  paramObjectId("net_id"),
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
