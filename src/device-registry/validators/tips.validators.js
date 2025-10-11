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

// Centralized AQI Range Configuration
const AQI_RANGES = constants.AQI_RANGES;

// Export AQI_RANGES so they can be used in other files if needed
module.exports.AQI_RANGES = AQI_RANGES;

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
          // Skip validation if title isn't provided (for mass updates)
          if (!update.tips.some((tip) => tip.title)) continue;

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
      .bail()
      .custom((aqi_category) => {
        // Validate against predefined AQI ranges
        const { min, max } = aqi_category;
        const isValidRange = Object.values(AQI_RANGES).some(
          (range) =>
            Math.abs(range.min - min) < 0.001 && // Using small epsilon for float comparison
            ((range.max === null && max === null) ||
              (range.max !== null &&
                max !== null &&
                Math.abs(range.max - max) < 0.001))
        );

        if (!isValidRange) {
          throw new Error(
            `Invalid AQI range: min=${min}, max=${max}. Must match one of the predefined ranges.`
          );
        }
        return true;
      }),
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
      .custom((value) => {
        // Allow null for the max value of the hazardous range
        return value === null || typeof value === "number";
      })
      .withMessage("aqi_category.max must be a number or null")
      .custom((value, { req }) => {
        // Skip this validation if max is null
        if (value === null) return true;

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
        // Custom validation to check for duplicate title only if title is provided
        const seen = new Set();
        for (const tip of tips) {
          // Skip validation if title isn't provided (for mass updates)
          if (!tip.title) continue;

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
      .optional() // Make title optional for mass updates
      .notEmpty()
      .withMessage("title cannot be empty if provided")
      .trim(),
    body("updates.*.tips.*.tag_line")
      .exists()
      .withMessage("tag_line is required")
      .bail()
      .notEmpty()
      .withMessage("tag_line cannot be empty")
      .trim(),
    body("updates.*.tips.*.tag_line")
      .optional()
      .notEmpty()
      .withMessage("tag_line cannot be empty if provided")
      .trim(),
    body("updates.*.tips.*.description")
      .optional() // Make description optional for partial updates
      .notEmpty()
      .withMessage("description cannot be empty if provided")
      .trim(),
    body("updates.*.tips.*.image")
      .optional() // Make image optional for updates
      .notEmpty()
      .withMessage("image cannot be empty if provided")
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
    query("sortBy")
      .optional()
      .notEmpty()
      .trim(),
    query("order")
      .optional()
      .notEmpty()
      .trim()
      .toLowerCase()
      .isIn(["asc", "desc"])
      .withMessage("the order value is not among the expected ones"),
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
