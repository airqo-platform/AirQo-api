const express = require("express");
const router = express.Router();
const healthTipController = require("@controllers/create-health-tips");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");

const { getModelByTenant } = require("@config/database");

const NetworkSchema = require("@models/Network");
const NetworkModel = (tenant) => {
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(tenant, "network", NetworkSchema);
    return networks;
  }
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

/******************* create-health-tip use-case ***************/
router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
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
        .withMessage("this tip identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  healthTipController.list
);
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("description")
        .exists()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
      body("title")
        .exists()
        .withMessage("the title is missing in request")
        .bail()
        .trim(),
      body("image")
        .exists()
        .withMessage("the image is missing in request")
        .bail()
        .trim(),
      body("aqi_category")
        .exists()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
    ],
  ]),
  healthTipController.create
);
router.put(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("the tenant cannot be empty, if provided")
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
        "the tip unique identifier is missing in request, consider using the id"
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
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      body("description")
        .optional()
        .notEmpty()
        .withMessage("the description is missing in request")
        .bail()
        .trim(),
      body("title")
        .optional()
        .notEmpty()
        .withMessage("the title is missing in request")
        .bail()
        .trim(),
      body("image")
        .optional()
        .notEmpty()
        .withMessage("the image is missing in request")
        .bail()
        .trim(),
      body("aqi_category")
        .optional()
        .notEmpty()
        .withMessage("the aqi_category is missing in request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.AQI_CATEGORIES)
        .withMessage(
          "the aqi_category is not among the expected ones: good,moderate,u4sg,unhealthy,very_unhealthy,hazardous"
        ),
    ],
  ]),
  healthTipController.update
);
router.delete(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
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
        "the tip identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  healthTipController.delete
);

module.exports = router;
