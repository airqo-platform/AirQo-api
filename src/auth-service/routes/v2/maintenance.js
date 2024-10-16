const express = require("express");
const router = express.Router();
const createMaintenanceController = require("@controllers/create-maintenance");
const { oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
// const { logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const { logText, logObject } = require("@utils/log");
const { isMongoId } = require("validator");
// const stringify = require("@utils/stringify");
const setDefaultTenant = require("@middleware/setDefaultTenant");

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const websiteQueryParam = (req, res, next) => {
  req.query.product = "official-website";
  next();
};

const mobileQueryParam = (req, res, next) => {
  req.query.product = "airqo-mobile";
  next();
};

const analyticsQueryParam = (req, res, next) => {
  req.query.product = "airqo-analytics";
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

router.use(headers);
router.use(validatePagination);
router.use(setDefaultTenant);

/**
 * airqo-mobile
 */
router.post(
  "/airqo-mobile",
  mobileQueryParam,
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
      body("isActive")
        .exists()
        .withMessage("isActive field is missing")
        .bail()
        .notEmpty()
        .withMessage("isActive should not be empty if provided")
        .bail()
        .isBoolean()
        .withMessage("isActive should be a Boolean value")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.create
);
router.put(
  "/airqo-mobile",
  mobileQueryParam,
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
      body("isActive")
        .exists()
        .withMessage("isActive field is missing")
        .bail()
        .notEmpty()
        .withMessage("isActive should not be empty if provided")
        .bail()
        .isBoolean()
        .withMessage("isActive should be a Boolean value")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.update
);
router.get(
  "/airqo-mobile",
  mobileQueryParam,
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
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the provided id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.list
);
router.delete(
  "/airqo-mobile",
  mobileQueryParam,
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
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the provided id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.delete
);

/**
 * official-website
 */
router.post(
  "/official-website",
  websiteQueryParam,
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
      body("isActive")
        .exists()
        .withMessage("isActive field is missing")
        .bail()
        .notEmpty()
        .withMessage("isActive should not be empty if provided")
        .bail()
        .isBoolean()
        .withMessage("isActive should be a Boolean value")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.create
);
router.put(
  "/official-website",
  websiteQueryParam,
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
      body("isActive")
        .exists()
        .withMessage("isActive field is missing")
        .bail()
        .notEmpty()
        .withMessage("isActive should not be empty if provided")
        .bail()
        .isBoolean()
        .withMessage("isActive should be a Boolean value")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.update
);
router.get(
  "/official-website",
  websiteQueryParam,
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
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the provided id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.list
);
router.delete(
  "/official-website",
  websiteQueryParam,
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
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the provided id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.delete
);

/**
 * airqo-analytics
 */
router.post(
  "/airqo-analytics",
  analyticsQueryParam,
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
      body("isActive")
        .exists()
        .withMessage("isActive field is missing")
        .bail()
        .notEmpty()
        .withMessage("isActive should not be empty if provided")
        .bail()
        .isBoolean()
        .withMessage("isActive should be a Boolean value")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.create
);
router.put(
  "/airqo-analytics",
  analyticsQueryParam,
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
      body("isActive")
        .exists()
        .withMessage("isActive field is missing")
        .bail()
        .notEmpty()
        .withMessage("isActive should not be empty if provided")
        .bail()
        .isBoolean()
        .withMessage("isActive should be a Boolean value")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.update
);
router.get(
  "/airqo-analytics",
  analyticsQueryParam,
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
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the provided id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.list
);
router.delete(
  "/airqo-analytics",
  analyticsQueryParam,
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
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the provided id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
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
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createMaintenanceController.delete
);

module.exports = router;
