const express = require("express");
const router = express.Router();
const middlewareConfig = require("../config/router.middleware");
const createHostController = require("../controllers/create-host");
const createTransactionController = require("../controllers/create-transaction");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("../config/constants");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
const incentivesController = require("../controllers/incentivize");

middlewareConfig(router);

/*************** create-transaction usecase *****************/

router.post("/data", incentivesController.data);
router.post("/disburse", incentivesController.disburse);
router.post("/callback", incentivesController.callback);
router.get("/balance", incentivesController.getBalance);
router.post(
  "/transactions/soft",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
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
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .withMessage("the description should not be empty if provided")
        .trim(),
      body("host_id")
        .exists()
        .withMessage("the host_id is missing in your request")
        .isMongoId()
        .withMessage("the host_id should be an object ID")
        .trim(),
      body("transaction_id")
        .exists()
        .withMessage("the transaction_id is missing in your request")
        .trim(),
      body("status")
        .exists()
        .withMessage("the status is missing in your request")
        .bail()
        .isIn(["pending", "started", "finished"])
        .withMessage(
          "the status value is not among the expected ones which include: pending, started and finished"
        )
        .trim(),
    ],
  ]),
  createTransactionController.softRegister
);

router.post(
  "/transactions",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
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
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .withMessage("the description should not be empty if provided")
        .trim(),
      body("host_id")
        .exists()
        .withMessage("the host_id is missing in your request")
        .isMongoId()
        .withMessage("the host_id should be an object ID")
        .trim(),
      body("transaction_id")
        .exists()
        .withMessage("the transaction_id is missing in your request")
        .trim(),
      body("status")
        .exists()
        .withMessage("the status is missing in your request")
        .bail()
        .isIn(["pending", "started", "finished"])
        .withMessage(
          "the status value is not among the expected ones which include: pending, started and finished"
        )
        .trim(),
    ],
  ]),
  createTransactionController.register
);

router.get(
  "/transactions",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .if(query("id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("host_id")
        .if(query("site_id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("transaction_id")
        .if(query("transaction_id").exists())
        .notEmpty()
        .withMessage("the transaction_id is empty")
        .trim(),
      query("status")
        .if(query("status").exists())
        .notEmpty()
        .withMessage("the provided status must not be empty")
        .bail()
        .trim(),
    ],
  ]),
  createTransactionController.list
);

router.put(
  "/transactions",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the transaction identifier is missing in the request, consider using id"
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
      body("amount")
        .if(body("amount").exists())
        .notEmpty()
        .withMessage("the amount should not be empty")
        .bail()
        .isInt()
        .withMessage("the amount is not a number")
        .trim(),
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .withMessage("the description should not be empty when provided")
        .trim(),
      body("host_id")
        .if(body("host_id").exists())
        .notEmpty()
        .withMessage("the host_id should not be empty")
        .isMongoId()
        .withMessage("should be a valid object ID"),
      body("transaction_id")
        .if(body("transaction_id").exists())
        .notEmpty()
        .withMessage("the transaction_id should not be empty"),
      body("status")
        .if(body("status").exists())
        .notEmpty()
        .withMessage("the status should not be empty")
        .bail()
        .toLowerCase()
        .isIn(["pending", "started", "finished"])
        .withMessage(
          "the status value is not among the expected ones which include: pending, started and finished"
        ),
    ],
  ]),
  createTransactionController.update
);

router.delete(
  "/transactions",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using id"
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
  createTransactionController.delete
);

router.post(
  "/transactions/momo",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      body("hosts")
        .exists()
        .withMessage("the hosts are missing in request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the hosts must be an array"),
      body("hosts.*")
        .isMongoId()
        .withMessage("the provided host is not an object ID"),
      body("amount")
        .exists()
        .withMessage("the amount is missing in request")
        .bail()
        .trim()
        .isInt()
        .withMessage("amount must be a number"),
      body("description")
        .exists()
        .withMessage("the description is missing in request")
        .trim(),
    ],
  ]),
  createTransactionController.registerMomoMTN
);

module.exports = router;
