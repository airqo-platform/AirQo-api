// airqlouds.validators.js
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
const isEmpty = require("is-empty");
const { validateNetwork, validateAdminLevels } = require("@validators/common");

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant cannot be empty if provided")
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
  longName: [
    body("long_name")
      .exists()
      .withMessage("the long_name is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the long_name should not be empty")
      .trim(),
  ],

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
      .custom(async (value) => {
        try {
          await validateAdminLevels(value);
          return true;
        } catch (error) {
          throw new Error(
            "admin_level values include but not limited to: province, state, village, county, etc. Update your GLOBAL configs"
          );
        }
      }),
  ],

  location: [
    body("location")
      .exists()
      .withMessage(
        "location details are missing in your request, consider using location"
      )
      .bail()
      .custom((value) => {
        return typeof value === "object";
      })
      .withMessage("the location should be an object")
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
      .withMessage("location.type is is missing in your request")
      .bail()
      .isIn(["Polygon", "Point"])
      .withMessage(
        "the location.type value is not among the expected ones which include: Polygon and Point"
      ),
  ],

  locationId: [
    body("location_id")
      .exists()
      .withMessage(
        "location details are missing in your request, consider using location_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("location_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  sites: [
    body("sites")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the sites should be an array")
      .bail()
      .notEmpty()
      .withMessage("the sites should not be empty"),
    body("sites.*")
      .optional()
      .isMongoId()
      .withMessage("each site should be a mongo ID"),
  ],

  airqloudTags: [
    body("airqloud_tags")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the tags should be an array")
      .bail()
      .notEmpty()
      .withMessage("the tags should not be empty"),
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

  isCustom: [
    body("isCustom")
      .optional()
      .notEmpty()
      .withMessage("isCustom cannot be empty")
      .isBoolean()
      .withMessage("isCustom must be Boolean")
      .trim(),
  ],

  description: [
    body("description")
      .optional()
      .notEmpty()
      .trim(),
  ],

  visibility: [
    body("visibility")
      .optional()
      .notEmpty()
      .withMessage("visibility cannot be empty IF provided")
      .bail()
      .trim()
      .isBoolean()
      .withMessage("visibility must be Boolean"),
  ],

  coordinates: [
    body("coordinates")
      .exists()
      .withMessage(
        "a required field is missing in your request body, consider using coordinates"
      )
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage(
        "the coordinates should be an array or arrays, each containing a pair of coordinates"
      )
      .notEmpty()
      .withMessage("the coordinates cannot be empty"),
  ],
};

const airqloudValidations = {
  createAirqloud: [
    ...commonValidations.tenant,
    oneOf([commonValidations.locationId, commonValidations.location]),
    ...commonValidations.longName,
    ...commonValidations.metadata,
    ...commonValidations.isCustom,
    ...commonValidations.description,
    ...commonValidations.adminLevel,
    ...commonValidations.airqloudTags,
    ...commonValidations.sites,
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
  refreshAirqloud: [
    ...commonValidations.tenant,
    oneOf([commonValidations.validObjectId("id"), commonValidations.name]),
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
  listAirqlouds: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id"),
      commonValidations.name,
      commonValidations.adminLevel,
    ]),
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

  listAirqloudsSummary: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id"),
      commonValidations.name,
      commonValidations.adminLevel,
    ]),
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

  listAirqloudsDashboard: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id"),
      commonValidations.name,
      commonValidations.adminLevel,
    ]),
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

  getAirqloudSites: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id"),
      commonValidations.name,
      commonValidations.adminLevel,
    ]),
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
  updateAirqloud: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    ...commonValidations.name,
    ...commonValidations.visibility,
    ...commonValidations.adminLevel,
    ...commonValidations.description,
    ...commonValidations.sites,
    ...commonValidations.metadata,
    ...commonValidations.longName,
    ...commonValidations.isCustom,
    ...commonValidations.location,
    ...commonValidations.airqloudTags,
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
  deleteAirqloud: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
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
  getAirqloudCenter: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id"),
      commonValidations.name,
      ...commonValidations.coordinates,
      commonValidations.adminLevel,
    ]),
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

  listCombinedAirqloudsSummary: [
    ...commonValidations.tenant,
    param("net_id")
      .exists()
      .withMessage("the network ID param is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the network ID cannot be empty"),
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
  listGroupAirqloudsSummary: [
    ...commonValidations.tenant,
    param("group_id")
      .exists()
      .withMessage("the group ID param is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the group ID cannot be empty"),
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
  listCombinedAirqlouds: [
    ...commonValidations.tenant,
    param("net_id")
      .exists()
      .withMessage("the network is is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the network should not be empty"),
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

  listGroupAirqlouds: [
    ...commonValidations.tenant,
    param("group_id")
      .exists()
      .withMessage("the group is is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the group should not be empty"),
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
  ...airqloudValidations,
  pagination: commonValidations.pagination,
};
