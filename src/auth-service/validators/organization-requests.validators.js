// validators/organization-requests.validators.js
const { body, param, query, validationResult } = require("express-validator");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

const validationMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

module.exports = {
  pagination,

  create: [
    body("organization_name")
      .trim()
      .notEmpty()
      .withMessage("Organization name is required"),
    body("organization_slug")
      .trim()
      .notEmpty()
      .withMessage("Organization slug is required")
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase alphanumeric with hyphens only"),
    body("contact_email")
      .trim()
      .notEmpty()
      .withMessage("Contact email is required")
      .isEmail()
      .withMessage("Must be a valid email"),
    body("contact_name")
      .trim()
      .notEmpty()
      .withMessage("Contact name is required"),
    body("use_case").trim().notEmpty().withMessage("Use case is required"),
    body("organization_type")
      .trim()
      .notEmpty()
      .withMessage("Organization type is required")
      .isIn(["academic", "government", "ngo", "private", "other"])
      .withMessage("Invalid organization type"),
    validationMiddleware,
  ],

  list: [
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected"])
      .withMessage("Invalid status"),
    validationMiddleware,
  ],

  approve: [
    param("request_id").isMongoId().withMessage("Invalid request ID"),
    validationMiddleware,
  ],

  reject: [
    param("request_id").isMongoId().withMessage("Invalid request ID"),
    body("rejection_reason")
      .trim()
      .notEmpty()
      .withMessage("Rejection reason is required"),
    validationMiddleware,
  ],

  getById: [
    param("request_id").isMongoId().withMessage("Invalid request ID"),
    validationMiddleware,
  ],
};
