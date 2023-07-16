const express = require("express");
const router = express.Router();
const createTransactionController = require("@controllers/create-transaction");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;
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

router.post(
  "/hosts/:host_id/payments",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      //   body("amount")
      //     .exists()
      //     .withMessage("the amount is missing in your request")
      //     .bail()
      //     .notEmpty()
      //     .withMessage("the amount should not be empty")
      //     .isInt()
      //     .withMessage("the amount should be a number")
      //     .trim(),
    ],
  ]),
  createTransactionController.sendMoneyToHost
);

router.post(
  "/accounts/payments",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      //   body("amount")
      //     .exists()
      //     .withMessage("the amount is missing in your request")
      //     .bail()
      //     .notEmpty()
      //     .withMessage("the amount should not be empty")
      //     .isInt()
      //     .withMessage("the amount should be a number")
      //     .trim(),
    ],
  ]),
  createTransactionController.addMoneyToOrganisationAccount
);

router.post(
  "/accounts/receive",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      //   body("amount")
      //     .exists()
      //     .withMessage("the amount is missing in your request")
      //     .bail()
      //     .notEmpty()
      //     .withMessage("the amount should not be empty")
      //     .isInt()
      //     .withMessage("the amount should be a number")
      //     .trim(),
    ],
  ]),
  createTransactionController.receiveMoneyFromHost
);

router.post(
  "/devices/:device_id/data",
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
      //   body("amount")
      //     .exists()
      //     .withMessage("the amount is missing in your request")
      //     .bail()
      //     .notEmpty()
      //     .withMessage("the amount should not be empty")
      //     .isInt()
      //     .withMessage("the amount should be a number")
      //     .trim(),
    ],
  ]),
  createTransactionController.loadDataBundle
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
        .withMessage("the transaction_id should exist")
        .bail()
        .notEmpty()
        .withMessage("the transaction_id cannot be empty")
        .trim(),
    ],
  ]),
  createTransactionController.checkRemainingDataBundleBalance
);

module.exports = router;
