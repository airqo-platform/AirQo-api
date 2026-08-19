const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

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

const validateIdParam = oneOf([
  param("id")
    .exists()
    .withMessage("the id param is missing in the request")
    .bail()
    .notEmpty()
    .withMessage("id cannot be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("id must be an object ID")
    .bail()
    .customSanitizer((value) => ObjectId(value)),
]);

const list = [validateTenant];

const create = [
  validateTenant,
  body("tenant")
    .optional()
    .trim()
    .toLowerCase()
    .isIn(constants.TENANTS || ["airqo", "kcca"])
    .withMessage("the tenant value is not among the expected ones"),
  body("adminCCEmails")
    .exists()
    .withMessage("adminCCEmails is required")
    .bail()
    .notEmpty()
    .withMessage("adminCCEmails cannot be empty")
    .bail()
    .isString()
    .withMessage("adminCCEmails must be a comma-separated string of email addresses")
    .bail()
    .custom((val) => {
      const emails = val.split(",").map((e) => e.trim()).filter(Boolean);
      if (emails.length === 0) throw new Error("adminCCEmails must contain at least one email");
      if (!emails.every(isValidEmail))
        throw new Error("One or more admin CC email addresses are invalid");
      return true;
    }),
  body("applicationEmails")
    .optional()
    .isArray()
    .withMessage("applicationEmails must be an array")
    .bail()
    .custom((emails) => {
      if (!emails.every(isValidEmail))
        throw new Error("One or more application email addresses are invalid");
      return true;
    }),
];

const update = [
  validateTenant,
  validateIdParam,
  body("adminCCEmails")
    .optional()
    .isString()
    .withMessage("adminCCEmails must be a comma-separated string")
    .bail()
    .custom((val) => {
      if (!val) return true;
      const emails = val.split(",").map((e) => e.trim()).filter(Boolean);
      if (!emails.every(isValidEmail))
        throw new Error("One or more admin CC email addresses are invalid");
      return true;
    }),
  body("applicationEmails")
    .optional()
    .isArray()
    .withMessage("applicationEmails must be an array")
    .bail()
    .custom((emails) => {
      if (!emails.every(isValidEmail))
        throw new Error("One or more application email addresses are invalid");
      return true;
    }),
  body("addApplicationEmails")
    .optional()
    .isArray()
    .withMessage("addApplicationEmails must be an array")
    .bail()
    .custom((emails) => {
      if (!emails.every(isValidEmail))
        throw new Error("One or more emails in addApplicationEmails are invalid");
      return true;
    }),
  body("removeApplicationEmails")
    .optional()
    .isArray()
    .withMessage("removeApplicationEmails must be an array")
    .bail()
    .custom((emails) => {
      if (!emails.every(isValidEmail))
        throw new Error("One or more emails in removeApplicationEmails are invalid");
      return true;
    }),
];

const deleteConfig = [validateTenant, validateIdParam];

module.exports = {
  list,
  create,
  update,
  delete: deleteConfig,
};
