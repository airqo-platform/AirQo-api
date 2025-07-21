// feeds.validators.js
const { oneOf, query, param, validationResult } = require("express-validator");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

const commonValidations = {
  timeRange: [
    query("start")
      .optional()
      .notEmpty()
      .withMessage("start date cannot be empty if provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("start date must be a valid datetime.")
      .toDate(),
    query("end")
      .optional()
      .notEmpty()
      .withMessage("end date cannot be empty if provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("end date must be a valid datetime.")
      .toDate(),
  ],

  channel: [
    query("channel")
      .exists()
      .withMessage(
        "the channel query parameter must always be available in the request"
      )
      .notEmpty()
      .withMessage("the channel query parameter cannot be empty in the request")
      .bail()
      .isNumeric()
      .withMessage("the channel must be a number")
      .trim(),
  ],
};

const feedsValidations = {
  getLastFeed: [
    param("ch_id")
      .exists()
      .withMessage("the channel ID is missing in the request params")
      .bail()
      .notEmpty()
      .withMessage("the channel ID cannot be empty")
      .bail()
      .trim()
      .isNumeric()
      .withMessage("the channel ID must be a number"),

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped()
          )
        );
      }
      next();
    },
  ],
  generateDescriptiveLastEntry: [
    ...commonValidations.channel,
    ...commonValidations.timeRange,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "Validation error",
            httpStatus.BAD_REQUEST,
            errors.mapped()
          )
        );
      }
      next();
    },
  ],
};

module.exports = feedsValidations;
