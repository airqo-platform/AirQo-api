const express = require("express");
const router = express.Router();
const eventController = require("@controllers/create-event");
const {
  check,
  oneOf,
  query,
  body,
  param,
  validationResult,
} = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const NetworkModel = require("@models/Network");
const decimalPlaces = require("decimal-places");
const numeral = require("numeral");
const rateLimit = require("express-rate-limit");
const averagesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Define a custom function to check if a value is a valid ObjectId
const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

const addCategoryQueryParam = (req, res, next) => {
  req.query.path = "public";
  next();
};

const validNetworks = async () => {
  const networks = await NetworkModel("airqo").distinct("name");
  return networks.map((network) => network.toLowerCase());
};

const validateNetwork = async (value) => {
  const networks = await validNetworks();
  if (!networks.includes(value.toLowerCase())) {
    throw new Error("Invalid network");
  }
};

// Custom validation function to check if values are valid MongoDB ObjectIds
const isValidObjectIds = (value) => {
  const ids = value.split(",");
  return ids.every((id) => /^[0-9a-fA-F]{24}$/.test(id)); // Check if each ID is a valid ObjectId
};

// Middleware for validation
const validateObjectId = (paramName) => {
  return [
    query(paramName)
      .custom(isValidObjectIds)
      .withMessage(`Invalid ${paramName}`),
  ];
};

const validateOptionalObjectId = (field) => {
  return (req, res, next) => {
    if (req.query[field]) {
      let values;
      if (Array.isArray(req.query[field])) {
        values = req.query[field];
      } else {
        values = req.query[field].toString().split(",");
      }
      for (const value of values) {
        if (!isValidObjectId(value)) {
          throw new Error(`Invalid ${field} format: ${value}`);
        }
      }
    }
    next();
  };
};

const validatePagination = (req, res, next) => {
  let limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 1000;
  }
  if (limit > 2000) {
    limit = 2000;
  }
  if (isNaN(skip) || skip < 0) {
    req.query.skip = 0;
  }
  req.query.limit = limit;

  next();
};

const headers = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  // Check if the request method is OPTIONS (preflight request)
  if (req.method === "OPTIONS") {
    res.sendStatus(200); // Respond with a 200 status for preflight requests
  } else {
    next(); // Continue to the next middleware for non-preflight requests
  }
};
router.use(headers);
router.use(validatePagination);
// router.use(addCategoryQueryParam);

