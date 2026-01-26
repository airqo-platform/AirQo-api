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
const {
  validateNetwork,
  validateAdminLevels,
  validateAndFixPolygon,
  ensureClosedRing,
  validateCoordinates,
  TOLERANCE_LEVELS,
} = require("@validators/common");

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

const validateAndAutoFixPolygonCoordinatesLenient = (
  value,
  tolerance = TOLERANCE_LEVELS.NORMAL,
) => {
  if (!Array.isArray(value)) {
    throw new Error("Coordinates must be provided as an array");
  }
  if (value.length === 0) {
    throw new Error("At least one polygon must be provided");
  }

  for (let i = 0; i < value.length; i++) {
    const polygon = value[i];
    if (!Array.isArray(polygon)) {
      throw new Error(
        "Each polygon must be provided as an array of coordinates",
      );
    }
    if (polygon.length < 4) {
      throw new Error("Each polygon must have at least four coordinates");
    }

    // Validate each coordinate
    for (const coordinate of polygon) {
      validateCoordinate(coordinate);
    }

    // Lenient closure check with configurable tolerance
    const firstCoord = polygon[0];
    const lastCoord = polygon[polygon.length - 1];

    const longitudeDiff = Math.abs(firstCoord[0] - lastCoord[0]);
    const latitudeDiff = Math.abs(firstCoord[1] - lastCoord[1]);

    if (longitudeDiff > tolerance || latitudeDiff > tolerance) {
      // Auto-fix by adding the first coordinate as the last
      value[i] = ensureClosedRing(polygon);
      logText(
        `Auto-fixed polygon ring with tolerance ${tolerance}. ` +
          `Differences: lng=${longitudeDiff.toFixed(
            6,
          )}, lat=${latitudeDiff.toFixed(6)}. ` +
          `Added closing coordinate: [${firstCoord[0]}, ${firstCoord[1]}]`,
      );
    } else if (longitudeDiff > 0 || latitudeDiff > 0) {
      // Coordinates are close enough - log but don't fix
      logText(
        `Polygon ring within tolerance ${tolerance}. ` +
          `Differences: lng=${longitudeDiff.toFixed(
            6,
          )}, lat=${latitudeDiff.toFixed(6)}`,
      );
    }
  }
  return true;
};

const validateAndAutoFixMultiPolygonCoordinatesLenient = (
  value,
  tolerance = 0.001,
) => {
  if (!Array.isArray(value)) {
    throw new Error("Coordinates must be provided as an array");
  }
  if (value.length === 0) {
    throw new Error("At least one multipolygon must be provided");
  }

  for (const multipolygon of value) {
    validateAndAutoFixPolygonCoordinatesLenient(multipolygon, tolerance);
  }
  return true;
};

const validateAndAutoFixPolygonCoordinatesStrict = (value) => {
  if (!Array.isArray(value)) {
    throw new Error("Coordinates must be provided as an array");
  }
  if (value.length === 0) {
    throw new Error("At least one polygon must be provided");
  }

  for (let i = 0; i < value.length; i++) {
    const polygon = value[i];
    if (!Array.isArray(polygon)) {
      throw new Error(
        "Each polygon must be provided as an array of coordinates",
      );
    }
    if (polygon.length < 4) {
      throw new Error("Each polygon must have at least four coordinates");
    }

    // Validate each coordinate
    for (const coordinate of polygon) {
      validateCoordinate(coordinate);
    }

    // Always fix any non-zero difference (MongoDB requires exact closure)
    const firstCoord = polygon[0];
    const lastCoord = polygon[polygon.length - 1];

    const longitudeDiff = Math.abs(firstCoord[0] - lastCoord[0]);
    const latitudeDiff = Math.abs(firstCoord[1] - lastCoord[1]);

    if (longitudeDiff > 0 || latitudeDiff > 0) {
      value[i] = ensureClosedRing(polygon);
      logText(
        `Auto-closed polygon ring. Differences: lng=${longitudeDiff.toFixed(
          6,
        )}, lat=${latitudeDiff.toFixed(6)}.`,
      );
    }
  }
  return true;
};

