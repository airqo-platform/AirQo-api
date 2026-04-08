"use strict";
const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");
const DeviceBulkUpdateJobModel = require("@models/DeviceBulkUpdateJob");

const { ALLOWED_UPDATE_FIELDS, ALLOWED_FILTER_FIELDS, ALLOWED_CATEGORIES } =
  DeviceBulkUpdateJobModel().schema.statics;

// ── Shared ────────────────────────────────────────────────────────────────────

const validTenant = query("tenant")
  .optional()
  .notEmpty()
  .withMessage("tenant must not be empty if provided")
  .trim()
  .toLowerCase();

const validJobId = param("jobId")
  .exists()
  .withMessage("jobId param is required")
  .bail()
  .custom((v) => mongoose.Types.ObjectId.isValid(v))
  .withMessage("jobId must be a valid MongoDB ObjectId");

// ── filter validation ─────────────────────────────────────────────────────────

const validateFilter = body("filter")
  .exists()
  .withMessage("filter is required")
  .bail()
  .isObject()
  .withMessage("filter must be a plain object")
  .bail()
  .custom((filter) => {
    // Block any key that starts with $ to prevent operator injection.
    const hasDollarKey = (obj) =>
      Object.keys(obj).some(
        (k) =>
          k.startsWith("$") ||
          (typeof obj[k] === "object" && obj[k] !== null && hasDollarKey(obj[k]))
      );

    if (hasDollarKey(filter)) {
      throw new Error(
        "filter must not contain MongoDB operators ($-prefixed keys)"
      );
    }

    // Ensure every top-level key is in the allowlist.
    const invalidKeys = Object.keys(filter).filter(
      (k) => !ALLOWED_FILTER_FIELDS.includes(k)
    );
    if (invalidKeys.length > 0) {
      throw new Error(
        `filter contains unsupported field(s): ${invalidKeys.join(", ")}. ` +
          `Allowed: ${ALLOWED_FILTER_FIELDS.join(", ")}`
      );
    }

    if (Object.keys(filter).length === 0) {
      throw new Error(
        "filter must not be empty — a broad filter with no criteria would target all devices"
      );
    }

    return true;
  });

// ── updateData validation ─────────────────────────────────────────────────────

const validateUpdateData = body("updateData")
  .exists()
  .withMessage("updateData is required")
  .bail()
  .isObject()
  .withMessage("updateData must be a plain object")
  .bail()
  .custom((value) => {
    if (Object.keys(value).length === 0) {
      throw new Error("updateData must not be empty");
    }

    const invalidFields = Object.keys(value).filter(
      (k) => !ALLOWED_UPDATE_FIELDS.includes(k)
    );
    if (invalidFields.length > 0) {
      throw new Error(
        `updateData contains unsupported field(s): ${invalidFields.join(", ")}. ` +
          `Allowed: ${ALLOWED_UPDATE_FIELDS.join(", ")}`
      );
    }

    // Validate category value if present — sourced from DeviceBulkUpdateJob
    // statics which mirrors DEVICE_CONFIG.ALLOWED_CATEGORIES in Device.js.
    if (value.category !== undefined) {
      if (!ALLOWED_CATEGORIES.includes(value.category)) {
        throw new Error(
          `category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`
        );
      }
    }

    return true;
  });

// ── Exported validator chains ─────────────────────────────────────────────────

const createBulkUpdateJob = [
  validTenant,
  body("name")
    .exists()
    .withMessage("name is required")
    .bail()
    .isString()
    .withMessage("name must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("name must not be empty"),
  body("description").optional().isString().trim(),
  validateFilter,
  validateUpdateData,
  body("batchSize")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("batchSize must be an integer between 1 and 100"),
  body("dryRun")
    .optional()
    .isBoolean()
    .withMessage("dryRun must be a boolean"),
  body("createdBy").optional().isString().trim(),
];

const listBulkUpdateJobs = [
  validTenant,
  query("status")
    .optional()
    .isIn(["pending", "running", "completed", "failed", "paused", "cancelled"])
    .withMessage("invalid status value"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
  query("skip")
    .optional()
    .isInt({ min: 0 })
    .withMessage("skip must be a non-negative integer"),
];

const getBulkUpdateJob = [validTenant, validJobId];

const updateBulkUpdateJob = [
  validTenant,
  validJobId,
  body("status")
    .optional()
    .isIn(["pending", "paused", "cancelled"])
    .withMessage("status can only be set to: pending, paused, cancelled"),
  body("description").optional().isString().trim(),
  body("batchSize")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("batchSize must be between 1 and 100"),
  body("dryRun").optional().isBoolean(),
  // filter and updateData are intentionally not patchable after creation
  // to preserve the audit trail — create a new job instead.
];

const deleteBulkUpdateJob = [validTenant, validJobId];

const triggerBulkUpdateJob = [validTenant, validJobId];

module.exports = {
  createBulkUpdateJob,
  listBulkUpdateJobs,
  getBulkUpdateJob,
  updateBulkUpdateJob,
  deleteBulkUpdateJob,
  triggerBulkUpdateJob,
};
