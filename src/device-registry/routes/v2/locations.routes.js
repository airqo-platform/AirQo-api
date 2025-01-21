const express = require("express");
const router = express.Router();
const locationController = require("@controllers/location.controller");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const createAirQloudUtil = require("@utils/airqloud.util");
const { logObject, logText, logElement } = require("@utils/shared");
const isEmpty = require("is-empty");
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
router.use(validatePagination);

/************************** locations usecase  *******************/
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
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
        .bail()
        .custom((value) => {
          return createAirQloudUtil.initialIsCapital(value);
        })
        .withMessage("the name should start with a capital letter")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.hasNoWhiteSpace(value);
        })
        .withMessage("the name should not have whitespace in it")
        .trim(),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the metadata should not be empty if provided"),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("location")
        .exists()
        .withMessage("the location is is missing in your request")
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the location should be an object")
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the location should not be empty when provided"),
      body("location.coordinates")
        .exists()
        .withMessage("location.coordinates is is missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .exists()
        .withMessage("location.type is is missing in your request")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
      body("admin_level")
        .exists()
        .withMessage("admin_level is is missing in your request")
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
          "state",
          "province",
        ])
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
      body("location_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array")
        .bail()
        .notEmpty()
        .withMessage("the tags should not be empty"),
      body("isCustom")
        .optional()
        .notEmpty()
        .withMessage("isCustom cannot be empty")
        .isBoolean()
        .withMessage("isCustom must be Boolean")
        .trim(),
    ],
  ]),
  locationController.register
);

router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
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
      query("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
          "state",
          "province",
        ])
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
    ],
  ]),
  locationController.list
);

router.put(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the location identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
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
        .withMessage("the name should not be empty")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.initialIsCapital(value);
        })
        .withMessage("the name should start with a capital letter")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.hasNoWhiteSpace(value);
        })
        .withMessage("the name should not have whitespace in it")
        .trim(),
      body("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
          "state",
          "province",
        ])
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
      body("description")
        .optional()
        .trim(),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the metadata should not be empty if provided"),
      body("long_name")
        .optional()
        .notEmpty()
        .withMessage("the long_name should not be empty")
        .trim(),
      body("isCustom")
        .optional()
        .isBoolean()
        .withMessage("isCustom must be a boolean value")
        .trim(),
      body("location")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the location should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the location should not be empty when provided"),
      body("location.coordinates")
        .optional()
        .notEmpty()
        .withMessage("the location.coordinates should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .optional()
        .notEmpty()
        .withMessage("the location.type should not be empty")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
      body("location_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
    ],
  ]),
  locationController.update
);

router.delete(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the location identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  locationController.delete
);

module.exports = router;
