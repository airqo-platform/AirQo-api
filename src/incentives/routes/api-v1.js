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

middlewareConfig(router);

/***************** create-host usecase ***********************/
router.post(
  "/hosts",
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
      body("phone_number")
        .exists()
        .withMessage("the phone_number is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the phone_number should not be empty")
        .isInt()
        .withMessage("the phone_number should be a number")
        .trim(),
      body("email")
        .exists()
        .withMessage("the email is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the email should not be empty")
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("site_id")
        .exists()
        .withMessage("the site_id is missing in your request")
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
      body("device_id")
        .exists()
        .withMessage("the device_id is missing in your request")
        .notEmpty()
        .withMessage("the device_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        })
        .trim(),
    ],
  ]),
  createHostController.register
);

router.get(
  "/hosts",
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
      query("site_id")
        .if(query("site_id").exists())
        .notEmpty()
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
  "/hosts",
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
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      })
      .trim(),
  ]),
  oneOf([
    [
      body("name")
        .if(body("name").exists())
        .notEmpty()
        .withMessage("the name should not be empty")
        .bail()
        .customSanitizer((value) => {
          return createSiteUtil.sanitiseName(value);
        })
        .trim(),
      body("description").if(body("description").exists()).notEmpty().trim(),
      body("location")
        .if(body("location").exists())
        .notEmpty()
        .withMessage("the location should not be empty"),
      body("location.coordinates")
        .if(body("location.coordinates").exists())
        .notEmpty()
        .withMessage("the location.coordinates should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .if(body("location.type").exists())
        .notEmpty()
        .withMessage("the location.type should not be empty")
        .bail()
        .toLowerCase()
        .isIn(["polygon", "point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: polygon and point"
        ),
      body("airqloud_tags")
        .if(body("airqloud_tags").exists())
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
    ],
  ]),
  createHostController.update
);

router.delete(
  "/hosts",
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
  createHostController.delete
);

/*************** create-transaction usecase *****************/
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

module.exports = router;
