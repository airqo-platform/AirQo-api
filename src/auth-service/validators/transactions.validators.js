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
  transactionId: [
    param("id")
      .exists()
      .withMessage("transaction ID is missing in request")
      .trim()
      .notEmpty()
      .withMessage("transaction ID cannot be empty")
      .isMongoId()
      .withMessage("transaction ID must be a valid ObjectId")
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
  pagination: (defaultLimit = 100, maxLimit = 1000) => {
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

const transactionValidations = {
  checkout: oneOf([
    ...commonValidations.tenant,
    ...commonValidations.currency,
    body("amount")
      .exists()
      .withMessage("amount is missing in request")
      .isNumeric()
      .withMessage("amount must be a number")
      .isFloat({ min: 0.01 })
      .withMessage("amount must be greater than 0"),
  ]),

  subscription: oneOf([
    ...commonValidations.tenant,
    body("plan_id")
      .exists()
      .withMessage("plan_id is missing in request")
      .isMongoId()
      .withMessage("plan_id must be a valid ObjectId")
      .customSanitizer((value) => ObjectId(value)),
    body("customer_id")
      .exists()
      .withMessage("customer_id is missing in request")
      .isMongoId()
      .withMessage("customer_id must be a valid ObjectId")
      .customSanitizer((value) => ObjectId(value)),
  ]),

  dynamicPrice: oneOf([
    ...commonValidations.tenant,
    ...commonValidations.currency,
    body("base_amount")
      .exists()
      .withMessage("base_amount is missing in request")
      .isNumeric()
      .withMessage("base_amount must be a number")
      .isFloat({ min: 0.01 })
      .withMessage("base_amount must be greater than 0"),
  ]),

  history: oneOf([
    ...commonValidations.tenant,
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
    query("status")
      .optional()
      .isIn(["pending", "completed", "failed", "cancelled"])
      .withMessage("invalid status value"),
  ]),

  idOperation: oneOf([
    ...commonValidations.tenant,
    ...commonValidations.transactionId,
  ]),
  tenantOperation: oneOf([...commonValidations.tenant]),
};

module.exports = {
  ...transactionValidations,
  pagination: commonValidations.pagination,
};
