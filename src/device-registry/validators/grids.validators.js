// grids.validators.js
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
const { HttpError, logText } = require("@utils/shared");
const httpStatus = require("http-status");
const { validateNetwork, validateAdminLevels } = require("@validators/common");

const validateCoordinate = (coordinate) => {
  const [longitude, latitude] = coordinate;
  if (
    typeof latitude !== "number" ||
    Number.isNaN(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    logText("Invalid latitude coordinate");
    throw new Error("Invalid latitude coordinate");
  }
  if (
    typeof longitude !== "number" ||
    Number.isNaN(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    logText("Invalid longitude coordinate");
    throw new Error("Invalid longitude coordinate");
  }
};

const validatePolygonCoordinates = (value) => {
  if (!Array.isArray(value)) {
    throw new Error("Coordinates must be provided as an array");
  }
  if (value.length === 0) {
    throw new Error("At least one polygon must be provided");
  }
  for (const polygon of value) {
    if (!Array.isArray(polygon)) {
      throw new Error(
        "Each polygon must be provided as an array of coordinates"
      );
    }
    if (polygon.length < 4) {
      throw new Error("Each polygon must have at least four coordinates");
    }
    for (const coordinate of polygon) {
      validateCoordinate(coordinate);
    }
  }
  return true;
};

const validateMultiPolygonCoordinates = (value) => {
  if (!Array.isArray(value)) {
    throw new Error("Coordinates must be provided as an array");
  }
  if (value.length === 0) {
    throw new Error("At least one multipolygon must be provided");
  }
  for (const multipolygon of value) {
    validatePolygonCoordinates(multipolygon);
  }
  return true;
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
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ],

  pagination: (defaultLimit = 1000, maxLimit = 2000) => {
    return (req, res, next) => {
      // ... pagination logic (same as before)
    };
  },

  name: [
    body("name")
      .exists()
      .withMessage("name should be provided")
      .bail()
      .notEmpty()
      .withMessage("The name should not be empty")
      .trim()
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the name can only contain letters, numbers, spaces, hyphens and underscores"
      ),
  ],

  nameQuery: [
    query("name")
      .optional()
      .notEmpty()
      .withMessage("name cannot be empty")
      .trim()
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the name can only contain letters, numbers, spaces, hyphens and underscores"
      ),
  ],

  adminLevel: [
    body("admin_level")
      .exists()
      .withMessage("admin_level should be provided")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("admin_level should not be empty")
      .bail()
      .toLowerCase()
      .custom(validateAdminLevels)
      .withMessage(
        "admin_level values include but not limited to: province, state, village, county, etc. Update your GLOBAL configs"
      ),
  ],

  adminLevelQuery: [
    query("admin_level")
      .optional()
      .notEmpty()
      .withMessage("admin_level is empty, should not be if provided in request")
      .bail()
      .toLowerCase()
      .custom(validateAdminLevels)
      .withMessage(
        "admin_level values include but not limited to: province, state, village, county, etc. Update your GLOBAL configs"
      ),
  ],

  validObjectId: (field) => {
    return query(field)
      .optional()
      .if(query(field).exists())
      .notEmpty()
      .withMessage("id cannot be empty")
      .isMongoId()
      .withMessage("id must be an object ID");
  },

  paramObjectId: (field, location = param) => {
    return location(field)
      .exists()
      .withMessage(`the ${field} is missing in request`)
      .bail()
      .trim()
      .isMongoId()
      .withMessage(`${field} must be an object ID`)
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      });
  },

  shape: [
    body("shape")
      .exists()
      .withMessage("shape should be provided")
      .bail()
      .notEmpty()
      .withMessage("shape should not be empty")
      .bail()
      .isObject()
      .withMessage("shape must be an object"),

    body("shape.type")
      .exists()
      .withMessage("shape.type should be provided")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("shape.type should not be empty")
      .bail()
      .isIn(["Polygon", "MultiPolygon"])
      .withMessage("the shape type must either be Polygon or MultiPolygon"),
    body("shape.coordinates")
      .exists()
      .withMessage("shape.coordinates should be provided")
      .bail()
      .custom((value, { req }) => {
        const shapeType = req.body.shape.type;
        if (shapeType === "Polygon") {
          return validatePolygonCoordinates(value);
        } else if (shapeType === "MultiPolygon") {
          return validateMultiPolygonCoordinates(value);
        }
        return true;
      }),
  ],

  description: [
    body("description")
      .optional()
      .notEmpty()
      .withMessage("the description should not be empty if provided"),
  ],

  groups: [
    body("groups")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the groups should be an array")
      .bail()
      .notEmpty()
      .withMessage("the groups should not be empty"),
  ],

  network: [
    body("network")
      .trim()
      .optional()
      .notEmpty()
      .withMessage("the network should not be empty IF provided")
      .bail()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the network value is not among the expected ones"),
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

  latitude: [
    body("latitude")
      .trim()
      .exists()
      .withMessage("The latitude is missing")
      .bail()
      .notEmpty()
      .withMessage("The latitude should not be empty")
      .bail()
      .toFloat()
      .isFloat({ min: -90, max: 90 })
      .withMessage("The latitude must be a valid number between -90 and 90"),
  ],
  longitude: [
    body("longitude")
      .trim()
      .exists()
      .withMessage("The longitude is missing")
      .bail()
      .notEmpty()
      .withMessage("The longitude should not be empty")
      .bail()
      .toFloat()
      .isFloat({ min: -180, max: 180 })
      .withMessage("The longitude must be a valid number between -180 and 180"),
  ],
};

