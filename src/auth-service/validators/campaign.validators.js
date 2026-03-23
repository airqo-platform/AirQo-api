const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],
  campaignId: [
    param("id")
      .exists()
      .withMessage("campaign ID is missing in request")
      .trim()
      .notEmpty()
      .withMessage("campaign ID cannot be empty")
      .isMongoId()
      .withMessage("campaign ID must be a valid ObjectId")
      .customSanitizer((value) => ObjectId(value)),
  ],
  currency: [
    body("currency")
      .exists()
      .withMessage("currency is missing in request")
      .isString()
      .withMessage("currency must be a string")
      .isLength({ min: 3, max: 3 })
      .withMessage("currency must be a 3-letter ISO code"),
  ],
  pagination: (defaultLimit = 20, maxLimit = 100) => {
    return (req, res, next) => {
      const limit = parseInt(req.query.limit, 10);
      const skip = parseInt(req.query.skip, 10);
      req.query.limit =
        Number.isNaN(limit) || limit < 1
          ? defaultLimit
          : Math.min(limit, maxLimit);
      req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
      next();
    };
  },
};

const campaignValidations = {
  create: oneOf([
    ...commonValidations.tenant,
    ...commonValidations.currency,
    body("title")
      .exists()
      .withMessage("title is missing in request")
      .isString()
      .withMessage("title must be a string")
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage("title must be between 3 and 100 characters"),
    body("description")
      .exists()
      .withMessage("description is missing in request")
      .isString()
      .withMessage("description must be a string")
      .trim()
      .isLength({ min: 10 })
      .withMessage("description must be at least 10 characters"),
    body("target_amount")
      .exists()
      .withMessage("target_amount is missing in request")
      .isNumeric()
      .withMessage("target_amount must be a number")
      .isFloat({ min: 0.01 })
      .withMessage("target_amount must be greater than 0"),
    body("start_date")
      .exists()
      .withMessage("start_date is missing in request")
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    body("end_date")
      .exists()
      .withMessage("end_date is missing in request")
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.start_date)) {
          throw new Error("end_date must be after start_date");
        }
        return true;
      }),
    body("category")
      .exists()
      .withMessage("category is missing in request")
      .isIn(["environment", "education", "health", "technology", "other"])
      .withMessage("invalid category value"),
  ]),

  update: oneOf([
    ...commonValidations.tenant,
    ...commonValidations.campaignId,
    body("title")
      .optional()
      .isString()
      .withMessage("title must be a string")
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage("title must be between 3 and 100 characters"),
    body("description")
      .optional()
      .isString()
      .withMessage("description must be a string")
      .trim()
      .isLength({ min: 10 })
      .withMessage("description must be at least 10 characters"),
    body("status")
      .optional()
      .isIn(["draft", "active", "paused", "completed", "cancelled"])
      .withMessage("invalid status value"),
  ]),

  list: oneOf([
    ...commonValidations.tenant,
    query("category")
      .optional()
      .isIn(["environment", "education", "health", "technology", "other"])
      .withMessage("invalid category value"),
    query("status")
      .optional()
      .isIn(["draft", "active", "paused", "completed", "cancelled"])
      .withMessage("invalid status value"),
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (req.query.start_date && value < req.query.start_date) {
          throw new Error("end_date must be after start_date");
        }
        return true;
      }),
  ]),

  createUpdate: oneOf([
    ...commonValidations.tenant,
    ...commonValidations.campaignId,
    body("title")
      .exists()
      .withMessage("update title is missing in request")
      .isString()
      .withMessage("title must be a string")
      .trim()
      .isLength({ min: 3, max: 100 }),
    body("content")
      .exists()
      .withMessage("update content is missing in request")
      .isString()
      .withMessage("content must be a string")
      .trim()
      .isLength({ min: 10 }),
  ]),

  idOperation: oneOf([
    ...commonValidations.tenant,
    ...commonValidations.campaignId,
  ]),

  tenantOperation: oneOf([...commonValidations.tenant]),
};

module.exports = {
  ...campaignValidations,
  pagination: commonValidations.pagination,
};