router.get(
  "/",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
      query("device")
        .optional()
        .notEmpty()
        .withMessage("device cannot be empty IF provided")
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .withMessage("the provided device_id cannot be empty IF provided")
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .withMessage("lat_long cannot be empty IF provided")
        .bail()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id cannot be empty IF provided"),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id cannot be empty IF provided"),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id cannot be empty IF provided"),
      query("device_number")
        .optional()
        .notEmpty()
        .withMessage("the provided device_number cannot be empty IF provided")
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .withMessage("the provided site cannot be empty IF provided")
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id cannot be empty IF provided")
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .withMessage("primary cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.list
);
router.get(
  "/historical",
  [
    validateOptionalObjectId("cohort_id"),
    validateOptionalObjectId("grid_id"),
    validateOptionalObjectId("device_id"),
    validateOptionalObjectId("site_id"),
  ],
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
      query("device")
        .optional()
        .notEmpty()
        .withMessage("device cannot be empty IF provided")
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .withMessage("the provided device_id cannot be empty IF provided")
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .withMessage("lat_long cannot be empty IF provided")
        .bail()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id cannot be empty IF provided"),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id cannot be empty IF provided"),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id cannot be empty IF provided"),
      query("device_number")
        .optional()
        .notEmpty()
        .withMessage("the provided device_number cannot be empty IF provided")
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .withMessage("the provided site cannot be empty IF provided")
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id cannot be empty IF provided")
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .withMessage("primary cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: errors.array()[0].msg,
        },
      });
    }

    const { cohort_id, grid_id, device_id, site_id } = req.query;

    if (cohort_id && grid_id) {
      return res.status(400).json({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "You cannot provide both cohort_id and grid_id",
        },
      });
    }

    if (device_id && site_id) {
      return res.status(400).json({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "You cannot provide both device_id and site_id",
        },
      });
    }

    next(); // Proceed to the route handler
  },
  eventController.listHistorical
);
router.get(
  "/recent",
  [
    validateOptionalObjectId("cohort_id"),
    validateOptionalObjectId("grid_id"),
    validateOptionalObjectId("device_id"),
    validateOptionalObjectId("site_id"),
  ],
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
      query("device")
        .optional()
        .notEmpty()
        .withMessage("device cannot be empty IF provided")
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .withMessage("the provided device_id cannot be empty IF provided")
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .withMessage("lat_long cannot be empty IF provided")
        .bail()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id cannot be empty IF provided"),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id cannot be empty IF provided"),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id cannot be empty IF provided"),
      query("device_number")
        .optional()
        .notEmpty()
        .withMessage("the provided device_number cannot be empty IF provided")
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .withMessage("the provided site cannot be empty IF provided")
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id cannot be empty IF provided")
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .withMessage("primary cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: errors.array()[0].msg,
        },
      });
    }

    const { cohort_id, grid_id, device_id, site_id } = req.query;

    if (cohort_id && grid_id) {
      return res.status(400).json({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "You cannot provide both cohort_id and grid_id",
        },
      });
    }

    if (device_id && site_id) {
      return res.status(400).json({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "You cannot provide both device_id and site_id",
        },
      });
    }

    next(); // Proceed to the route handler
  },
  eventController.listRecent
);
router.get(
  "/latest",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
      query("device")
        .optional()
        .notEmpty()
        .withMessage("device cannot be empty IF provided")
        .bail()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .withMessage("device_id cannot be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("lat_long")
        .optional()
        .notEmpty()
        .withMessage("lat_long cannot be empty IF provided")
        .bail()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("airqloud_id cannot be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("device_number")
        .optional()
        .notEmpty()
        .withMessage("device_number cannot be empty IF provided")
        .bail()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .withMessage("site cannot be empty IF provided")
        .bail()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("site_id cannot be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("primary")
        .optional()
        .notEmpty()
        .withMessage("primary cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listRecent
);
router.get(
  "/location/:latitude/:longitude",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("latitude")
        .exists()
        .withMessage("the latitude is is missing in your request")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
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
        .withMessage("the longitude is is missing in your request")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByLatLong
);
/***
 * Sites
 */
router.get(
  "/sites/:site_id/historical",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listHistorical
);
router.get(
  "/sites/:site_id/recent",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listRecent
);
/**
 * @route GET /sites/:site_id/averages
 * @description Get average measurements for a specific site
 * @param {string} site_id - MongoDB ObjectId of the site
 * @query {string} [tenant] - Optional tenant identifier
 * @query {string} [startTime] - ISO8601 start time
 * @query {string} [endTime] - ISO8601 end time
 * @query {string} [frequency] - Data frequency (hourly|daily|raw|minute)
 * @returns {object} Average measurements data
 */
router.get(
  "/sites/:site_id/averages",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  averagesLimiter,
  eventController.listAverages
);

/**
 * @route GET /sites/:site_id/averages
 * @description Get average measurements for a specific site
 * @param {string} site_id - MongoDB ObjectId of the site
 * @query {string} [tenant] - Optional tenant identifier
 * @query {string} [startTime] - ISO8601 start time
 * @query {string} [endTime] - ISO8601 end time
 * @query {string} [frequency] - Data frequency (hourly|daily|raw|minute)
 * @returns {object} Average measurements data
 */
router.get(
  "/sites/:site_id/v2-averages",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  averagesLimiter,
  eventController.listAveragesV2
);

router.get(
  "/sites/:site_id",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
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
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.list
);
/***
 * AirQlouds
 */
router.get(
  "/airqlouds/:airqloud_id/historical",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("airqloud_id")
        .exists()
        .withMessage("the airqloud_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided airqloud_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByAirQloudHistorical
);
router.get(
  "/airqlouds/:airqloud_id/recent",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("airqloud_id")
        .exists()
        .withMessage("the airqloud_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided airqloud_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByAirQloud
);
router.get(
  "/airqlouds/:airqloud_id",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("airqloud_id")
        .exists()
        .withMessage("the airqloud_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided airqloud_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByAirQloud
);
/***
 * Grids
 */
router.get(
  "/grids/:grid_id/historical",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),

  oneOf([
    [
      param("grid_id")
        .exists()
        .withMessage("the grid_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided grid_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByGridHistorical
);
router.get(
  "/grids/:grid_id/recent",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),

  oneOf([
    [
      param("grid_id")
        .exists()
        .withMessage("the grid_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided grid_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByGrid
);
router.get(
  "/grids/:grid_id",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),

  oneOf([
    [
      param("grid_id")
        .exists()
        .withMessage("the grid_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided grid_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByGrid
);
/***
 * Cohorts
 */
router.get(
  "/cohorts/:cohort_id/historical",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("cohort_id")
        .exists()
        .withMessage("the cohort_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided cohort_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByCohortHistorical
);
router.get(
  "/cohorts/:cohort_id/recent",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("cohort_id")
        .exists()
        .withMessage("the cohort_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided cohort_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByCohort
);
router.get(
  "/cohorts/:cohort_id",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("cohort_id")
        .exists()
        .withMessage("the cohort_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided cohort_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listByCohort
);
/***
 * Devices
 */
router.get(
  "/devices/:device_id/historical",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("device_id")
        .exists()
        .withMessage("the device_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided device_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listHistorical
);
router.get(
  "/devices/:device_id/recent",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("device_id")
        .exists()
        .withMessage("the device_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided device_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.listRecent
);
router.get(
  "/devices/:device_id",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      param("device_id")
        .exists()
        .withMessage("the device_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided device_id cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  oneOf([
    [
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
      query("metadata")
        .optional()
        .notEmpty()
        .withMessage("metadata cannot be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
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
  ]),
  eventController.list
);

module.exports = router;
