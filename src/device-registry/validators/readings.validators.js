// readings.validators.js
const {
  oneOf,
  query,
  param,
  body,
  validationResult,
} = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const { isValidObjectId } = require("mongoose");
const constants = require("@config/constants");

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
  // Optional ObjectId validator - validates ObjectId format when provided, allows empty/undefined
  objectId: (
    field,
    location = query,
    errorMessage = "Invalid ObjectId format"
  ) => {
    return location(field)
      .optional()
      .custom((value) => {
        let values = Array.isArray(value)
          ? value
          : value?.toString().split(",");
        for (const v of values) {
          if (v && !isValidObjectId(v)) {
            throw new Error(`${field}: ${errorMessage} - ${v}`);
          }
        }
        return true;
      })
      .customSanitizer((value) => {
        if (value) {
          let values;
          if (Array.isArray(value)) {
            values = value;
          } else {
            values = value?.toString().split(",");
          }
          return values
            .map((v) => (isValidObjectId(v) ? ObjectId(v) : null))
            .filter((v) => v !== null);
        }
        return value;
      });
  },

  // Alias for clarity - explicitly optional ObjectId validator (same as objectId)
  get optionalObjectId() {
    return this.objectId;
  },

  // Required ObjectId validator
  requiredObjectId: (
    field,
    location = query,
    errorMessage = "Invalid ObjectId format"
  ) => {
    return location(field)
      .exists()
      .withMessage(`${field} is required`)
      .notEmpty()
      .withMessage(`${field} cannot be empty`)
      .custom((value) => {
        let values = Array.isArray(value)
          ? value
          : value?.toString().split(",");
        for (const v of values) {
          if (v && !isValidObjectId(v)) {
            throw new Error(`${field}: ${errorMessage} - ${v}`);
          }
        }
        return true;
      })
      .customSanitizer((value) => {
        if (value) {
          let values;
          if (Array.isArray(value)) {
            values = value;
          } else {
            values = value?.toString().split(",");
          }
          return values
            .map((v) => (isValidObjectId(v) ? ObjectId(v) : null))
            .filter((v) => v !== null);
        }
        return value;
      });
  },
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
      req.query.limit = limit;

      if (isNaN(skip) || skip < 0) {
        req.query.skip = 0;
      }

      next();
    };
  },
  timeRange: [
    query("startTime")
      .optional()
      .notEmpty()
      .withMessage("startTime cannot be empty IF provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("startTime must be a valid datetime."),
    query("endTime")
      .optional()
      .notEmpty()
      .withMessage("endTime cannot be empty IF provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("endTime must be a valid datetime."),
  ],
  frequency: [
    query("frequency")
      .optional()
      .notEmpty()
      .withMessage("the frequency cannot be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["hourly", "daily", "raw", "minute"])
      .withMessage(
        "the frequency value is not among the expected ones which include: hourly, daily, minute and raw"
      ),
  ],
  format: [
    query("format")
      .optional()
      .notEmpty()
      .withMessage("the format cannot be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["json", "csv"])
      .withMessage(
        "the format value is not among the expected ones which include: csv and json"
      ),
  ],
  external: [
    query("external")
      .optional()
      .notEmpty()
      .withMessage("external cannot be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["yes", "no"])
      .withMessage(
        "the external value is not among the expected ones which include: no and yes"
      ),
  ],
  recent: [
    query("recent")
      .optional()
      .notEmpty()
      .withMessage("recent cannot be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["yes", "no"])
      .withMessage(
        "the recent value is not among the expected ones which include: no and yes"
      ),
  ],
  device: [
    query("device")
      .optional()
      .notEmpty()
      .withMessage("device cannot be empty IF provided")
      .trim(),
  ],
  deviceId: [
    query("device_id")
      .optional()
      .notEmpty()
      .withMessage("device_id cannot be empty IF provided")
      .trim(),
  ],
  latLong: [
    query("lat_long")
      .optional()
      .notEmpty()
      .withMessage("lat_long cannot be empty IF provided")
      .bail()
      .trim(),
  ],
  airqloudId: [
    query("airqloud_id")
      .optional()
      .notEmpty()
      .withMessage("the provided airqloud_id cannot be empty IF provided"),
  ],
  cohortId: [
    query("cohort_id")
      .optional()
      .notEmpty()
      .withMessage("the provided cohort_id cannot be empty IF provided"),
  ],
  gridId: [
    query("grid_id")
      .optional()
      .notEmpty()
      .withMessage("the provided grid_id cannot be empty IF provided"),
  ],
  deviceNumber: [
    query("device_number")
      .optional()
      .notEmpty()
      .withMessage("the provided device_number cannot be empty IF provided")
      .trim(),
  ],
  site: [
    query("site")
      .optional()
      .notEmpty()
      .withMessage("the provided site cannot be empty IF provided")
      .trim(),
  ],
  siteId: [
    query("site_id")
      .optional()
      .notEmpty()
      .withMessage("site_id cannot be empty IF provided"),
  ],
  primary: [
    query("primary")
      .optional()
      .notEmpty()
      .withMessage("primary cannot be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["yes", "no"])
      .withMessage("valid values include: YES and NO"),
  ],
  metadata: [
    query("metadata")
      .optional()
      .notEmpty()
      .withMessage("metadata cannot be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["site", "site_id", "device", "device_id"])
      .withMessage("valid values include: site, site_id, device and device_id"),
  ],
  test: [
    query("test")
      .optional()
      .notEmpty()
      .withMessage("test cannot be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["yes", "no"])
      .withMessage("valid values include: YES and NO"),
  ],
  threshold: [
    query("threshold")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("the threshold cannot be empty IF provided")
      .bail()
      .isFloat()
      .withMessage("threshold must be a number")
      .bail()
      .toFloat(),
  ],
  pollutant: [
    query("pollutant")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("the pollutant cannot be empty IF provided")
      .bail()
      .toLowerCase()
      .isIn(["pm2_5", "pm10", "no2"])
      .withMessage("valid values include: pm2_5, pm10, no2"),
  ],
  language: [
    query("language")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("language cannot be empty if provided")
      .bail()
      .isLength({ min: 2, max: 5 })
      .withMessage("language should be a valid ISO 639-1 code"),
  ],
  limit: [
    query("limit")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("limit cannot be empty if provided")
      .bail()
      .isInt({ min: 1, max: 2000 })
      .withMessage("limit must be between 1 and 2000")
      .toInt(),
  ],
  skip: [
    query("skip")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("skip cannot be empty if provided")
      .bail()
      .isInt({ min: 0 })
      .withMessage("skip must be a non-negative integer")
      .toInt(),
  ],
  siteIdParam: [
    param("site_id")
      .exists()
      .withMessage("the site_id should be provided")
      .bail()
      .notEmpty()
      .withMessage("the provided site_id cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  checkForEmptyArrays: (fields, errorMessage = "cannot be an empty array") => [
    query().custom((value, { req }) => {
      fields.forEach((field) => {
        if (req.query[field] && req.query[field].length === 0) {
          throw new Error(`${field} ${errorMessage}.`);
        }
      });
      return true;
    }),
  ],
  checkConflictingParams: (
    param1,
    param2,
    errorMessage = `You cannot provide both ${param1} and ${param2}`
  ) => [
    query().custom((value, { req }) => {
      if (req.query[param1] && req.query[param2]) {
        throw new Error(errorMessage);
      }
      return true;
    }),
  ],
  validObjectId: (field, errorMessage = "must be a valid objectId") => [
    query(field)
      .optional()
      .custom((value) => {
        let values = Array.isArray(value) ? value : value.toString().split(",");
        for (const v of values) {
          if (v && !isValidObjectId(v)) {
            throw new Error(`${field} ${errorMessage}`);
          }
        }
        return true;
      }),
  ],
  atLeastOneRequired: (fields, message) => [
    query().custom((value, { req }) => {
      const hasAtLeastOne = fields.some((field) => req.query[field]);
      if (!hasAtLeastOne) {
        throw new Error(message);
      }
      return true;
    }),
  ],
};

// Helper function to create validation middleware from validation arrays
const createValidationMiddleware = (validationRules) => {
  return [
    ...validationRules, // Apply all validation rules
    (req, res, next) => {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }
      next();
    },
  ];
};

// Helper to execute middleware array sequentially (eliminates code duplication)
const executeMiddlewareSequentially = (middleware, req, res, next) => {
  let index = 0;
  const runNext = () => {
    if (index >= middleware.length) return next();
    const currentMiddleware = middleware[index++];
    if (typeof currentMiddleware === "function") {
      currentMiddleware(req, res, runNext);
    } else {
      runNext();
    }
  };
  runNext();
};

// Helper function for decimal places
function decimalPlaces(num) {
  const match = ("" + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) {
    return 0;
  }
  return Math.max(
    0,
    (match[1] ? match[1].length : 0) - (match[2] ? +match[2] : 0)
  );
}

// Convert validation arrays to proper middleware functions
const readingsValidations = {
  map: (req, res, next) => {
    const validationRules = [
      ...commonValidations.tenant,
      commonValidations.optionalObjectId("cohort_id"),
    ];
    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },
  nearestReadings: (req, res, next) => {
    const validationRules = [
      ...commonValidations.tenant,
      query("latitude")
        .exists()
        .withMessage("latitude is required")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("Invalid latitude format")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 2) {
            throw new Error("Latitude must have at least 2 decimal places");
          }
          return true;
        }),
      query("longitude")
        .exists()
        .withMessage("longitude is required")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("Invalid longitude format")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 2) {
            throw new Error("Longitude must have at least 2 decimal places");
          }
          return true;
        }),
      query("radius")
        .optional()
        .isFloat({ min: 0.1, max: 100 })
        .withMessage("Radius must be between 0.1 and 100 kilometers")
        .toFloat(),
      query("limit")
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage("Limit must be between 1 and 10")
        .toInt(),
    ];

    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },

  list: (req, res, next) => {
    const validationRules = [
      ...commonValidations.tenant,
      ...commonValidations.timeRange,
      ...commonValidations.frequency,
      ...commonValidations.format,
      ...commonValidations.external,
      ...commonValidations.recent,
      ...commonValidations.device,
      ...commonValidations.deviceId,
      ...commonValidations.latLong,
      ...commonValidations.airqloudId,
      ...commonValidations.cohortId,
      ...commonValidations.gridId,
      ...commonValidations.deviceNumber,
      ...commonValidations.site,
      ...commonValidations.siteId,
      ...commonValidations.primary,
      ...commonValidations.metadata,
      ...commonValidations.test,
    ];

    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },

  bestAirQuality: (req, res, next) => {
    const validationRules = [
      ...commonValidations.threshold,
      ...commonValidations.pollutant,
      ...commonValidations.language,
      ...commonValidations.limit,
      ...commonValidations.skip,
    ];

    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },

  recent: (req, res, next) => {
    const validationRules = [
      ...commonValidations.tenant,
      ...commonValidations.timeRange,
      ...commonValidations.frequency,
      ...commonValidations.format,
      ...commonValidations.external,
      ...commonValidations.recent,
      ...commonValidations.device,
      ...commonValidations.deviceId,
      ...commonValidations.latLong,
      ...commonValidations.airqloudId,
      ...commonValidations.cohortId,
      ...commonValidations.gridId,
      ...commonValidations.deviceNumber,
      ...commonValidations.site,
      ...commonValidations.siteId,
      ...commonValidations.primary,
      ...commonValidations.metadata,
      ...commonValidations.test,
      commonValidations.objectId("cohort_id"),
      commonValidations.objectId("grid_id"),
      commonValidations.objectId("device_id"),
      commonValidations.objectId("site_id"),
      commonValidations.objectId("airqloud_id"),
      ...commonValidations.checkConflictingParams("cohort_id", "grid_id"),
      ...commonValidations.checkConflictingParams("device_id", "site_id"),
      ...commonValidations.checkForEmptyArrays([
        "cohort_id",
        "grid_id",
        "device_id",
        "site_id",
      ]),
    ];

    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },

  listAverages: (req, res, next) => {
    const validationRules = [
      ...commonValidations.tenant,
      ...commonValidations.siteIdParam,
      ...commonValidations.timeRange,
      ...commonValidations.frequency,
      ...commonValidations.format,
      ...commonValidations.external,
      ...commonValidations.recent,
      ...commonValidations.metadata,
      ...commonValidations.test,
    ];

    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },

  listRecent: (req, res, next) => {
    const validationRules = [...commonValidations.tenant];

    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },

  worstReadingForDevices: (req, res, next) => {
    const validationRules = [
      ...commonValidations.atLeastOneRequired(
        ["cohort_id", "device_id"],
        "At least one of cohort_id or device_id is required."
      ),
      commonValidations.objectId("cohort_id"),
      commonValidations.objectId("device_id"),
      ...commonValidations.checkConflictingParams("cohort_id", "device_id"),
      ...commonValidations.checkForEmptyArrays(["cohort_id", "device_id"]),
    ];

    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },

  worstReadingForSites: (req, res, next) => {
    const validationRules = [
      ...commonValidations.atLeastOneRequired(
        ["grid_id", "site_id"],
        "At least one of grid_id or site_id is required."
      ),
      commonValidations.objectId("grid_id"),
      commonValidations.objectId("site_id"),
      ...commonValidations.checkConflictingParams("grid_id", "site_id"),
      ...commonValidations.checkForEmptyArrays(["grid_id", "site_id"]),
    ];

    const middleware = createValidationMiddleware(validationRules);
    executeMiddlewareSequentially(middleware, req, res, next);
  },
};

module.exports = {
  ...readingsValidations,
  pagination: commonValidations.pagination,
  validateOptionalObjectId: commonValidations.optionalObjectId,
};
