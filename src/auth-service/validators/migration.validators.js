const { query, oneOf } = require("express-validator");
const constants = require("@config/constants");

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
]);

const validateConfirmation = oneOf([
  query("confirm")
    .exists()
    .withMessage("confirmation parameter is required for migration")
    .bail()
    .notEmpty()
    .withMessage("confirmation parameter cannot be empty")
    .bail()
    .isString()
    .withMessage("confirmation parameter must be a string")
    .bail()
    .isLength({ min: 10 })
    .withMessage("confirmation parameter must be at least 10 characters long")
    .trim(),
]);

// Validation for GET /audit-deprecated-fields
const auditDeprecatedFields = [validateTenant];

// Validation for GET /migration-status
const getMigrationStatus = [validateTenant];

// Validation for GET /migration-plan
const getMigrationPlan = [validateTenant];

// Validation for POST /migrate-deprecated-fields
const migrateDeprecatedFields = [validateTenant, validateConfirmation];

module.exports = {
  tenant: validateTenant,
  auditDeprecatedFields,
  getMigrationStatus,
  getMigrationPlan,
  migrateDeprecatedFields,
};
