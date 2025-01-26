// metadata.validators.js
const { oneOf, query, param, validationResult } = require("express-validator");
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
      if (isNaN(limit) || limit < 1) {
        limit = defaultLimit;
      }
      if (limit > maxLimit) {
        limit = maxLimit;
      }
      if (isNaN(skip) || skip < 0) {
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
};

module.exports = {
  ...metadataValidations,
  pagination: commonValidations.pagination,
  addCategoryQueryParam: (req, res, next) => {
    req.query.category = "public";
    next();
  },
};
