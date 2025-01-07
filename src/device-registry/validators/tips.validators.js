const { check, oneOf, query, body } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const isEmpty = require("is-empty");

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
  ],
  list: [
    ...commonValidations.tenant,
    ...commonValidations.optionalId,
    ...commonValidations.language,
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
  ],
  delete: [...commonValidations.tenant, ...commonValidations.id],
};

module.exports = healthTipValidations;
