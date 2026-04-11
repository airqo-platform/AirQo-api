// network-creation-request.validators.js
const { query, body, param, validationResult } = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const crypto = require("crypto");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Validation error", httpStatus.BAD_REQUEST, errors.mapped())
    );
  }
  next();
};

// Reusable building blocks
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
    .withMessage(`${field} is missing in request`)
    .bail()
    .trim()
    .isMongoId()
    .withMessage(`${field} must be an object ID`)
    .bail()
    .customSanitizer((value) => ObjectId(value));

// Middleware that validates the admin_secret in the request body using
// constant-time comparison to prevent timing attacks.
const requireAdminSecret = (req, res, next) => {
  if (!constants.ADMIN_SETUP_SECRET) {
    return next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: "Admin secret not configured on server",
      })
    );
  }

  const provided = Buffer.from(req.body.admin_secret || "");
  const expected = Buffer.from(constants.ADMIN_SETUP_SECRET);

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return next(
      new HttpError("Forbidden", httpStatus.FORBIDDEN, {
        message: "Invalid admin secret provided",
      })
    );
  }

  next();
};

// ── Validators ────────────────────────────────────────────────────────────────

// Public: anyone can submit a sensor manufacturer creation request
const createRequest = [
  ...tenant,
  body("requester_name")
    .exists()
    .withMessage("requester_name is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("requester_name must not be empty"),
  body("requester_email")
    .exists()
    .withMessage("requester_email is required")
    .bail()
    .trim()
    .isEmail()
    .withMessage("requester_email is not a valid email address")
    .bail()
    .normalizeEmail(),
  body("net_name")
    .exists()
    .withMessage("net_name (sensor manufacturer name) is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("net_name must not be empty"),
  body("net_email")
    .exists()
    .withMessage("net_email is required")
    .bail()
    .trim()
    .isEmail()
    .withMessage("net_email is not a valid email address")
    .bail()
    .normalizeEmail(),
  body("net_website")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("net_website must not be empty if provided")
    .bail()
    .isURL()
    .withMessage("net_website is not a valid URL"),
  body("net_category")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("net_category must not be empty if provided"),
  body("net_description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("net_description must not be empty if provided"),
  body("net_acronym")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("net_acronym must not be empty if provided"),
  handleValidationErrors,
];

// Admin: list all requests
const listRequests = [
  ...tenant,
  query("status")
    .optional()
    .trim()
    .isIn(["pending", "approved", "denied", "under_review"])
    .withMessage(
      "status must be one of: pending, approved, denied, under_review"
    ),
  query("requester_email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("requester_email must be a valid email address"),
  handleValidationErrors,
];

// Anyone can view a single request by ID
const getRequest = [
  ...tenant,
  paramObjectId("request_id"),
  handleValidationErrors,
];

// Admin: approve a request
const approveRequest = [
  ...tenant,
  paramObjectId("request_id"),
  body("admin_secret")
    .exists()
    .withMessage("admin_secret is required")
    .bail()
    .isString()
    .withMessage("admin_secret must be a string")
    .bail()
    .notEmpty()
    .withMessage("admin_secret must not be empty"),
  body("reviewer_notes")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("reviewer_notes must not be empty if provided"),
  body("reviewed_by")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("reviewed_by must not be empty if provided"),
  handleValidationErrors,
  requireAdminSecret,
];

// Admin: deny a request
const denyRequest = [
  ...tenant,
  paramObjectId("request_id"),
  body("admin_secret")
    .exists()
    .withMessage("admin_secret is required")
    .bail()
    .isString()
    .withMessage("admin_secret must be a string")
    .bail()
    .notEmpty()
    .withMessage("admin_secret must not be empty"),
  body("reviewer_notes")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("reviewer_notes must not be empty if provided"),
  body("reviewed_by")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("reviewed_by must not be empty if provided"),
  handleValidationErrors,
  requireAdminSecret,
];

// Admin: mark a request as under review
const reviewRequest = [
  ...tenant,
  paramObjectId("request_id"),
  body("admin_secret")
    .exists()
    .withMessage("admin_secret is required")
    .bail()
    .isString()
    .withMessage("admin_secret must be a string")
    .bail()
    .notEmpty()
    .withMessage("admin_secret must not be empty"),
  body("reviewer_notes")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("reviewer_notes must not be empty if provided"),
  body("reviewed_by")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("reviewed_by must not be empty if provided"),
  handleValidationErrors,
  requireAdminSecret,
];

module.exports = {
  createRequest,
  listRequests,
  getRequest,
  approveRequest,
  denyRequest,
  reviewRequest,
};
