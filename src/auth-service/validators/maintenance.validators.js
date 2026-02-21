// maintenance.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");
const isEmpty = require("is-empty");

const setDefaultTenant = (req, res, next) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  req.query.tenant = isEmpty(req.query.tenant)
    ? defaultTenant
    : req.query.tenant;
  next();
};

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
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
    .isIn(constants.TENANTS)
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

const create = [
  tenantValidation,
  startDateValidation,
  endDateValidation,
  isActiveValidation,
  messageValidation,
];

const update = [
  tenantValidation,
  startDateValidation,
  endDateValidation,
  isActiveValidation,
  messageValidation,
];

const list = [
  tenantValidation,
  query("id").optional().isMongoId().withMessage("id must be a valid ObjectId"),
];

const deleteMaintenance = [
  tenantValidation,
  query("id").optional().isMongoId().withMessage("id must be a valid ObjectId"),
];

module.exports = {
  setDefaultTenant,
  pagination,
  create,
  update,
  list,
  deleteMaintenance,
};
