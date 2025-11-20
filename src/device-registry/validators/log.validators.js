const { query, check } = require("express-validator");
const mongoose = require("mongoose");

const validateOptionalMongoId = (field) =>
  query(field)
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage(`Invalid ${field} format`);

const list = [
  query("tenant")
    .optional()
    .isString()
    .withMessage("Tenant must be a string")
    .trim(),

  validateOptionalMongoId("device_id"),
  validateOptionalMongoId("site_id"),
  validateOptionalMongoId("user_id"),

  query("device_name")
    .optional()
    .isString()
    .withMessage("Device name must be a string")
    .trim(),

  query("activity_type")
    .optional()
    .isString()
    .withMessage("Activity type must be a string")
    .trim(),

  query("activity_tags")
    .optional()
    .isString()
    .withMessage("Activity tags must be a string")
    .trim(),

  query("maintenance_type")
    .optional()
    .isString()
    .withMessage("Maintenance type must be a string")
    .trim(),

  query("recall_type")
    .optional()
    .isString()
    .withMessage("Recall type must be a string")
    .trim(),

  query("start_date")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  query("end_date")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .toDate(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Limit must be an integer between 1 and 1000")
    .toInt(),

  query("skip")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Skip must be a non-negative integer")
    .toInt(),

  query("sortBy")
    .optional()
    .isString()
    .withMessage("sortBy must be a string")
    .trim()
    .isIn(["timestamp", "operation_type", "entity_type", "status"])
    .withMessage("Invalid sortBy value"),

  query("order")
    .optional()
    .isString()
    .withMessage("order must be a string")
    .trim()
    .toLowerCase()
    .isIn(["asc", "desc"])
    .withMessage("order must be either 'asc' or 'desc'"),

  query("detailLevel")
    .optional()
    .isIn(["minimal", "full"])
    .withMessage("detailLevel must be either 'minimal' or 'full'"),
];

module.exports = {
  list,
};
