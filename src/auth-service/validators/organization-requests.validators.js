// validators/organization-requests.validators.js
const { body, param, query, validationResult } = require("express-validator");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

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
      .bail()
      .isIn(constants.VALID_ORGANIZATION_TYPES)
      .withMessage(
        `Invalid organization type. Valid types are: ${constants.VALID_ORGANIZATION_TYPES.join(
          ", "
        )}`
      ),
  ],

  list: [
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected"])
      .withMessage("Invalid status"),
  ],

  approve: [param("request_id").isMongoId().withMessage("Invalid request ID")],

  reject: [
    param("request_id").isMongoId().withMessage("Invalid request ID"),
    body("rejection_reason")
      .trim()
      .notEmpty()
      .withMessage("Rejection reason is required"),
  ],

  getById: [param("request_id").isMongoId().withMessage("Invalid request ID")],
};
