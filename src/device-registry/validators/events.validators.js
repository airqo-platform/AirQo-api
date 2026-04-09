// events.validators.js
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
const { validateNetwork, isValidDateFormat } = require("@validators/common");

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
      .withMessage("tenant should not be empty if provided")
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

  timeRange: [
    query("startTime")
      .optional()
      .notEmpty()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("startTime must be a valid datetime."),
    query("endTime")
      .optional()
      .notEmpty()
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
      .trim(),
  ],

  deviceId: [
    query("device_id")
      .optional()
      .notEmpty()
      .trim(),
  ],

  latLong: [
    query("lat_long")
      .optional()
      .notEmpty()
      .trim(),
  ],

  airqloudId: [
    query("airqloud_id")
      .optional()
      .notEmpty()
      .trim(),
  ],

  deviceNumber: [
    query("device_number")
      .optional()
      .notEmpty()
      .trim(),
  ],

  site: [
    query("site")
      .optional()
      .notEmpty()
      .trim(),
  ],

  siteId: [
    query("site_id")
      .optional()
      .notEmpty()
      .trim(),
  ],

  primary: [
    query("primary")
      .optional()
      .notEmpty()
      .trim()
      .toLowerCase()
      .isIn(["yes", "no"])
      .withMessage("valid values include: YES and NO"),
  ],
  metadata: [
    query("metadata")
      .optional()
      .notEmpty()
      .trim()
      .toLowerCase()
      .isIn(["site", "site_id", "device", "device_id"])
      .withMessage("valid values include: site, site_id, device and device_id"),
  ],

  test: [
    query("test")
      .optional()
      .notEmpty()
      .trim()
      .toLowerCase()
      .isIn(["yes", "no"])
      .withMessage("valid values include: YES and NO"),
  ],

  language: [
    query("language")
      .optional()
      .notEmpty()
      .withMessage("the language cannot be empty when provided")
      .bail()
      .trim(),
  ],

  transmitSingleBody: [
    body("time")
      .exists()
      .trim()
      .withMessage("time is missing")
      .bail()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("time must be a valid datetime."),
    body("s1_pm10").trim(),
    body("s1_pm2_5").trim(),
    body("s2_pm2_5").trim(),
    body("s2_pm10").trim(),
    body("latitude").trim(),
    body("longitude").trim(),
    body("battery").trim(),
    body("altitude").trim(),
    body("wind_speed").trim(),
    body("satellites").trim(),
    body("hdop").trim(),
    body("internal_temperature").trim(),
    body("internal_humidity").trim(),
    body("external_temperature").trim(),
    body("external_humidity").trim(),
    body("external_pressure").trim(),
    body("external_altitude").trim(),
    body("status")
      .optional()
      .notEmpty()
      .withMessage("status cannot be empty if provided"),
  ],

  transmitBulkBody: [
    body("*.time")
      .exists()
      .trim()
      .withMessage("time is missing")
      .bail()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("time must be a valid datetime."),
    body("*.s1_pm10").trim(),
    body("*.s1_pm2_5").trim(),
    body("*.s2_pm2_5").trim(),
    body("*.s2_pm10")
      .optional()
      .trim(),
    body("*.latitude").trim(),
    body("*.longitude").trim(),
    body("*.battery").trim(),
    body("*.altitude").trim(),
    body("*.wind_speed").trim(),
    body("*.satellites").trim(),
    body("*.hdop").trim(),
    body("*.internal_temperature").trim(),
    body("*.internal_humidity").trim(),
    body("*.external_temperature").trim(),
    body("*.external_humidity").trim(),
    body("*.external_pressure").trim(),
    body("*.external_altitude").trim(),
    body("*.status"),
  ],

  addEventBody: [
    body()
      .isArray()
      .withMessage("the request body should be an array"),
    body("*.device_id")
      .exists()
      .trim()
      .withMessage("device_id is missing")
      .bail()
      .isMongoId()
      .withMessage("device_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("*.is_device_primary")
      .optional()
      .notEmpty()
      .trim()
      .isBoolean()
      .withMessage("is_device_primary should be Boolean"),
    body("*.site_id")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("site_id should not be empty if provided")
      .bail()
      .isMongoId()
      .withMessage("site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("*.time")
      .exists()
      .trim()
      .withMessage("time is missing")
      .bail()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("time must be a valid datetime."),
    body("*.frequency")
      .exists()
      .trim()
      .toLowerCase()
      .withMessage("frequency is missing")
      .bail()
      .isIn(["raw", "hourly", "daily"])
      .withMessage(
        "the frequency value is not among the expected ones which include: raw, hourly and daily",
      ),
    body("*.is_test_data")
      .optional()
      .notEmpty()
      .trim()
      .isBoolean()
      .withMessage("is_test_data should be boolean"),
    body("*.device")
      .optional()
      .notEmpty()
      .trim(),
    body("*.site")
      .optional()
      .notEmpty()
      .trim(),
    body("*.device_number")
      .optional()
      .notEmpty()
      .isInt()
      .withMessage("the device_number should be an integer value")
      .bail()
      .trim(),
    body("*.network")
      .optional()
      .notEmpty()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the network value is not among the expected ones"),
  ],

  transformEventBody: [
    body()
      .isArray()
      .withMessage("the request body should be an array"),
    body("*.device_id")
      .exists()
      .trim()
      .withMessage("device_id is missing")
      .bail()
      .isMongoId()
      .withMessage("device_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("*.is_device_primary")
      .optional()
      .notEmpty()
      .trim()
      .isBoolean()
      .withMessage("is_device_primary should be Boolean"),
    body("*.site_id")
      .exists()
      .trim()
      .withMessage("site_id is missing")
      .bail()
      .isMongoId()
      .withMessage("site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("*.time")
      .exists()
      .trim()
      .withMessage("time is missing")
      .bail()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("time must be a valid datetime."),
    body("*.frequency")
      .exists()
      .trim()
      .toLowerCase()
      .withMessage("frequency is missing")
      .bail()
      .isIn(["raw", "hourly", "daily"])
      .withMessage(
        "the frequency value is not among the expected ones which include: raw, hourly and daily",
      ),
    body("*.is_test_data")
      .optional()
      .notEmpty()
      .trim()
      .isBoolean()
      .withMessage("is_test_data should be boolean"),
    body("*.device")
      .optional()
      .notEmpty()
      .trim(),
    body("*.site")
      .optional()
      .notEmpty()
      .trim(),
    body("*.device_number")
      .optional()
      .notEmpty()
      .isInt()
      .withMessage("the device_number should be an integer value")
      .bail()
      .trim(),
  ],

  deviceIdentifier: oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the device_number",
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("device_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the device_id",
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("site_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the site_id",
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("device")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device name",
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
};

const baseEventValidations = [
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
  ...commonValidations.deviceNumber,
  ...commonValidations.site,
  ...commonValidations.siteId,
  ...commonValidations.primary,
  ...commonValidations.metadata,
  ...commonValidations.test,
  handleValidationErrors,
];

const eventsValidations = {
  listEvents: baseEventValidations,
  listRunningDevices: baseEventValidations,
  listGoodEvents: baseEventValidations,
  listModerateEvents: baseEventValidations,
  listU4sgEvents: baseEventValidations,
  listUnhealthyEvents: baseEventValidations,
  listVeryUnhealthyEvents: baseEventValidations,
  listHazardousEvents: baseEventValidations,
  addEvents: [
    ...commonValidations.tenant,
    ...commonValidations.addEventBody,
    handleValidationErrors,
  ],

  transformEvents: [
    ...commonValidations.tenant,
    ...commonValidations.transformEventBody,
    handleValidationErrors,
  ],
  listRecentEvents: baseEventValidations,
  listAllEvents: [
    ...baseEventValidations.slice(0, -1),
    ...commonValidations.language,
    handleValidationErrors,
  ],
  transmitMultipleSensorValues: [
    ...commonValidations.tenant,
    oneOf([
      query("id").exists(),
      query("name").exists(),
      query("device_number").exists(),
    ]),
    ...commonValidations.transmitSingleBody,
    handleValidationErrors,
  ],

  bulkTransmitMultipleSensorValues: [
    ...commonValidations.tenant,
    oneOf([
      query("id").exists(),
      query("name").exists(),
      query("device_number").exists(),
    ]),
    body()
      .isArray()
      .withMessage("the request body should be an array"),
    ...commonValidations.transmitBulkBody,
    handleValidationErrors,
  ],
  deleteValuesOnPlatform: [
    ...commonValidations.tenant,
    commonValidations.deviceIdentifier,
    handleValidationErrors,
  ],
};

const deleteValuesOnPlatform = [
  ...commonValidations.tenant,
  query("startTime")
    .exists()
    .trim()
    .withMessage("startTime is missing")
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage("startTime must be a valid datetime."),
  query("endTime")
    .exists()
    .trim()
    .withMessage("endTime is missing")
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage("endTime must be a valid datetime."),
  query("device_number")
    .optional()
    .isInt()
    .withMessage("device_number must be an integer")
    .bail()
    .toInt(),
  query("device_id")
    .optional()
    .isMongoId()
    .withMessage("Invalid device_id format")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
  query("site_id")
    .optional()
    .isMongoId()
    .withMessage("Invalid site_id format")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
  query("device")
    .optional()
    .isString()
    .trim()
    .toLowerCase()
    .matches(constants.WHITE_SPACES_REGEX, "i")
    .withMessage("Invalid device name format"),
  query("site")
    .optional()
    .isString()
    .trim(),
];

const addEventBodyEnhanced = [
  body()
    .isArray()
    .withMessage("the request body should be an array"),

  body("*.device_id")
    .exists()
    .trim()
    .withMessage("device_id is missing")
    .bail()
    .isMongoId()
    .withMessage("device_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),

  body("*.site_id")
    .optional()
    .notEmpty()
    .trim()
    .withMessage("site_id should not be empty if provided")
    .bail()
    .isMongoId()
    .withMessage("site_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),

  body("*.grid_id")
    .optional()
    .notEmpty()
    .trim()
    .withMessage("grid_id should not be empty if provided")
    .bail()
    .isMongoId()
    .withMessage("grid_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),

  body("*.deployment_type")
    .optional()
    .notEmpty()
    .trim()
    .isIn(["static", "mobile"])
    .withMessage("deployment_type must be either 'static' or 'mobile'"),

  // ENHANCED: Enhanced location validation for mobile devices
  body("*.location.latitude.value")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90"),

  body("*.location.longitude.value")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180"),

  body("*.time")
    .exists()
    .trim()
    .withMessage("time is missing")
    .bail()
    .toDate()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage("time must be a valid datetime."),

  body("*.frequency")
    .exists()
    .trim()
    .toLowerCase()
    .withMessage("frequency is missing")
    .bail()
    .isIn(["raw", "hourly", "daily"])
    .withMessage(
      "the frequency value is not among the expected ones which include: raw, hourly and daily",
    ),

  body().custom((measurements, { req }) => {
    // Validate each measurement in the array
    if (Array.isArray(measurements)) {
      for (let i = 0; i < measurements.length; i++) {
        const measurement = measurements[i];

        // Check if both site_id and grid_id are provided
        if (measurement.site_id && measurement.grid_id) {
          throw new Error(
            `Measurement ${i}: Cannot specify both site_id and grid_id in the same measurement`,
          );
        }

        // Check deployment type consistency if provided
        if (measurement.deployment_type) {
          if (
            measurement.deployment_type === "static" &&
            measurement.grid_id &&
            !measurement.site_id
          ) {
            throw new Error(
              `Measurement ${i}: Static deployments should have site_id, not grid_id`,
            );
          }
          if (
            measurement.deployment_type === "mobile" &&
            measurement.site_id &&
            !measurement.grid_id
          ) {
            throw new Error(
              `Measurement ${i}: Mobile deployments should have grid_id, not site_id`,
            );
          }
        }
      }
    }
    return true;
  }),

  handleValidationErrors,
];

const validateDeviceContext = [
  ...commonValidations.tenant,
  query("device_id")
    .optional()
    .isMongoId()
    .withMessage("device_id must be a valid MongoDB ObjectId")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  query("device")
    .optional()
    .isString()
    .trim()
    .withMessage("device must be a string"),
  query("device_number")
    .optional()
    .isInt()
    .withMessage("device_number must be an integer"),
  // At least one identifier must be provided
  oneOf(
    [
      query("device_id").exists(),
      query("device").exists(),
      query("device_number").exists(),
    ],
    "At least one device identifier (device_id, device, or device_number) must be provided",
  ),
  handleValidationErrors,
];

const listByDeploymentType = [
  ...commonValidations.tenant,
  param("deploymentType")
    .isIn(["static", "mobile"])
    .withMessage("deploymentType must be either 'static' or 'mobile'"),
  ...commonValidations.timeRange,
  ...commonValidations.frequency,
  ...commonValidations.external,
  ...commonValidations.recent,
  ...commonValidations.device,
  ...commonValidations.deviceId,
  ...commonValidations.deviceNumber,
  ...commonValidations.site,
  ...commonValidations.siteId,
  ...commonValidations.airqloudId,
  ...commonValidations.primary,
  ...commonValidations.metadata,
  ...commonValidations.test,
  handleValidationErrors,
];

const getDeploymentStats = [
  ...commonValidations.tenant,
  handleValidationErrors,
];

module.exports = {
  ...eventsValidations,
  pagination: commonValidations.pagination,
  deleteValuesOnPlatform,
  addEvents: addEventBodyEnhanced,
  validateDeviceContext,
  listByDeploymentType,
  getDeploymentStats,
};
