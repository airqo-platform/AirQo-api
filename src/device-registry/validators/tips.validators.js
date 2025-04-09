const {
  check,
  oneOf,
  query,
  body,
  validationResult,
} = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const isEmpty = require("is-empty");
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

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("the tenant cannot be empty, if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ],
  pagination: (defaultLimit = 1000, maxLimit = 2000) => {
    // Add pagination here
    return (req, res, next) => {
      let limit = parseInt(req.query.limit, 10);
      const skip = parseInt(req.query.skip, 10);
      if (Number.isNaN(limit) || limit < 1) {
        limit = defaultLimit;
      }
      if (limit > maxLimit) {
        limit = maxLimit;
      }
      if (Number.isNaN(skip) || skip < 0) {
        req.query.skip = 0;
      }
      req.query.limit = limit;
      req.query.skip = skip;
      next();
    };
  },
  id: [
    query("id")
      .exists()
      .withMessage("the tip identifier is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  optionalId: [
    query("id")
      .optional()
      .notEmpty()
      .withMessage("this tip identifier cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  language: [
    query("language")
      .optional()
      .notEmpty()
      .withMessage("the language cannot be empty when provided")
      .bail()
      .trim(),
  ],
};

const healthTipValidations = {
  bulkUpdate: [
    ...commonValidations.tenant,
    body("updates")
      .exists()
      .withMessage("the updates array is missing in request")
      .bail()
      .isArray()
      .withMessage("updates must be an array")
      .bail()
      .notEmpty()
      .withMessage("updates array cannot be empty")
      .custom((updates) => {
        // Custom validation to check for duplicate title and aqi_category within the updates array
        const seen = new Set();
        for (const update of updates) {
          const key = `${update.title}-${JSON.stringify(update.aqi_category)}`;
          if (seen.has(key)) {
            throw new Error(
              `Duplicate title "${
                update.title
              }" and aqi_category "${JSON.stringify(
                update.aqi_category
              )}" found within the updates array`
            );
          }
          seen.add(key);
        }
        return true;
      }),
    body("updates.*.aqi_category")
      .exists()
      .withMessage("aqi_category is required for each update")
      .bail()
      .isObject()
      .withMessage("aqi_category must be an object")
      .bail(),
    body("updates.*.aqi_category.min")
      .exists()
      .withMessage("aqi_category.min is required")
      .bail()
      .isNumeric()
      .withMessage("aqi_category.min must be a number"),
    body("updates.*.aqi_category.max")
      .exists()
      .withMessage("aqi_category.max is required")
      .bail()
      .isNumeric()
      .withMessage("aqi_category.max must be a number")
      .custom((value, { req }) => {
        if (
          value <=
          req.body.updates[
            req.body.updates.indexOf(
              req.body.updates.find(
                (update) => update.aqi_category.max === value
              )
            )
          ].aqi_category.min
        ) {
          throw new Error("max value must be greater than min value");
        }
        return true;
      }),
    body("updates.*.tips")
      .exists()
      .withMessage("tips array is required for each update")
      .bail()
      .isArray()
      .withMessage("tips must be an array")
      .bail()
      .notEmpty()
      .withMessage("tips array cannot be empty")
      .custom((tips, { req, location, path }) => {
        // Custom validation to check for duplicate title and aqi_category within the tips array
        const seen = new Set();
        for (const tip of tips) {
          const updateIndex = req.body.updates.indexOf(
            req.body.updates.find((update) => update.tips === tips)
          );
          const key = `${tip.title}-${JSON.stringify(
            req.body.updates[updateIndex].aqi_category
          )}`;
          if (seen.has(key)) {
            throw new Error(
              `Duplicate title "${
                tip.title
              }" and aqi_category "${JSON.stringify(
                req.body.updates[updateIndex].aqi_category
              )}" found within the tips array`
            );
          }
          seen.add(key);
        }
        return true;
      }),
    body("updates.*.tips.*.title")
      .exists()
      .withMessage("title is required for each tip")
      .bail()
      .notEmpty()
      .withMessage("title cannot be empty")
      .trim(),
    body("updates.*.tips.*.tag_line")
      .optional()
      .notEmpty()
      .withMessage("tag_line cannot be empty if provided")
      .trim(),
    body("updates.*.tips.*.description")
      .exists()
      .withMessage("description is required for each tip")
      .bail()
      .notEmpty()
      .withMessage("description cannot be empty")
      .trim(),
    body("updates.*.tips.*.image")
      .optional()
      .notEmpty()
      .withMessage("image cannot be empty")
      .trim(),
    handleValidationErrors,
  ],
  create: [
    ...commonValidations.tenant,
    body("description")
      .exists()
      .withMessage("the description is missing in request")
      .bail()
      .trim(),
    body("title")
      .exists()
      .withMessage("the title is missing in request")
      .bail()
      .trim(),
    body("image")
      .exists()
      .withMessage("the image is missing in request")
      .bail()
      .trim(),
    body("aqi_category")
      .exists()
      .withMessage("the aqi_category is missing in request")
      .bail()
      .isObject()
      .withMessage("aqi_category must be an object")
      .bail(),
    body("aqi_category.min")
      .exists()
      .withMessage("aqi_category.min is required")
      .bail()
      .isNumeric()
      .withMessage("aqi_category.min must be a number"),
    body("aqi_category.max")
      .exists()
      .withMessage("aqi_category.max is required")
      .bail()
      .isNumeric()
      .withMessage("aqi_category.max must be a number")
      .custom((value, { req }) => {
        if (value <= req.body.aqi_category.min) {
          throw new Error("max value must be greater than min value");
        }
        return true;
      }),
    body("tag_line")
      .exists()
      .withMessage("Tag line is required")
      .bail()
      .notEmpty()
      .withMessage("Tag line cannot be empty")
      .trim(),
    handleValidationErrors,
  ],
  list: [
    ...commonValidations.tenant,
    ...commonValidations.optionalId,
    ...commonValidations.language,
    handleValidationErrors,
  ],
  update: [
    ...commonValidations.tenant,
    ...commonValidations.id,
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
    body("description")
      .optional()
      .notEmpty()
      .withMessage("the description cannot be empty if provided")
      .bail()
      .trim(),
    body("title")
      .optional()
      .notEmpty()
      .withMessage("the title cannot be empty if provided")
      .bail()
      .trim(),
    body("image")
      .optional()
      .notEmpty()
      .withMessage("the image cannot be empty if provided")
      .bail()
      .trim(),
    body("aqi_category")
      .optional()
      .notEmpty()
      .withMessage("the aqi_category cannot be empty if provided")
      .bail()
      .isObject()
      .withMessage("aqi_category must be an object")
      .bail(),
    body("aqi_category.min")
      .optional()
      .isNumeric()
      .withMessage("aqi_category.min must be a number"),
    body("aqi_category.max")
      .optional()
      .isNumeric()
      .withMessage("aqi_category.max must be a number")
      .custom((value, { req }) => {
        if (
          req.body.aqi_category &&
          req.body.aqi_category.min &&
          value <= req.body.aqi_category.min
        ) {
          throw new Error("max value must be greater than min value");
        }
        return true;
      }),
    body("tag_line")
      .optional()
      .notEmpty()
      .withMessage("Tag line cannot be empty if provided")
      .trim(),
    handleValidationErrors,
  ],
  delete: [
    ...commonValidations.tenant,
    ...commonValidations.id,
    handleValidationErrors,
  ],
};

const tipsValidations = {
  createTip: healthTipValidations.create,
  listTips: healthTipValidations.list,
  updateTip: healthTipValidations.update,
  deleteTip: healthTipValidations.delete,
  pagination: commonValidations.pagination,
  bulkUpdateTips: healthTipValidations.bulkUpdate,
};

module.exports = tipsValidations;
