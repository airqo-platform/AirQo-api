const express = require("express");
const router = express.Router();
const eventController = require("@controllers/create-event");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const NetworkModel = require("@models/Network");
const {
  check,
  oneOf,
  query,
  body,
  param,
  validationResult,
} = require("express-validator");

const decimalPlaces = require("decimal-places");
const numeral = require("numeral");

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

const headers = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(validatePagination);

/******************* create-events use-case *******************************/

router.get("/map", eventController.readingsForMap);
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
  eventController.recentReadings
);
router.get("/fetchAndStoreData", eventController.fetchAndStoreData);

module.exports = router;
