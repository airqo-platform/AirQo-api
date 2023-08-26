const express = require("express");
const router = express.Router();
const createHostController = require("@controllers/create-host");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const { logObject } = require("@utils/log");
const phoneUtil =
  require("google-libphonenumber").PhoneNumberUtil.getInstance();
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const NetworkModel = require("@models/Network");
const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const validNetworks = async () => {
  const networks = await NetworkModel("airqo").list({}).lean();
  logObject("networks", networks);
  return networks.map((network) => network.name.toLowerCase());
};

const validateNetwork = async (value) => {
  const networks = await validNetworks();
  if (!networks.includes(value.toLowerCase())) {
    throw new Error("Invalid network");
  }
};

logObject("validateNetwork", validateNetwork);

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

/***************** create-host usecase ***********************/
router.post(
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
      .withMessage("the network value is not among the expected ones"),
  ]),
  oneOf([
    [
      body("first_name")
        .exists()
        .withMessage("the first_name is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the first_name should not be empty")
        .trim(),
      body("last_name")
        .exists()
        .withMessage("the last_name is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the last_name should not be empty")
        .trim(),
      body("network")
        .exists()
        .withMessage("the network is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the network should not be empty if provided")
        .bail()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the network value is not among the expected ones"),
      body("phone_number")
        .exists()
        .withMessage("the phone_number is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the phone_number should not be empty")
        .bail()
        .custom((value) => {
          let parsedPhoneNumber = phoneUtil.parse(value);
          let isValid = phoneUtil.isValidNumber(parsedPhoneNumber);
          return isValid;
        })
        .withMessage(
          "phone_number must be a valid one and start with a country code like +256"
        )
        .trim(),
      body("email")
        .exists()
        .withMessage("the email is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the email should not be empty")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("site_id")
        .exists()
        .withMessage("the site_id is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the site_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        })
        .trim(),
    ],
  ]),
  createHostController.create
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
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the id cannot be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the site_id cannot be empty IF provided")
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  createHostController.list
);

router.put(
  "/:host_id",
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
    param("host_id")
      .exists()
      .withMessage("the host_id is missing in the request")
      .bail()
      .isMongoId()
      .withMessage("host_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      })
      .trim(),
  ]),
  oneOf([
    [
      body("first_name")
        .optional()
        .notEmpty()
        .withMessage("the first_name should not be empty IF provided")
        .trim(),
      body("last_name")
        .optional()
        .notEmpty()
        .withMessage("the last_name should not be empty IF provided")
        .trim(),
      body("phone_number")
        .optional()
        .notEmpty()
        .withMessage("phone_number should not be empty IF provided")
        .bail()
        .trim()
        .custom((value) => {
          let parsedPhoneNumber = phoneUtil.parse(value);
          let isValid = phoneUtil.isValidNumber(parsedPhoneNumber);
          return isValid;
        })
        .withMessage("phone_number must be a valid one")
        .bail(),
      body("email")
        .optional()
        .notEmpty()
        .withMessage("the email should not be empty IF provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("site_id")
        .optional()
        .notEmpty()
        .withMessage("the site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id should be an Object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  createHostController.update
);

router.delete(
  "/:host_id",
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
    param("host_id")
      .exists()
      .withMessage("the host_id is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createHostController.delete
);

router.get(
  "/:host_id",
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
      param("host_id")
        .exists()
        .withMessage("the host_id is missing in the request")
        .bail()
        .notEmpty()
        .withMessage("the provided host_id must not be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  createHostController.list
);

module.exports = router;
