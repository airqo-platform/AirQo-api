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
const products = ["mobile", "website", "analytics"];

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
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

const setProductQueryParam = (product) => (req, res, next) => {
  req.query.product = product;
  next();
};

const tenantValidation = [
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones"),
];

const isActiveValidation = [
  body("isActive")
    .exists()
    .withMessage("isActive field is missing")
    .bail()
    .notEmpty()
    .withMessage("isActive should not be empty if provided")
    .bail()
    .isBoolean()
    .withMessage("isActive should be a Boolean value"),
];

const idValidations = [
  query("id")
    .optional()
    .notEmpty()
    .withMessage("the provided id should not be empty if provided")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("id must be an object ID")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
  // Add other ID validations here...
];

products.forEach((product) => {
  router.post(
    `/${product}`,
    setProductQueryParam(product),
    oneOf([tenantValidation]),
    oneOf([isActiveValidation]),
    setJWTAuth,
    authJWT,
    createMaintenanceController.create
  );

  router.put(
    `/${product}`,
    setProductQueryParam(product),
    oneOf([tenantValidation]),
    oneOf([isActiveValidation]),
    setJWTAuth,
    authJWT,
    createMaintenanceController.update
  );

  router.get(
    `/${product}`,
    setProductQueryParam(product),
    oneOf([tenantValidation]),
    oneOf([idValidations]),
    setJWTAuth,
    authJWT,
    createMaintenanceController.list
  );

  router.delete(
    `/${product}`,
    setProductQueryParam(product),
    oneOf([tenantValidation]),
    oneOf([idValidations]),
    setJWTAuth,
    authJWT,
    createMaintenanceController.delete
  );
});

module.exports = router;
