// measurements.validators.js
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
const decimalPlaces = require("decimal-places");
const numeral = require("numeral");

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
      .isIn(constants.NETWORKS)
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
          errors.mapped()
        )
      );
    }
    next();
  },

  conflictingParamHandler: (param1, param2, res) => {
    // Function to handle conflicting params
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

  paramErrorChecker: (req, res, next) => {
    //Checks for errors and calls next if no errors are found
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new HttpError(
          "Validation Error",
          httpStatus.BAD_REQUEST,
          errors.mapped()
        )
      );
    }
    next();
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

  site: [
    query("site")
      .optional()
      .notEmpty()
      .withMessage("site cannot be empty IF provided")
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
          if (v && !isValidObjectId(v)) {
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
            .map((v) => (isValidObjectId(v) ? ObjectId(v) : v))
            .filter((v) => v); // Filter out invalid/empty values after conversion
        }
        return value;
      }),
  ],

  checkConflictingParams: (
    param1,
    param2,
    errorMessage = `You cannot provide both ${param1} and ${param2}`
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

  latLong: [
    param("latitude")
      .exists()
      .withMessage("the latitude is missing in your request")
      .bail()
      .matches(constants.LATITUDE_REGEX, "i")
      .withMessage("the latitude provided is not valid")
      .bail()
      .custom((value) => {
        let dp = decimalPlaces(value);
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
        let dp = decimalPlaces(value);
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
    ...commonValidations.airqloudId,
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
    commonValidations.optionalObjectId("cohort_id"),
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
    ...commonValidations.airqloudId,
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
        res
      );
      if (conflict) {
        //If conflict is true, stop and return the json response from conflictingParamHandler
        return conflict;
      }
      conflict = commonValidations.conflictingParamHandler(
        "device_id",
        "site_id",
        res
      );
      if (conflict) {
        return conflict;
      }
      commonValidations.paramErrorChecker(req, res, next); // Proceed with other validations if no conflicting params
    },
  ],
  listRecentMeasurements: [
    commonValidations.optionalObjectId("cohort_id"),
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
    ...commonValidations.airqloudId,
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
        res
      );
      if (conflict) {
        return conflict;
      }
      conflict = commonValidations.conflictingParamHandler(
        "device_id",
        "site_id",
        res
      );
      if (conflict) {
        return conflict;
      }

      commonValidations.paramErrorChecker(req, res, next);
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
    commonValidations.validObjectId("airqloud_id"),
    ...commonValidations.deviceNumber,
    ...commonValidations.site,
    commonValidations.validObjectId("site_id"),
    ...commonValidations.primary,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listMeasurementsByLocation: [
    ...commonValidations.tenant,
    ...commonValidations.latLong,
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listHistoricalSiteMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("site_id"),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listRecentSiteMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("site_id"),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listSiteMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("site_id"),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listSiteAverages: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("site_id"),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listSiteAveragesV2: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("site_id"),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listSiteAveragesV3: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("site_id"),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listHistoricalAirqloudMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("airqloud_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listRecentAirqloudMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("airqloud_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listAirqloudMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("airqloud_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listHistoricalGridMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("grid_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listRecentGridMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("grid_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listGridMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("grid_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listHistoricalCohortMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("cohort_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listRecentCohortMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("cohort_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listCohortMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("cohort_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
  listHistoricalDeviceMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("device_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listRecentDeviceMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("device_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],

  listDeviceMeasurements: [
    ...commonValidations.tenant,
    commonValidations.validObjectId("device_id", param),
    ...commonValidations.timeRange,
    ...commonValidations.frequency,
    ...commonValidations.format,
    ...commonValidations.external,
    ...commonValidations.recent,
    ...commonValidations.metadata,
    ...commonValidations.test,
    commonValidations.errorHandler,
  ],
};

module.exports = {
  ...measurementsValidations,
  pagination: commonValidations.pagination,
  averagesLimiter,
};
