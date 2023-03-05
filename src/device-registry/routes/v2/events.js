const express = require("express");
const router = express.Router();
const eventController = require("@controllers/create-event");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const numeral = require("numeral");
const { logElement, logText, logObject } = require("@utils/log");
const { isBoolean, isEmpty } = require("underscore");
const decimalPlaces = require("decimal-places");

const headers = (req, res, next) => {
  // const allowedOrigins = constants.DOMAIN_WHITELIST;
  // const origin = req.headers.origin;
  // if (allowedOrigins.includes(origin)) {
  //   res.setHeader("Access-Control-Allow-Origin", origin);
  // }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);

/******************* create-event use-case *******************************/
router.post(
  "/",
  oneOf([
    body()
      .isArray()
      .withMessage("the request body should be an array"),
  ]),
  oneOf([
    [
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
        .withMessage(
          "the is_device_primary should not be empty if/when provided"
        )
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
        .optional()
        .notEmpty()
        .withMessage("the frequency should not be empty if/when provided")
        .trim()
        .bail()
        .isIn(["raw", "hourly", "daily"])
        .withMessage(
          "the frequency value is not among the expected ones which include: raw, hourly and daily"
        ),
      body("*.is_test_data")
        .optional()
        .notEmpty()
        .withMessage("the is_test_data should not be empty if/when provided")
        .trim()
        .isBoolean()
        .withMessage("is_test_data should be boolean"),
      body("*.device")
        .optional()
        .notEmpty()
        .withMessage("the device should not be empty if/when provided")
        .trim(),
      body("*.site")
        .optional()
        .notEmpty()
        .withMessage("the site should not be empty if/when provided")
        .trim(),
      body("*.device_number")
        .optional()
        .notEmpty()
        .isInt()
        .withMessage("the device_number should be an integer value")
        .bail()
        .trim(),
      body("*.latitude")
        .optional()
        .notEmpty()
        .withMessage("the latitude should not be empty if/when provided")
        .bail()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
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
      body("*.longitude")
        .optional()
        .notEmpty()
        .withMessage("the longitude should not be empty if/when provided")
        .bail()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
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
      body("*.pm2_5")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the pm2_5 should be a number")
        .bail()
        .trim(),
      body("*.pm10")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the pm10 should be a number")
        .bail()
        .trim(),
      body("*.s1_pm2_5")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the s1_pm2_5 should be a number")
        .bail()
        .trim(),
      body("*.s1_pm10")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the s1_pm10 should be a number")
        .bail()
        .trim(),
      body("*.s2_pm2_5")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the s2_pm2_5 should be a number")
        .bail()
        .trim(),
      body("*.s2_pm10")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the s2_pm10 should be a number")
        .bail()
        .trim(),
      body("*.pm2_5_calibrated_value")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the pm2_5_calibrated_value should be a number")
        .bail()
        .trim(),
      body("*.pm10_calibrated_value")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the pm10_calibrated_value should be a number")
        .bail()
        .trim(),
      body("*.altitude")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the altitude should be a number")
        .bail()
        .trim(),
      body("*.wind_speed")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the wind_speed should be a number")
        .bail()
        .trim(),
      body("*.external_temperature")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the external_temperature should be a number")
        .bail()
        .trim(),
      body("*.external_humidity")
        .optional()
        .notEmpty()
        .isFloat()
        .withMessage("the external_humidity should be a number")
        .bail()
        .trim(),
    ],
  ]),
  eventController.create
);

router.post(
  "/transform",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body()
      .isArray()
      .withMessage("the request body should be an array"),
  ]),
  oneOf([
    [
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
          "the frequency value is not among the expected ones which include: raw, hourly and daily"
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
  ]),
  eventController.transform
);
router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo", "view", "urban_better"])
        .withMessage("the tenant value is not among the expected ones"),
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
      query("frequency")
        .optional()
        .notEmpty()
        .withMessage("the frequency cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["hourly", "daily", "raw"])
        .withMessage(
          "the frequency value is not among the expected ones which include: hourly, daily,and raw"
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
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
    ],
  ]),
  eventController.listFromBigQuery
);

router.get(
  "/latest",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo", "view", "urban_better"])
        .withMessage("the tenant value is not among the expected ones"),
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
      query("frequency")
        .optional()
        .notEmpty()
        .withMessage("the frequency cannot be empty if provided")
        .trim()
        .toLowerCase()
        .isIn(["hourly", "daily", "raw"])
        .withMessage(
          "the frequency value is not among the expected ones which include: hourly, daily,and raw"
        ),
      query("format")
        .optional()
        .notEmpty()
        .withMessage("the format cannot be empty if provided")
        .trim()
        .toLowerCase()
        .isIn(["json", "csv"])
        .withMessage(
          "the frequency value is not among the expected ones which include: csv and json"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
    ],
  ]),
  eventController.latestFromBigQuery
);

router.post(
  "/transmit",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant query parameter should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage(
          "the tenant query parameter value is not among the expected ones"
        ),
      query("type")
        .exists()
        .withMessage("type query parameter should be provided")
        .trim()
        .toLowerCase()
        .isIn(["one", "many", "bulk"])
        .withMessage(
          "the type query parameter value is not among the expected ones which are: one, many, bulk"
        ),
      query("name")
        .exists()
        .withMessage("type name parameter should be provided")
        .trim(),
    ],
  ]),
  oneOf([
    body()
      .isArray()
      .withMessage("the request body should be an array"),
  ]),
  oneOf([
    [
      body("*.time")
        .exists()
        .trim()
        .withMessage("time is missing")
        .bail()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("time must be a valid datetime."),
      body("*.pm10")
        .optional()
        .notEmpty()
        .withMessage("pm10 should not be empty if/when provided")
        .bail()
        .isNumeric()
        .withMessage("pm_10 should be an integer value")
        .trim(),
      body("*.pm2_5")
        .optional()
        .notEmpty()
        .withMessage("pm2_5 should not be empty if/when provided")
        .bail()
        .isNumeric()
        .withMessage("pm2_5 should be an integer value")
        .trim(),
      body("*.s2_pm2_5")
        .optional()
        .notEmpty()
        .withMessage("s2_pm2_5 should not be empty if/when provided")
        .bail()
        .isInt()
        .withMessage("s2_pm2_5 should be an integer value")
        .trim(),
      body("*.s2_pm10")
        .optional()
        .notEmpty()
        .withMessage("s2_pm10 should not be empty if/when provided")
        .bail()
        .isInt()
        .withMessage("s2_pm10 should be an integer value")
        .bail()
        .trim(),
      body("*.latitude")
        .optional()
        .notEmpty()
        .withMessage("provided latitude cannot be empty")
        .bail()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
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
      body("*.longitude")
        .optional()
        .notEmpty()
        .withMessage("provided longitude cannot be empty")
        .bail()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
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
      body("*.battery")
        .optional()
        .notEmpty()
        .withMessage("battery should not be empty if/when provided")
        .bail()
        .isInt()
        .withMessage("battery should be an integer value")
        .trim(),
      body("*.others")
        .optional()
        .notEmpty()
        .withMessage("others cannot be empty if provided"),
      body("*.status")
        .optional()
        .notEmpty()
        .withMessage("status cannot be empty if provided"),
    ],
  ]),
  eventController.transmitValues
);
/*clear events*/
router.delete(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("device_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the device_id"
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
        "the record's identifier is missing in request, consider using the device_id"
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
        "the device identifier is missing in request, consider using the device name"
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  eventController.deleteValuesOnPlatform
);

module.exports = router;
