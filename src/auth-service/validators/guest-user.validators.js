const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");
const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  if (Number.isNaN(limit) || limit < 1) {
    req.query.limit = 100;
  } else if (limit > 500) {
    req.query.limit = 500;
  }
  if (Number.isNaN(skip) || skip < 0) {
    req.query.skip = 0;
  }
  next();
};

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
  query("tenant")
    .exists()
    .withMessage("the tenant value is missing in the request query")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
]);

const validateIdParam = oneOf([
  param("id")
    .exists()
    .withMessage("the id param is missing in the request")
    .bail()
    .notEmpty()
    .withMessage("this id cannot be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const list = [validateTenant];
const getOne = [validateTenant, validateIdParam];
const create = [
  validateTenant,
  oneOf([
    body("firstName").optional().trim(),
    body("lastName").optional().trim(),
  ]),
];
const update = [validateTenant, validateIdParam];
const deleteGuest = [validateTenant, validateIdParam];
const convertGuest = [
  validateTenant,
  [
    body("guest_id")
      .exists()
      .withMessage("the guest_id is missing in the request")
      .bail()
      .trim(),
    body("email")
      .exists()
      .withMessage("the email is missing in your request")
      .trim(),
    body("password")
      .exists()
      .withMessage("the password is missing in your request")
      .trim(),
    body("firstName").optional().trim(),
    body("lastName").optional().trim(),
    body("userName").optional().trim(),
  ],
];
module.exports = {
  pagination,
  create,
  getOne,
  convertGuest,
  list,
  update,
  delete: deleteGuest,
};
