const express = require("express");
const router = express.Router();
const eventController = require("@controllers/create-event");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const NetworkModel = require("@models/Network");

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

router.post(
  "/transform",
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
router.post(
  "/single",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage(
        "the tenant query parameter value is not among the expected ones"
      ),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using id"
      ),
    query("name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using name"
      ),
    query("device_number")
      .exists()
      .withMessage(
        "the device_number identifier is missing in request, consider using device_number"
      ),
  ]),
  oneOf([
    [
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
  ]),
  eventController.transmitMultipleSensorValues
);
router.post(
  "/bulk",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage(
        "the tenant query parameter value is not among the expected ones"
      ),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using id"
      ),
    query("name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using name"
      ),
    query("device_number")
      .exists()
      .withMessage(
        "the device_number identifier is missing in request, consider using device_number"
      ),
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
  ]),
  eventController.bulkTransmitMultipleSensorValues
);

module.exports = router;
