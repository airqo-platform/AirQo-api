// aqi.validators.js
const { query } = require("express-validator");
const constants = require("@config/constants");
const { validate } = require("@validators/common");

const listRanges = [
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("the tenant cannot be empty, if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
  validate,
];

module.exports = {
  listRanges,
};
