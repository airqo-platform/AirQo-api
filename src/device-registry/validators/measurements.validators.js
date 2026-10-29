// measurements.validators.js
const {
  oneOf,
  query,
  body,
  param,
  validationResult,
} = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const numeral = require("numeral");
const Decimal = require("decimal.js");

// Strictly a 24-char hex Mongo ObjectId string. Deliberately not
// mongoose's isValidObjectId, which also accepts arbitrary 12-byte
// strings — a plausible-length cohort_slug (e.g. "nairobi-2026") would be
// misclassified as an ObjectId and silently fail to resolve.
const isObjectIdShape = (value) => /^[0-9a-fA-F]{24}$/.test(String(value));

const countDecimalPlaces = (value) => {
  try {
    const decimal = new Decimal(value);
    const decimalStr = decimal.toString();
    if (decimalStr.includes(".")) {
      return decimalStr.split(".")[1].length;
    }
    return 0;
  } catch (err) {
    return 0;
  }
};

const { validateNetwork, validateAdminLevels } = require("@validators/common");

const rateLimit = require("express-rate-limit");

const averagesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],

  errorHandler: (req, res, next) => {
    // Unified error handler
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new HttpError(
          "Validation Error",
          httpStatus.BAD_REQUEST,
          errors.mapped(),
        ),
      );
    }
    next();
  },

  conflictingParamHandler: (param1, param2, req, res) => {
    const { [param1]: value1, [param2]: value2 } = req.query;
    if (value1 && value2) {
      return res.status(400).json({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: `You cannot provide both ${param1} and ${param2}`,
        },
      });
    }
    return false; // Indicate no conflict
  },

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

  timeRange: [
    query("startTime")
      .optional()
      .notEmpty()
      .withMessage("startTime cannot be empty IF provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("startTime must be a valid datetime.")
      .toDate(),
    query("endTime")
      .optional()
      .notEmpty()
      .withMessage("endTime cannot be empty IF provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("endTime must be a valid datetime.")
      .toDate(),
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
        "the frequency value is not among the expected ones which include: hourly, daily, minute and raw",
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
        "the format value is not among the expected ones which include: csv and json",
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
        "the external value is not among the expected ones which include: no and yes",
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
        "the recent value is not among the expected ones which include: no and yes",
      ),
  ],

  device: [
    query("device")
      .optional()
      .notEmpty()
      .withMessage("device cannot be empty IF provided")
      .trim(),
  ],

  site: [
    query("site")
      .optional()
      .notEmpty()
      .withMessage("site cannot be empty IF provided")
      .trim(),
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

  siteId: [
    query("site_id")
      .optional()
      .notEmpty()
      .withMessage("the provided site_id cannot be empty IF provided"),
  ],

  deviceNumber: [
    query("device_number")
      .optional()
      .notEmpty()
      .withMessage("the provided device_number cannot be empty IF provided")
      .trim(),
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
  optionalObjectId: (field) => [
    query(field)
      .optional()
      .custom((value) => {
        // Handles comma-separated strings or arrays
        let values = Array.isArray(value) ? value : value.toString().split(",");
        for (const v of values) {
          if (v && !isObjectIdShape(v)) {
            throw new Error(`Invalid ${field} format: ${v}`); // More specific error message
          }
        }
        return true;
      })
      .customSanitizer((value) => {
        if (value) {
          let values = Array.isArray(value)
            ? value
            : value.toString().split(",");
          return values
            .map((v) => (isObjectIdShape(v) ? ObjectId(v) : v))
            .filter((v) => v); // Filter out invalid/empty values after conversion
        }
        return value;
      }),
  ],

  // Comma-separated list variant of validCohortIdentifier: each entry may be
  // an ObjectId or a self-service cohort_slug. Used only for the cohort_id
  // query filter — grid_id/device_id/site_id keep using optionalObjectId
  // above, since they have no slug equivalent.
  // Returns the bare validator chain (not wrapped in an array) — matches
  // optionalObjectId's shape above; measurements.routes.js registers these
  // via plain Express arrays, which flatten nested arrays fine, but a
  // sibling copy of this same shape in readings/signals.validators.js broke
  // on their hand-rolled route runner, which doesn't. Keep the shape
  // consistent so this can't happen again if reused elsewhere.
  optionalCohortIdentifier: (field) =>
    query(field)
      .optional()
      .custom((value) => {
        const values = Array.isArray(value) ? value : value.toString().split(",");
        for (const v of values) {
          const candidate = typeof v === "string" ? v.toLowerCase().trim() : v;
          if (
            candidate &&
            !isObjectIdShape(candidate) &&
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)
          ) {
            throw new Error(
              `${field} must be a valid object ID or a valid cohort_slug (lowercase letters, numbers and hyphens) - ${v}`,
            );
          }
        }
        return true;
      })
      .customSanitizer((value) => {
        if (!value) return value;
        const values = Array.isArray(value) ? value : value.toString().split(",");
        return values
          .map((v) => (typeof v === "string" ? v.toLowerCase().trim() : v))
          .filter((v) => v)
          .map((v) => (isObjectIdShape(v) ? ObjectId(v) : v));
      }),

  checkConflictingParams: (
    param1,
    param2,
    errorMessage = `You cannot provide both ${param1} and ${param2}`,
  ) => [
    query().custom((value, { req }) => {
      const value1 = req.query[param1];
      const value2 = req.query[param2];

      if (value1 && value2) {
        if (Array.isArray(value1) && Array.isArray(value2)) {
          if (
            value1.some((id) => value2.includes(id)) ||
            value2.some((id) => value1.includes(id))
          ) {
            throw new Error(errorMessage);
          }
        } else {
          // Handles single values or mixed cases more robustly
          throw new Error(errorMessage);
        }
      }
      return true;
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
  validObjectId: (field) => [
    param(field)
      .exists()
      .withMessage(`${field} should be provided`)
      .bail()
      .notEmpty()
      .withMessage(`the provided ${field} cannot be empty`)
      .bail()
      .trim()
      .isMongoId()
      .withMessage(`the ${field} must be an object ID`)
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],

  // Accepts either a Mongo ObjectId (existing behaviour, unchanged) or a
  // self-service cohort_slug (new, opt-in). Only used for cohort_id — the
  // grid_id/device_id/etc callers of validObjectId above are untouched.
  validCohortIdentifier: (field) => [
    param(field)
      .exists()
      .withMessage(`${field} should be provided`)
      .bail()
      .notEmpty()
      .withMessage(`the provided ${field} cannot be empty`)
      .bail()
      .trim()
      .toLowerCase()
      .custom((value) => {
        if (isObjectIdShape(value)) {
          return true;
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          throw new Error(
            `the ${field} must be a valid object ID or a valid cohort_slug (lowercase letters, numbers and hyphens)`,
          );
        }
        return true;
      })
      .customSanitizer((value) => {
        return isObjectIdShape(value) ? ObjectId(value) : value;
      }),
  ],

  latLong: [
    param("latitude")
      .exists()
      .withMessage("the latitude is missing in your request")
      .bail()
      .matches(constants.LATITUDE_REGEX, "i")
      .withMessage("the latitude provided is not valid")
      .bail()
      .custom((value) => {
        let dp = countDecimalPlaces(value);
        if (dp < 5) {
          return Promise.reject("the latitude must have 5 or more characters");
        }
        return Promise.resolve("latitude validation test has passed");
      })
      .bail()
      .customSanitizer((value) => {
        return numeral(value).format("0.00000");
      })
      .isDecimal({ decimal_digits: 5 })
      .withMessage("the latitude must have atleast 5 decimal places in it"),
    param("longitude")
      .exists()
      .withMessage("the longitude is missing in your request")
      .bail()
      .matches(constants.LONGITUDE_REGEX, "i")
      .withMessage("the longitude provided is not valid")
      .bail()
      .custom((value) => {
        let dp = countDecimalPlaces(value);
        if (dp < 5) {
          return Promise.reject("the longitude must have 5 or more characters");
        }
        return Promise.resolve("longitude validation test has passed");
      })
      .bail()
      .customSanitizer((value) => {
        return numeral(value).format("0.00000");
      })
      .isDecimal({ decimal_digits: 5 })
      .withMessage("the longitude must have atleast 5 decimal places in it"),
  ],
};

const baseValidations = [
  ...commonValidations.tenant,
  ...commonValidations.timeRange,
  ...commonValidations.frequency,
  ...commonValidations.format,
  ...commonValidations.external,
  ...commonValidations.recent,
  ...commonValidations.metadata,
  ...commonValidations.test,
  commonValidations.errorHandler,
];

const measurementsValidations = {
  listMeasurements: [
    ...commonValidations.tenant,
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.device,
    commonValidations.optionalObjectId("device_id"),
    ...commonValidations.latLong,
    ...commonValidations.cohortId,
    ...commonValidations.gridId,
    ...commonValidations.deviceNumber,
    ...commonValidations.site,
    commonValidations.optionalObjectId("site_id"),
    ...commonValidations.primary,
    ...commonValidations.metadata,
    ...commonValidations.test,
    ...commonValidations.checkConflictingParams("cohort_id", "grid_id"),
    ...commonValidations.checkConflictingParams("device_id", "site_id"),
    commonValidations.errorHandler,
  ],
  listHistoricalMeasurements: [
    commonValidations.optionalCohortIdentifier("cohort_id"),
    commonValidations.optionalObjectId("grid_id"),
    commonValidations.optionalObjectId("device_id"),
    commonValidations.optionalObjectId("site_id"),
    ...commonValidations.tenant,
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.device,
    ...commonValidations.latLong,
    ...commonValidations.cohortId,
    ...commonValidations.gridId,
    ...commonValidations.deviceNumber,
    ...commonValidations.site,
    ...commonValidations.siteId,
    ...commonValidations.primary,
    ...commonValidations.metadata,
    ...commonValidations.test,
    ...commonValidations.checkConflictingParams("cohort_id", "grid_id"),
    ...commonValidations.checkConflictingParams("device_id", "site_id"),
    (req, res, next) => {
      let conflict = commonValidations.conflictingParamHandler(
        "cohort_id",
        "grid_id",
        req,
        res,
      );
      if (conflict) {
        //If conflict is true, stop and return the json response from conflictingParamHandler
        return conflict;
      }
      conflict = commonValidations.conflictingParamHandler(
        "device_id",
        "site_id",
        req,
        res,
      );
      if (conflict) {
        return conflict;
      }
      commonValidations.errorHandler(req, res, next); // Proceed with other validations if no conflicting params
    },
  ],
  listRecentMeasurements: [
    commonValidations.optionalCohortIdentifier("cohort_id"),
    commonValidations.optionalObjectId("grid_id"),
    commonValidations.optionalObjectId("device_id"),
    commonValidations.optionalObjectId("site_id"),
    ...commonValidations.tenant,
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.device,
    ...commonValidations.latLong,
    ...commonValidations.cohortId,
    ...commonValidations.gridId,
    ...commonValidations.deviceNumber,
    ...commonValidations.site,
    ...commonValidations.siteId,
    ...commonValidations.primary,
    ...commonValidations.metadata,
    ...commonValidations.test,
    ...commonValidations.checkConflictingParams("cohort_id", "grid_id"),
    ...commonValidations.checkConflictingParams("device_id", "site_id"),
    (req, res, next) => {
      let conflict = commonValidations.conflictingParamHandler(
        "cohort_id",
        "grid_id",
        req,
        res,
      );
      if (conflict) {
        return conflict;
      }
      conflict = commonValidations.conflictingParamHandler(
        "device_id",
        "site_id",
        req,
        res,
      );
      if (conflict) {
        return conflict;
      }

      commonValidations.errorHandler(req, res, next);
    },
  ],
  listLatestMeasurements: [
    ...commonValidations.tenant,
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.device,
    commonValidations.validObjectId("device_id"),
    ...commonValidations.latLong,
    ...commonValidations.deviceNumber,
    ...commonValidations.site,
    commonValidations.validObjectId("site_id"),
    ...commonValidations.primary,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listMeasurementsByLocation: [
    ...baseValidations,
    ...commonValidations.latLong,
  ],
  listHistoricalSiteMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("site_id"),
  ],

  listRecentSiteMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("site_id"),
  ],

  listSiteMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("site_id"),
  ],

  listSiteAverages: [
    ...baseValidations,
    commonValidations.validObjectId("site_id"),
  ],

  listSiteAveragesV2: [
    ...baseValidations,
    commonValidations.validObjectId("site_id"),
  ],

  listSiteAveragesV3: [
    ...baseValidations,
    commonValidations.validObjectId("site_id"),
  ],

  listHistoricalGridMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("grid_id"),
  ],
  listRecentGridMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("grid_id"),
  ],
  listGridMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("grid_id"),
  ],
  listHistoricalCohortMeasurements: [
    ...baseValidations,
    commonValidations.validCohortIdentifier("cohort_id"),
  ],

  listRecentCohortMeasurements: [
    ...baseValidations,
    commonValidations.validCohortIdentifier("cohort_id"),
  ],
  listCohortMeasurements: [
    ...baseValidations,
    commonValidations.validCohortIdentifier("cohort_id"),
  ],
  listHistoricalDeviceMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("device_id"),
  ],

  listRecentDeviceMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("device_id"),
  ],

  listDeviceMeasurements: [
    ...baseValidations,
    commonValidations.validObjectId("device_id"),
  ],
};

module.exports = {
  ...measurementsValidations,
  pagination: commonValidations.pagination,
  averagesLimiter,
};
