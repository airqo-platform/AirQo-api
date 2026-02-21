// locations.validators.js
const {
  oneOf,
  query,
  body,
  param,
  validationResult,
} = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const { isValidObjectId } = require("mongoose");
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const createAirQloudUtil = require("@utils/airqloud.util");
const isEmpty = require("is-empty");
const { validateNetwork, validateAdminLevels } = require("@validators/common");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError(
        "Validation error",
        httpStatus.BAD_REQUEST,
        errors.mapped(),
      ),
    );
  }
  next();
};

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant cannot be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],

  pagination: (defaultLimit = 1000, maxLimit = 2000) => {
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

  validObjectId: (field) => {
    return query(field)
      .optional()
      .notEmpty()
      .withMessage("id cannot be empty")
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      });
  },
  name: [
    query("name")
      .optional()
      .notEmpty()
      .withMessage("name cannot be empty")
      .trim(),
  ],
  adminLevel: [
    query("admin_level")
      .optional()
      .notEmpty()
      .withMessage("admin_level is empty, should not be if provided in request")
      .bail()
      .toLowerCase()
      .isIn([
        "village",
        "district",
        "parish",
        "division",
        "county",
        "subcounty",
        "country",
        "state",
        "province",
      ])
      .withMessage(
        "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district",
      ),
  ],

  location: [
    body("location")
      .exists()
      .withMessage("the location is missing in your request")
      .bail()
      .custom((value) => {
        return typeof value === "object";
      })
      .withMessage("the location should be an object")
      .bail()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the location should not be empty when provided"),
    body("location.coordinates")
      .exists()
      .withMessage("location.coordinates is missing in your request")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the location.coordinates should be an array"),
    body("location.type")
      .exists()
      .withMessage("location.type is missing in your request")
      .bail()
      .isIn(["Polygon", "Point"])
      .withMessage(
        "the location.type value is not among the expected ones which include: Polygon and Point",
      ),
  ],
  locationOptional: [
    body("location")
      .optional()
      .custom((value) => {
        return typeof value === "object";
      })
      .withMessage("the location should be an object")
      .bail()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the location should not be empty when provided"),
    body("location.coordinates")
      .optional()
      .notEmpty()
      .withMessage("the location.coordinates should not be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the location.coordinates should be an array"),
    body("location.type")
      .optional()
      .notEmpty()
      .withMessage("the location.type should not be empty")
      .bail()
      .isIn(["Polygon", "Point"])
      .withMessage(
        "the location.type value is not among the expected ones which include: Polygon and Point",
      ),
  ],

  locationTags: [
    body("location_tags")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the tags should be an array")
      .bail()
      .notEmpty()
      .withMessage("the tags should not be empty"),
  ],

  isCustom: [
    body("isCustom")
      .optional()
      .notEmpty()
      .withMessage("isCustom cannot be empty")
      .isBoolean()
      .withMessage("isCustom must be Boolean")
      .trim(),
  ],

  metadata: [
    body("metadata")
      .optional()
      .custom((value) => {
        return typeof value === "object";
      })
      .withMessage("the metadata should be an object")
      .bail()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the metadata should not be empty if provided"),
  ],

  description: [
    body("description")
      .optional()
      .notEmpty()
      .trim(),
  ],

  adminLevelBody: [
    body("admin_level")
      .exists()
      .withMessage("admin_level is is missing in your request")
      .bail()
      .toLowerCase()
      .isIn([
        "village",
        "district",
        "parish",
        "division",
        "county",
        "subcounty",
        "country",
        "state",
        "province",
      ])
      .withMessage(
        "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district",
      ),
  ],
  adminLevelBodyOptional: [
    body("admin_level")
      .optional()
      .notEmpty()
      .withMessage("admin_level is empty, should not be if provided in request")
      .bail()
      .toLowerCase()
      .isIn([
        "village",
        "district",
        "parish",
        "division",
        "county",
        "subcounty",
        "country",
        "state",
        "province",
      ])
      .withMessage(
        "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district",
      ),
  ],

  nameBody: [
    body("name")
      .exists()
      .withMessage("the name is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the name should not be empty")
      .bail()
      .custom((value) => {
        return createAirQloudUtil.initialIsCapital(value);
      })
      .withMessage("the name should start with a capital letter")
      .bail()
      .custom((value) => {
        return createAirQloudUtil.hasNoWhiteSpace(value);
      })
      .withMessage("the name should not have whitespace in it")
      .trim(),
  ],

  nameBodyOptional: [
    body("name")
      .optional()
      .notEmpty()
      .withMessage("the name should not be empty")
      .bail()
      .custom((value) => {
        return createAirQloudUtil.initialIsCapital(value);
      })
      .withMessage("the name should start with a capital letter")
      .bail()
      .custom((value) => {
        return createAirQloudUtil.hasNoWhiteSpace(value);
      })
      .withMessage("the name should not have whitespace in it")
      .trim(),
  ],

  longName: [
    body("long_name")
      .optional()
      .notEmpty()
      .withMessage("the long_name should not be empty")
      .trim(),
  ],
};

const locationValidations = {
  registerLocation: [
    ...commonValidations.tenant,
    ...commonValidations.nameBody,
    ...commonValidations.metadata,
    ...commonValidations.description,
    ...commonValidations.location,
    ...commonValidations.adminLevelBody,
    ...commonValidations.locationTags,
    ...commonValidations.isCustom,
    handleValidationErrors,
  ],

  listLocations: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id"),
      commonValidations.name,
      commonValidations.adminLevel,
    ]),
    handleValidationErrors,
  ],

  updateLocation: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    ...commonValidations.nameBodyOptional,
    ...commonValidations.adminLevelBodyOptional,
    ...commonValidations.description,
    ...commonValidations.metadata,
    ...commonValidations.longName,
    ...commonValidations.isCustom,
    ...commonValidations.locationOptional,
    ...commonValidations.locationTags,
    handleValidationErrors,
  ],

  deleteLocation: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    handleValidationErrors,
  ],
};

module.exports = {
  ...locationValidations,
  pagination: commonValidations.pagination,
};
