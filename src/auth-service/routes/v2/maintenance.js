const express = require("express");
const router = express.Router();
const createMaintenanceController = require("@controllers/create-maintenance");
const { oneOf, query, body } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const isEmpty = require("is-empty");
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

const startDateValidation = [
  body("startDate")
    .optional()
    .notEmpty()
    .withMessage("startDate should not be empty if provided")
    .bail()
    .trim()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage("startDate must be a valid datetime."),
];

const endDateValidation = [
  body("endDate")
    .optional()
    .notEmpty()
    .withMessage("endDate should not be empty if provided")
    .bail()
    .trim()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage("endDate must be a valid datetime."),
];

const isActiveValidation = [
  body("isActive")
    .optional()
    .notEmpty()
    .withMessage("isActive should not be empty if provided")
    .bail()
    .isBoolean()
    .withMessage("isActive must be Boolean"),
];

const messageValidation = [
  body("message")
    .optional()
    .notEmpty()
    .withMessage("message should not be empty if provided")
    .trim(),
];

products.forEach((product) => {
  router.post(
    `/${product}`,
    setProductQueryParam(product),
    oneOf([tenantValidation]),
    oneOf([startDateValidation]),
    oneOf([endDateValidation]),
    oneOf([isActiveValidation]),
    oneOf([messageValidation]),
    setJWTAuth,
    authJWT,
    createMaintenanceController.create
  );

  router.put(
    `/${product}`,
    setProductQueryParam(product),
    oneOf([tenantValidation]),
    oneOf([startDateValidation]),
    oneOf([endDateValidation]),
    oneOf([isActiveValidation]),
    oneOf([messageValidation]),
    setJWTAuth,
    authJWT,
    createMaintenanceController.update
  );

  router.get(
    `/${product}`,
    setProductQueryParam(product),
    oneOf([tenantValidation]),
    // Assuming you want to validate id as well
    query("id")
      .optional()
      .isMongoId()
      .withMessage("id must be a valid ObjectId"),

    setJWTAuth,
    authJWT,
    createMaintenanceController.list
  );

  router.delete(
    `/${product}`,
    setProductQueryParam(product),
    oneOf([tenantValidation]),
    query("id")
      .optional()
      .isMongoId()
      .withMessage("id must be a valid ObjectId"),
    setJWTAuth,
    authJWT,
    createMaintenanceController.delete
  );
});

module.exports = router;
