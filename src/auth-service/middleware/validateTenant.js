const { query } = require("express-validator");
const ALLOWED_TENANTS = ["kcca", "airqo"];

const validateTenant = () => {
  return query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(ALLOWED_TENANTS)
    .withMessage("the tenant value is not among the expected ones");
};

module.exports = validateTenant;
