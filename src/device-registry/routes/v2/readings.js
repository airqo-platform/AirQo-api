const express = require("express");
const router = express.Router();
const redis = require("@config/redis");
const cacheGenerator = require("@utils/cache-id-generator");
const eventController = require("@controllers/create-event");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { oneOf, query, validationResult, param } = require("express-validator");
const validateOptionalObjectId = require("@middleware/validateOptionalObjectId");
// const { cacheMiddleware, createCacheMiddleware } = require("@middleware/cache");

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

const cacheMiddleware = async (req, res, next) => {
  try {
    const cacheID = cacheGenerator.generateCacheID(req, next);

    // Attach cache-related data to the request object
    req.cacheID = cacheID;
    req.cache = {
      get: async () => await redis.get(cacheID),
      set: async (data) => await redis.set(cacheID, JSON.stringify(data)),
    };

    // Check for cached data
    const cachedData = await redis.get(cacheID);
    if (cachedData) {
      req.cachedData = JSON.parse(cachedData);
    }

    // Always call next() to proceed to the route handler
    next();
  } catch (error) {
    next(error);
  }
};

// const customCacheMiddleware = createCacheMiddleware({
//   timeout: 3000, // 3-second timeout
//   logErrors: true,
//   fallbackOnError: true,
// });

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
// router.use(cacheMiddleware);

/******************* create-events use-case *******************************/

router.get("/map", eventController.readingsForMap);
router.get(
  "/best-air-quality",
  [
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
    query("pollutant")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("the pollutant cannot be empty IF provided")
      .bail()
      .toLowerCase()
      .isIn(["pm2_5", "pm10", "no2"])
      .withMessage("valid values include: pm2_5, pm10, no2"),
    query("language")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("language cannot be empty if provided")
      .bail()
      .isLength({ min: 2, max: 5 })
      .withMessage("language should be a valid ISO 639-1 code"),
    query("limit")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("limit cannot be empty if provided")
      .bail()
      .isInt({ min: 1, max: 2000 })
      .withMessage("limit must be between 1 and 2000")
      .toInt(),
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

  eventController.getBestAirQuality
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
        .withMessage("device_id cannot be empty IF provided")
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
        .withMessage("site_id cannot be empty IF provided"),
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
  eventController.listReadingAverages
);
router.get("/fetchAndStoreData", eventController.fetchAndStoreData);

module.exports = router;
