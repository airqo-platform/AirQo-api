// metadata.validators.js
const {
  oneOf,
  query,
  param,
  body,
  validationResult,
} = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
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
  paramObjectId: (field) => [
    param(field)
      .exists()
      .withMessage(`the ${field} must be provided`)
      .bail()
      .notEmpty()
      .withMessage(`the ${field} should not be empty if provided`)
      .bail()
      .trim()
      .isMongoId()
      .withMessage(`${field} must be an object ID`)
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
};

const metadataValidations = {
  listSites: [
    ...commonValidations.tenant,
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

  getSite: [
    ...commonValidations.tenant,
    ...commonValidations.paramObjectId("site_id"),
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

  listAirQloud: [
    ...commonValidations.tenant,
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

  getAirqloud: [
    ...commonValidations.tenant,
    ...commonValidations.paramObjectId("airqloud_id"),
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
  listGrids: [
    ...commonValidations.tenant,
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

  getGrid: [
    ...commonValidations.tenant,
    ...commonValidations.paramObjectId("grid_id"),
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
  listCohorts: [
    ...commonValidations.tenant,
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

  getCohort: [
    ...commonValidations.tenant,
    ...commonValidations.paramObjectId("cohort_id"),
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

  listDevices: [
    ...commonValidations.tenant,
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

  getDevice: [
    ...commonValidations.tenant,
    ...commonValidations.paramObjectId("device_id"),
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
  findNearestLocations: [
    ...commonValidations.tenant,
    body("polyline")
      .exists()
      .withMessage("polyline is required")
      .bail()
      .isArray({ min: 2 })
      .withMessage("polyline must be an array with at least 2 points"),
    body("polyline.*.lat")
      .exists()
      .withMessage("Each polyline point must have a lat property")
      .bail()
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude value"),
    body("polyline.*.lng")
      .exists()
      .withMessage("Each polyline point must have a lng property")
      .bail()
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude value"),
    body("radius")
      .exists()
      .withMessage("radius is required")
      .bail()
      .isFloat({ min: 0.1, max: 50 })
      .withMessage("radius must be a number in kilometers between 0.1 and 50")
      .toFloat(),
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

module.exports = {
  ...metadataValidations,
  pagination: commonValidations.pagination,
  addCategoryQueryParam: (req, res, next) => {
    req.query.category = "public";
    next();
  },
};
