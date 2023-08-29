const express = require("express");
const router = express.Router();
const eventController = require("@controllers/create-event");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const { logElement, logText, logObject } = require("@utils/log");
const ObjectId = mongoose.Types.ObjectId;
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
router.get(
  "/running",
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
    [
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.listRunningDevices
);

router.get(
  "/good",
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
    [
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.listGood
);

router.get(
  "/moderate",
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
    [
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.listModerate
);

router.get(
  "/u4sg",
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
    [
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.listU4sg
);

router.get(
  "/unhealthy",
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
    [
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.listUnhealthy
);

router.get(
  "/very_unhealthy",
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
    [
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.listVeryUnhealthy
);

router.get(
  "/hazardous",
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
    [
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.listHazardous
);

router.post(
  "/",
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
      body("*.network")
        .optional()
        .notEmpty()
        .toLowerCase()
        .isIn(["kcca", "airqo", "urban_better", "usembassy", "nasa", "unep"])
        .withMessage("the network value is not among the expected ones"),
    ],
  ]),
  eventController.addValues
);

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

router.get(
  "/latest",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.listRecent
);

router.get(
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
    [
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
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("lat_long")
        .optional()
        .notEmpty()
        .trim(),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.list
);
router.post(
  "/transmit/single",
  oneOf([
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
      body("s1_pm10")
        // .optional()
        // .notEmpty()
        // .withMessage("s1_pm10 should not be empty if/when provided")
        // .bail()
        // .isNumeric()
        // .withMessage("s1_pm_10 should be an integer value")
        .trim(),
      body("s1_pm2_5")
        // .optional()
        // .notEmpty()
        // .withMessage("s1_pm2_5 should not be empty if/when provided")
        // .bail()
        // .isNumeric()
        // .withMessage("s1_pm2_5 should be an integer value")
        .trim(),
      body("s2_pm2_5")
        // .optional()
        // .notEmpty()
        // .withMessage("s2_pm2_5 should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("s2_pm2_5 should be an integer value")
        .trim(),
      body("s2_pm10")
        // .optional()
        // .notEmpty()
        // .withMessage("s2_pm10 should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("s2_pm10 should be an integer value")
        // .bail()
        .trim(),
      body("latitude")
        // .optional()
        // .notEmpty()
        // .withMessage("provided latitude cannot be empty")
        // .bail()
        // .trim()
        // .matches(constants.LATITUDE_REGEX, "i")
        // .withMessage("please provide valid latitude value")
        // .bail()
        // .custom((value) => {
        //   let dp = decimalPlaces(value);
        //   if (dp < 5) {
        //     return Promise.reject(
        //       "the latitude must have 5 or more characters"
        //     );
        //   }
        //   return Promise.resolve("latitude validation test has passed");
        // })
        // .bail()
        // .customSanitizer((value) => {
        //   return numeral(value).format("0.00000");
        // })
        // .isDecimal({ decimal_digits: 5 })
        // .withMessage("the latitude must have atleast 5 decimal places in it"),
        .trim(),
      body("longitude")
        // .optional()
        // .notEmpty()
        // .withMessage("provided longitude cannot be empty")
        // .bail()
        // .trim()
        // .matches(constants.LONGITUDE_REGEX, "i")
        // .withMessage("please provide valid longitude value")
        // .bail()
        // .custom((value) => {
        //   let dp = decimalPlaces(value);
        //   if (dp < 5) {
        //     return Promise.reject(
        //       "the longitude must have 5 or more characters"
        //     );
        //   }
        //   return Promise.resolve("longitude validation test has passed");
        // })
        // .bail()
        // .customSanitizer((value) => {
        //   return numeral(value).format("0.00000");
        // })
        // .isDecimal({ decimal_digits: 5 })
        // .withMessage("the longitude must have atleast 5 decimal places in it"),
        .trim(),
      body("battery")
        // .optional()
        // .notEmpty()
        // .withMessage("battery should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("battery should be an integer value")
        .trim(),
      body("altitude")
        // .optional()
        // .notEmpty()
        // .withMessage("altitude should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("altitude should be an integer value")
        .trim(),
      body("wind_speed")
        // .optional()
        // .notEmpty()
        // .withMessage("wind_speed should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("wind_speed should be an integer value")
        .trim(),
      body("satellites")
        // .optional()
        // .notEmpty()
        // .withMessage("satellites should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("satellites should be an integer value")
        .trim(),
      body("hdop")
        // .optional()
        // .notEmpty()
        // .withMessage("hdop should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("hdop should be an integer value")
        .trim(),
      body("internal_temperature")
        // .optional()
        // .notEmpty()
        // .withMessage(
        //   "internal_temperature should not be empty if/when provided"
        // )
        // .bail()
        // .isInt()
        // .withMessage("internal_temperature should be an integer value")
        .trim(),
      body("internal_humidity")
        // .optional()
        // .notEmpty()
        // .withMessage("internal_humidity should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("internal_humidity should be an integer value")
        .trim(),
      body("external_temperature")
        // .optional()
        // .notEmpty()
        // .withMessage(
        //   "external_temperature should not be empty if/when provided"
        // )
        // .bail()
        // .isInt()
        // .withMessage("external_temperature should be an integer value")
        .trim(),
      body("external_humidity")
        // .optional()
        // .notEmpty()
        // .withMessage("external_humidity should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("external_humidity should be an integer value")
        .trim(),
      body("external_pressure")
        // .optional()
        // .notEmpty()
        // .withMessage("external_pressure should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("external_pressure should be an integer value")
        .trim(),
      body("external_altitude")
        // .optional()
        // .notEmpty()
        // .withMessage("external_altitude should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("external_altitude should be an integer value")
        .trim(),
      body("status")
        .optional()
        .notEmpty()
        .withMessage("status cannot be empty if provided"),
    ],
  ]),
  eventController.transmitMultipleSensorValues
);

router.post(
  "/transmit/bulk",
  oneOf([
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
      body("*.s1_pm10")
        // .optional()
        // .notEmpty()
        // .withMessage("s1_pm10 should not be empty if/when provided")
        // .bail()
        // .isNumeric()
        // .withMessage("s1_pm_10 should be an integer value")
        .trim(),
      body("*.s1_pm2_5")
        // .optional()
        // .notEmpty()
        // .withMessage("s1_pm2_5 should not be empty if/when provided")
        // .bail()
        // .isNumeric()
        // .withMessage("s1_pm2_5 should be an integer value")
        .trim(),
      body("*.s2_pm2_5")
        // .optional()
        // .notEmpty()
        // .withMessage("s2_pm2_5 should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("s2_pm2_5 should be an integer value")
        .trim(),
      body("*.s2_pm10")
        .optional()
        // .notEmpty()
        // .withMessage("s2_pm10 should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("s2_pm10 should be an integer value")
        // .bail()
        .trim(),
      body("*.latitude")
        // .optional()
        // .notEmpty()
        // .withMessage("provided latitude cannot be empty")
        // .bail()
        // .trim()
        // .matches(constants.LATITUDE_REGEX, "i")
        // .withMessage("please provide valid latitude value")
        // .bail()
        // .custom((value) => {
        //   let dp = decimalPlaces(value);
        //   if (dp < 5) {
        //     return Promise.reject(
        //       "the latitude must have 5 or more characters"
        //     );
        //   }
        //   return Promise.resolve("latitude validation test has passed");
        // })
        // .bail()
        // .customSanitizer((value) => {
        //   return numeral(value).format("0.00000");
        // })
        // .isDecimal({ decimal_digits: 5 })
        // .withMessage("the latitude must have atleast 5 decimal places in it"),
        .trim(),
      body("*.longitude")
        // .optional()
        // .notEmpty()
        // .withMessage("provided longitude cannot be empty")
        // .bail()
        // .trim()
        // .matches(constants.LONGITUDE_REGEX, "i")
        // .withMessage("please provide valid longitude value")
        // .bail()
        // .custom((value) => {
        //   let dp = decimalPlaces(value);
        //   if (dp < 5) {
        //     return Promise.reject(
        //       "the longitude must have 5 or more characters"
        //     );
        //   }
        //   return Promise.resolve("longitude validation test has passed");
        // })
        // .bail()
        // .customSanitizer((value) => {
        //   return numeral(value).format("0.00000");
        // })
        // .isDecimal({ decimal_digits: 5 })
        // .withMessage("the longitude must have atleast 5 decimal places in it"),
        .trim(),
      body("*.battery")
        // .optional()
        // .notEmpty()
        // .withMessage("battery should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("battery should be an integer value")
        .trim(),
      body("*.altitude")
        // .optional()
        // .notEmpty()
        // .withMessage("altitude should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("altitude should be an integer value")
        .trim(),
      body("*.wind_speed")
        // .optional()
        // .notEmpty()
        // .withMessage("wind_speed should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("wind_speed should be an integer value")
        .trim(),
      body("*.satellites")
        // .optional()
        // .notEmpty()
        // .withMessage("satellites should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("satellites should be an integer value")
        .trim(),
      body("*.hdop")
        // .optional()
        // .notEmpty()
        // .withMessage("hdop should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("hdop should be an integer value")
        .trim(),
      body("*.internal_temperature")
        // .optional()
        // .notEmpty()
        // .withMessage(
        //   "internal_temperature should not be empty if/when provided"
        // )
        // .bail()
        // .isInt()
        // .withMessage("internal_temperature should be an integer value")
        .trim(),
      body("*.internal_humidity")
        // .optional()
        // .notEmpty()
        // .withMessage("internal_humidity should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("internal_humidity should be an integer value")
        .trim(),
      body("*.external_temperature")
        // .optional()
        // .notEmpty()
        // .withMessage(
        //   "external_temperature should not be empty if/when provided"
        // )
        // .bail()
        // .isInt()
        // .withMessage("external_temperature should be an integer value")
        .trim(),
      body("*.external_humidity")
        // .optional()
        // .notEmpty()
        // .withMessage("external_humidity should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("external_humidity should be an integer value")
        .trim(),
      body("*.external_pressure")
        // .optional()
        // .notEmpty()
        // .withMessage("external_pressure should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("external_pressure should be an integer value")
        .trim(),
      body("*.external_altitude")
        // .optional()
        // .notEmpty()
        // .withMessage("external_altitude should not be empty if/when provided")
        // .bail()
        // .isInt()
        // .withMessage("external_altitude should be an integer value")
        .trim(),
      body("*.status"),
      // .optional()
      // .notEmpty()
      // .withMessage("status cannot be empty if provided"),
    ],
  ]),
  eventController.bulkTransmitMultipleSensorValues
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