const gridsValidations = {
  createGrid: [
    ...commonValidations.tenant,
    ...commonValidations.name,
    ...commonValidations.shape,
    ...commonValidations.adminLevel,
    ...commonValidations.description,
    ...commonValidations.groups,
    ...commonValidations.network,
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
    oneOf([
      commonValidations.validObjectId("id"),
      commonValidations.nameQuery,
      commonValidations.adminLevelQuery,
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
  listGridSummary: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    commonValidations.nameQuery,
    commonValidations.adminLevelQuery,
  ],
  deleteGrid: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("grid_id"),
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
  updateGrid: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("grid_id"),
    ...commonValidations.name,
    ...commonValidations.description,
    ...commonValidations.groups,
    ...commonValidations.network,
    ...commonValidations.visibility,
    ...commonValidations.adminLevel,
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

  refreshGrid: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("grid_id"),
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

  getSiteAndDeviceIds: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("grid_id"),
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

  listAssignedSites: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("grid_id"),
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
  listAvailableSites: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("grid_id"),
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
  createGridFromShapefile: [],
  findGridUsingGPSCoordinates: [
    ...commonValidations.latitude,
    ...commonValidations.longitude,

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
  filterNonPrivateSites: [
    ...commonValidations.tenant,
    body().custom((value) => {
      if (!value) {
        return false;
      }
      const fields = ["sites", "site_ids", "site_names"];
      const presentFields = fields.filter((field) => value[field]);
      if (presentFields.length > 1 || presentFields.length === 0) {
        throw new Error(
          "Only one of sites, site_ids, or site_names should be provided"
        );
      }
      return true;
    }),

    oneOf([
      [
        body("sites")
          .exists()
          .withMessage(
            "site identifiers are missing in the request, consider using sites"
          )
          .bail()
          .custom((value) => Array.isArray(value))
          .withMessage("the sites should be an array")
          .bail()
          .notEmpty()
          .withMessage("the sites should not be empty"),
        body("sites.*")
          .isMongoId()
          .withMessage("site provided must be an object ID"),
      ],
      [
        body("site_ids")
          .exists()
          .withMessage(
            "site identifiers are missing in the request, consider using site_ids"
          )
          .bail()
          .custom((value) => Array.isArray(value))
          .withMessage("the site_ids should be an array")
          .bail()
          .notEmpty()
          .withMessage("the site_ids should not be empty"),
        body("site_ids.*")
          .isMongoId()
          .withMessage("site_id provided must be an object ID"),
      ],
      [
        body("site_names")
          .exists()
          .withMessage(
            "site identifiers are missing in the request, consider using site_names"
          )
          .bail()
          .custom((value) => Array.isArray(value))
          .withMessage("the site_names should be an array")
          .bail()
          .notEmpty()
          .withMessage("the site_names should not be empty"),
        body("site_names.*")
          .custom((value) => !/\s/.test(value))
          .withMessage("site_name provided must not contain spaces"),
      ],
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

  createAdminLevel: [
    ...commonValidations.tenant,
    ...commonValidations.name,
    ...commonValidations.description,

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

  listAdminLevels: [
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

  updateAdminLevel: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("level_id"),
    body("name")
      .optional()
      .not()
      .exists()
      .withMessage("admin level names cannot be updated")
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the name can only contain letters, numbers, spaces, hyphens and underscores"
      ),
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
  deleteAdminLevel: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("level_id"),
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
  getAdminLevel: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("level_id"),
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
    commonValidations.paramObjectId("grid_id"),
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
  ...gridsValidations,
  pagination: commonValidations.pagination,
};