// Update MultiPolygon version as well
const validateAndAutoFixMultiPolygonCoordinatesStrict = (value) => {
  if (!Array.isArray(value)) {
    throw new Error("Coordinates must be provided as an array");
  }
  if (value.length === 0) {
    throw new Error("At least one multipolygon must be provided");
  }

  for (const multipolygon of value) {
    validateAndAutoFixPolygonCoordinatesStrict(multipolygon);
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
        "the name can only contain letters, numbers, spaces, hyphens and underscores",
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
        "the name can only contain letters, numbers, spaces, hyphens and underscores",
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
        "admin_level values include but not limited to: province, state, village, county, etc. Update your GLOBAL configs",
      ),
  ],

  adminLevelQuery: [
    query("admin_level")
      .optional()
      .notEmpty()
      .withMessage("admin_level is empty, should not be if provided in request")
      .bail()
      .customSanitizer((value) => {
        // Split comma-separated values and trim whitespace
        if (typeof value === "string" && value.includes(",")) {
          return value.split(",").map((level) => level.trim().toLowerCase());
        }
        return typeof value === "string" ? value.trim().toLowerCase() : value;
      })
      .custom((value) => {
        // Handle both single values and arrays
        const adminLevels = Array.isArray(value) ? value : [value];

        // Validate each admin level
        for (const level of adminLevels) {
          if (!validateAdminLevels(level)) {
            throw new Error(`Invalid admin_level: ${level}`);
          }
        }
        return true;
      })
      .withMessage(
        "admin_level values include but not limited to: province, state, village, county, etc. Update your GLOBAL configs",
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
          return validateAndAutoFixPolygonCoordinatesStrict(value);
        } else if (shapeType === "MultiPolygon") {
          return validateAndAutoFixMultiPolygonCoordinatesStrict(value);
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
  grid_tags: [
    body("grid_tags")
      .optional()
      .isArray()
      .withMessage("grid_tags must be an array of strings")
      .bail()
      .notEmpty()
      .withMessage("grid_tags should not be an empty array if provided"),
    body("grid_tags.*")
      .isString()
      .withMessage("Each tag must be a string"),
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
  updateGridShape: [
    ...commonValidations.tenant,
    commonValidations.paramObjectId("grid_id"),
    ...commonValidations.shape,
    body("confirm_update")
      .exists()
      .withMessage("confirm_update is required for shape updates")
      .bail()
      .isBoolean()
      .withMessage("confirm_update must be a boolean")
      .bail()
      .equals("true")
      .withMessage(
        "confirm_update must be set to true to proceed with shape update",
      ),
    body("update_reason")
      .exists()
      .withMessage("update_reason is required for shape updates")
      .bail()
      .notEmpty()
      .withMessage("update_reason cannot be empty")
      .bail()
      .isLength({ min: 10, max: 500 })
      .withMessage("update_reason must be between 10 and 500 characters"),
    (req, res, next) => {
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
    },
  ],
  createGrid: [
    ...commonValidations.tenant,
    ...commonValidations.name,
    ...commonValidations.shape,
    ...commonValidations.adminLevel,
    ...commonValidations.description,
    ...commonValidations.groups,
    ...commonValidations.network,
    ...commonValidations.grid_tags,
    (req, res, next) => {
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
    },
  ],
  listGrids: [
    ...commonValidations.tenant,
    oneOf([
      commonValidations.validObjectId("id"),
      commonValidations.nameQuery,
      commonValidations.adminLevelQuery,
    ]),
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
    query("tags")
      .optional()
      .notEmpty()
      .withMessage("tags must not be empty if provided")
      .bail()
      .isString()
      .withMessage("tags must be a string"),
    (req, res, next) => {
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
    },
  ],
  listGridSummary: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("id"),
    commonValidations.nameQuery,
    commonValidations.adminLevelQuery,
    query("cohort_id")
      .optional()
      .notEmpty()
      .withMessage("cohort_id cannot be empty if provided")
      .customSanitizer((value) => {
        if (typeof value === "string" && value.includes(",")) {
          return value.split(",").map((id) => id.trim());
        }
        return value;
      })
      .custom((value) => {
        const ids = Array.isArray(value) ? value : [value];
        return ids.every((id) => isValidObjectId(id));
      })
      .withMessage("cohort_id must be valid ObjectId(s)"),
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
            errors.mapped(),
          ),
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
    ...commonValidations.grid_tags,
    ...commonValidations.adminLevel,
    (req, res, next) => {
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
            errors.mapped(),
          ),
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
            errors.mapped(),
          ),
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
            errors.mapped(),
          ),
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
            errors.mapped(),
          ),
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
            errors.mapped(),
          ),
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
          "Only one of sites, site_ids, or site_names should be provided",
        );
      }
      return true;
    }),

    oneOf([
      [
        body("sites")
          .exists()
          .withMessage(
            "site identifiers are missing in the request, consider using sites",
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
            "site identifiers are missing in the request, consider using site_ids",
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
            "site identifiers are missing in the request, consider using site_names",
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
            errors.mapped(),
          ),
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
            errors.mapped(),
          ),
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
            errors.mapped(),
          ),
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
        "the name can only contain letters, numbers, spaces, hyphens and underscores",
      ),
    (req, res, next) => {
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
            errors.mapped(),
          ),
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
            errors.mapped(),
          ),
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
            errors.mapped(),
          ),
        );
      }
      next();
    },
  ],
  findNearestCountry: [
    ...commonValidations.tenant,
    ...commonValidations.latitude,
    ...commonValidations.longitude,
    query("limit")
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage("Limit must be a number between 1 and 10")
      .toInt(),
    (req, res, next) => {
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
    },
  ],
  listCountries: [
    ...commonValidations.tenant,
    query("cohort_id")
      .optional()
      .notEmpty()
      .withMessage("cohort_id cannot be empty if provided")
      .customSanitizer((value) => {
        if (typeof value === "string" && value.includes(",")) {
          return value.split(",").map((id) => id.trim());
        }
        return value;
      })
      .custom((value) => {
        const ids = Array.isArray(value) ? value : [value];
        return ids.every((id) => isValidObjectId(id));
      })
      .withMessage("cohort_id must be valid ObjectId(s)"),
    (req, res, next) => {
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
    },
  ],
};

module.exports = gridsValidations;
