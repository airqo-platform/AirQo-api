const { query, validationResult } = require("express-validator");
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map((err) => extractedErrors.push({ [err.param]: err.msg }));

  return next(
    new HttpError(
      "bad request errors",
      httpStatus.BAD_REQUEST,
      extractedErrors,
    ),
  );
};

const healthValidators = {
  check: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant cannot be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
    validate,
  ],
  getJobMetrics: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant cannot be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
    validate,
  ],
};

module.exports = healthValidators;
