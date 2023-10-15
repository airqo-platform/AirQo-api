const express = require("express");
const router = express.Router();
const eventController = require("@controllers/create-event");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const NetworkModel = require("@models/Network");
const authorization = require("@middleware/authorize");
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
// router.use(authorization);

/******************* create-event use-case *******************************/
router.get(
  "/running",
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
        .custom(validateNetwork)
        .withMessage("the network value is not among the expected ones"),
    ],
  ]),
  eventController.addValues
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
  "/all",
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
      query("language")
        .optional()
        .notEmpty()
        .withMessage("the language cannot be empty when provided")
        .bail()
        .trim(),
    ],
  ]),
  eventController.listEventsForAllDevices
);

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

router.get(
  "/view",
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
  eventController.view
);

/*clear events*/
router.delete(
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
