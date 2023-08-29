const express = require("express");
const router = express.Router();
const createCohortController = require("@controllers/create-cohort");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- cohorts-route-v2`
);
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
  // Retrieve the limit and skip values from the query parameters
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);

  // Validate and sanitize the limit value
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;

  // Validate and sanitize the skip value
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;

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

/************************ the core functionality ********************/

router.delete(
  "/:cohort_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("cohort_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("cohort_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createCohortController.delete
);
router.put(
  "/:cohort_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("cohort_id")
      .exists()
      .withMessage("the cohort_ids is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("cohort_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("name")
        .optional()
        .notEmpty()
        .withMessage("the name should not be empty if provided"),
      body("description")
        .optional()
        .notEmpty()
        .withMessage("the description should not be empty if provided"),
      body("network")
        .optional()
        .notEmpty()
        .withMessage("the description should not be empty if provided")
        .bail()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the network value is not among the expected ones"),
    ],
  ]),

  createCohortController.update
);

router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("name")
        .trim()
        .exists()
        .withMessage("the name is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the name should not be empty"),
      body("description")
        .trim()
        .optional()
        .notEmpty(),
      body("network")
        .trim()
        .exists()
        .withMessage("the network is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the network should not be empty")
        .bail()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the network value is not among the expected ones"),
    ],
  ]),
  createCohortController.create
);
router.get(
  "/",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
    ],
  ]),
  createCohortController.list
);
router.get(
  "/summary",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
    ],
  ]),
  createCohortController.listSummary
);
router.get(
  "/dashboard",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
    ],
  ]),
  createCohortController.listDashboard
);
/************************ managing Cohorts ********************/
router.put(
  "/:cohort_id/assign-device/:device_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("cohort_id")
        .exists()
        .withMessage("the network ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the network ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("device_id")
        .exists()
        .withMessage("the device ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the device ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),

  createCohortController.assignOneDeviceToCohort
);
router.get(
  "/:cohort_id/assigned-devices",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("cohort_id")
      .optional()
      .isMongoId()
      .withMessage("cohort_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createCohortController.listAssignedDevices
);
router.get(
  "/:cohort_id/available-devices",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("cohort_id")
      .optional()
      .isMongoId()
      .withMessage("cohort_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createCohortController.listAvailableDevices
);
router.post(
  "/:cohort_id/assign-devices",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("cohort_id")
        .exists()
        .withMessage("the network ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the network ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_ids")
        .exists()
        .withMessage("the device_ids should be provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the device_ids should be an array")
        .bail()
        .notEmpty()
        .withMessage("the device_ids should not be empty"),
      body("device_ids.*")
        .isMongoId()
        .withMessage("device_id provided must be an object ID"),
    ],
  ]),

  createCohortController.assignManyDevicesToCohort
);
router.delete(
  "/:cohort_id/unassign-many-devices",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("cohort_id")
        .exists()
        .withMessage("the network ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the network ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_ids")
        .exists()
        .withMessage("the device_ids should be provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the device_ids should be an array")
        .bail()
        .notEmpty()
        .withMessage("the device_ids should not be empty"),
      body("device_ids.*")
        .isMongoId()
        .withMessage("device_id provided must be an object ID"),
    ],
  ]),

  createCohortController.unAssignManyDevicesFromCohort
);
router.delete(
  "/:cohort_id/unassign-device/:device_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("cohort_id")
        .exists()
        .withMessage("the network ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the network ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("device_id")
        .exists()
        .withMessage("the device ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("device ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),

  createCohortController.unAssignOneDeviceFromCohort
);
/************************ networks ******************************/
router.post(
  "/networks",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("name")
        .exists()
        .withMessage("the name is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the name should not be empty")
        .trim(),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
    ],
  ]),
  createCohortController.createNetwork
);
router.put("/networks/:net_id", createCohortController.updateNetwork);
router.delete("/networks/:net_id", createCohortController.deleteNetwork);
router.get("/networks", createCohortController.listNetworks);
router.get("/networks/:net_id", createCohortController.listNetworks);
router.get(
  "/:cohort_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("cohort_id")
      .optional()
      .isMongoId()
      .withMessage("cohort_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createCohortController.list
);
module.exports = router;
