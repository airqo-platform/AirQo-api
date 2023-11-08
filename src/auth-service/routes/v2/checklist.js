const express = require("express");
const router = express.Router();
const createChecklistController = require("@controllers/create-checklist");
const { check, oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
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
  res.header("Access-Control-Allow-Origin", "*");
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
  "/upsert",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("user_id")
        .exists()
        .withMessage("the user_id should be provided in the request body")
        .bail()
        .notEmpty()
        .withMessage("the provided user_id should not be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("items")
        .exists()
        .withMessage("the items array must be provided")
        .bail()
        .isArray({ min: 1 })
        .withMessage("At least one checklist item is required")
        .bail()
        .custom((items) => {
          if (!Array.isArray(items)) {
            throw new Error("Items must be an array");
          }

          return true;
        }),
      body("items.videoProgress")
        .optional()
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("items.videoProgress must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("items.completed")
        .optional()
        .notEmpty()
        .withMessage("items.completed cannot be empty IF provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("items.completed must be Boolean"),
      body("items.completionDate")
        .optional()
        .notEmpty()
        .withMessage(
          "the provided items.completionDate should not be empty IF provided"
        )
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("items.completionDate must be a valid datetime."),
      body("items.title")
        .optional()
        .notEmpty()
        .withMessage("the provided items.title should not be empty IF provided")
        .bail()
        .trim(),
    ],
  ]),
  createChecklistController.upsert
);

router.put(
  "/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("user_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the user_id"
      )
      .bail()
      .notEmpty()
      .withMessage("the provided user_id should not be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("items")
        .exists()
        .withMessage("the items array must be provided")
        .bail()
        .isArray({ min: 1 })
        .withMessage("At least one checklist item is required")
        .bail()
        .custom((items) => {
          if (!Array.isArray(items)) {
            throw new Error("Items must be an array");
          }
          return true;
        }),
      body("items.videoProgress")
        .optional()
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("items.videoProgress must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("items.completed")
        .optional()
        .notEmpty()
        .withMessage("items.completed cannot be empty IF provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("items.completed must be Boolean"),
      body("items.completionDate")
        .optional()
        .notEmpty()
        .withMessage(
          "the provided items.completionDate should not be empty IF provided"
        )
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("items.completionDate must be a valid datetime."),
      body("items.title")
        .optional()
        .notEmpty()
        .withMessage("the provided items.title should not be empty IF provided")
        .bail()
        .trim(),
    ],
  ]),
  createChecklistController.update
);

router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("user_id")
        .exists()
        .withMessage("the user_id should be provided in the request body")
        .bail()
        .notEmpty()
        .withMessage("the provided user_id should not be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("items")
        .exists()
        .withMessage("the items array must be provided")
        .bail()
        .isArray({ min: 1 })
        .withMessage("At least one checklist item is required")
        .bail()
        .custom((items) => {
          if (!Array.isArray(items)) {
            throw new Error("Items must be an array");
          }
          return true;
        }),
      body("items.videoProgress")
        .optional()
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("items.videoProgress must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("items.completed")
        .optional()
        .notEmpty()
        .withMessage("items.completed cannot be empty IF provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("items.completed must be Boolean"),
      body("items.completionDate")
        .optional()
        .notEmpty()
        .withMessage(
          "the provided items.completionDate should not be empty IF provided"
        )
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("items.completionDate must be a valid datetime."),
      body("items.title")
        .optional()
        .notEmpty()
        .withMessage("the provided items.title should not be empty IF provided")
        .bail()
        .trim(),
    ],
  ]),
  createChecklistController.create
);

router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("user_id")
        .optional()
        .notEmpty()
        .withMessage("the provided user_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  createChecklistController.list
);

router.delete(
  "/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("user_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the user_id"
      )
      .bail()
      .notEmpty()
      .withMessage("the provided user_id should not be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createChecklistController.delete
);

router.get(
  "/:user_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("user_id")
        .exists()
        .withMessage("the user_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the provided user_id should not be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  createChecklistController.list
);

module.exports = router;
