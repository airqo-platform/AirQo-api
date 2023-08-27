const express = require("express");
const router = express.Router();
const createTransactionController = require("@controllers/create-transaction");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const { logObject } = require("@utils/log");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const phoneUtil =
  require("google-libphonenumber").PhoneNumberUtil.getInstance();

const generatebatchId = () => {
  const randomHex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return (
    randomHex.substring(0, 8) +
    "-" +
    randomHex.substring(8, 12) +
    "-" +
    randomHex.substring(12, 16) +
    "-" +
    randomHex.substring(16, 20) +
    "-" +
    randomHex.substring(20)
  );
};

const generaterequestId = () => {
  const randomHex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return (
    randomHex.substring(0, 8) +
    "-" +
    randomHex.substring(8, 12) +
    "-" +
    randomHex.substring(12, 16) +
    "-" +
    randomHex.substring(16, 20) +
    "-" +
    randomHex.substring(20)
  );
};

const commonFields = {
  channelId: constants.XENTE_CHANNEL_ID,
  customerId: constants.XENTE_CUSTOMER_ID,
  customerPhone: constants.XENTE_CUSTOMER_PHONE,
  customerEmail: constants.XENTE_CUSTOMER_EMAIL,
  memo: constants.XENTE_MEMO,
  metadata: constants.XENTE_METADATA,
  batchId: generatebatchId(),
  requestId: generaterequestId(),
};

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const addCommonFieldsToBody = (req, res, next) => {
  const {
    channelId,
    customerId,
    customerPhone,
    customerEmail,
    memo,
    metadata,
    batchId,
    requestId,
  } = commonFields;
  req.body.channelId = channelId;
  req.body.customerId = customerId;
  req.body.customerPhone = customerPhone;
  req.body.customerEmail = customerEmail;
  req.body.memo = memo;
  req.body.metadata = metadata;
  req.body.batchId = batchId;
  req.body.requestId = requestId;
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
  "/hosts/:host_id/payments",
  addCommonFieldsToBody,
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("amount")
        .exists()
        .withMessage("the amount is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the amount should not be empty")
        .bail()
        .isInt()
        .withMessage("the amount should be a number")
        .trim(),
      param("host_id")
        .exists()
        .withMessage("the host_id is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the host_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("the host_id should be an Object ID"),
    ],
  ]),
  createTransactionController.sendMoneyToHost
);

router.post(
  "/accounts/payments",
  addCommonFieldsToBody,
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("amount")
        .exists()
        .withMessage("the amount is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the amount should not be empty")
        .bail()
        .isInt()
        .withMessage("the amount should be a number")
        .trim(),
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
        .withMessage("phone_number must be a valid one")
        .trim(),
    ],
  ]),
  createTransactionController.addMoneyToOrganisationAccount
);

router.post(
  "/accounts/receive",
  addCommonFieldsToBody,
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("amount")
        .exists()
        .withMessage("the amount is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the amount should not be empty")
        .bail()
        .isInt()
        .withMessage("the amount should be a number")
        .trim(),
      body("host_id")
        .exists()
        .withMessage("the host_id is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the host_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("the host_id should be an Object ID")
        .trim(),
    ],
  ]),
  createTransactionController.receiveMoneyFromHost
);

router.post(
  "/devices/:device_id/data",
  addCommonFieldsToBody,
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("amount")
        .exists()
        .withMessage("the amount is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the amount should not be empty")
        .isInt()
        .withMessage("the amount should be a number")
        .trim(),
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
        .withMessage("phone_number must be a valid one")
        .trim(),
      query("product_item")
        .exists()
        .withMessage("product_item should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["ugung", "keko"])
        .withMessage("the product_item value is not among the expected ones"),
    ],
  ]),
  createTransactionController.loadDataBundle
);

router.get(
  "/payments/hosts/:host_id",
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
        .withMessage("the host_id should exist")
        .bail()
        .notEmpty()
        .withMessage("the host_id cannot be empty")
        .trim(),
    ],
  ]),
  createTransactionController.listTransactions
);
router.get(
  "/payments/:transaction_id",
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
      param("transaction_id")
        .exists()
        .withMessage("the transaction_id should exist")
        .bail()
        .notEmpty()
        .withMessage("the transaction_id cannot be empty")
        .trim(),
    ],
  ]),
  createTransactionController.getTransactionDetails
);

router.get(
  "/devices/:device_id/balance",
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
      param("device_id")
        .exists()
        .withMessage("the device_id should exist")
        .bail()
        .notEmpty()
        .withMessage("the device_id cannot be empty")
        .bail()
        .isMongoId()
        .withMessage("the device_id should be an Object ID")
        .trim(),
    ],
  ]),
  createTransactionController.checkRemainingDataBundleBalance
);

module.exports = router;
