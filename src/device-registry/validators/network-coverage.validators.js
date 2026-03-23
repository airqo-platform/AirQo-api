// network-coverage.validators.js
const { query, body, param } = require("express-validator");
const constants = require("@config/constants");
const { isValidObjectId } = require("mongoose");

const MONITOR_TYPES = ["Reference", "LCS", "Inactive"];
const MONITOR_STATUSES = ["active", "inactive"];

const commonTenant = query("tenant")
  .optional()
  .notEmpty()
  .withMessage("tenant cannot be empty if provided")
  .bail()
  .trim()
  .toLowerCase()
  .isIn(constants.TENANTS)
  .withMessage("tenant value is not among the expected ones");

const validObjectId = (field) =>
  param(field)
    .notEmpty()
    .withMessage(`${field} is required`)
    .bail()
    .custom((value) => {
      if (!isValidObjectId(value)) throw new Error(`${field} must be a valid ObjectId`);
      return true;
    });

const typesFilter = query("types")
  .optional()
  .isString()
  .withMessage("types must be a comma-separated string")
  .trim()
  .custom((value) => {
    const parts = value.split(",").map((t) => t.trim());
    const invalid = parts.filter((t) => !MONITOR_TYPES.includes(t));
    if (invalid.length > 0) {
      throw new Error(
        `Invalid type(s): ${invalid.join(", ")}. Allowed: ${MONITOR_TYPES.join(", ")}`
      );
    }
    return true;
  });

const activeOnlyFilter = query("activeOnly")
  .optional()
  .isIn(["true", "false"])
  .withMessage("activeOnly must be 'true' or 'false'");

const networkCoverageValidations = {
  /**
   * GET /network-coverage
   */
  list: [
    commonTenant,
    query("search").optional().isString().trim(),
    activeOnlyFilter,
    typesFilter,
  ],

  /**
   * GET /network-coverage/monitors/:monitorId
   */
  getMonitor: [commonTenant, validObjectId("monitorId")],

  /**
   * GET /network-coverage/countries/:countryId/monitors
   */
  getCountryMonitors: [
    commonTenant,
    param("countryId")
      .notEmpty()
      .withMessage("countryId is required")
      .bail()
      .isString()
      .trim(),
    activeOnlyFilter,
    typesFilter,
  ],

  /**
   * GET /network-coverage/export.csv  |  export.pdf
   */
  exportCsv: [
    commonTenant,
    query("countryId").optional().isString().trim(),
    activeOnlyFilter,
    typesFilter,
    query("search").optional().isString().trim(),
  ],

  /**
   * POST /network-coverage/registry
   *
   * Two shapes are accepted:
   *   A) AirQo-site enrichment — site_id is provided; name/country/lat/lng
   *      are optional because they come from the Site document.
   *   B) Standalone external entry — site_id is absent; name, country,
   *      latitude and longitude are required.
   *
   * The .custom() on site_id enforces shape B requirements when site_id
   * is missing.
   */
  upsertRegistry: [
    commonTenant,
    body("site_id")
      .optional({ nullable: true })
      .custom((value) => {
        if (value !== null && value !== undefined && !isValidObjectId(value)) {
          throw new Error("site_id must be a valid ObjectId");
        }
        return true;
      }),

    // For standalone entries (no site_id) these three become required
    body("name").custom((value, { req }) => {
      if (!req.body.site_id && (!value || !String(value).trim())) {
        throw new Error("name is required for standalone monitor entries");
      }
      return true;
    }),
    body("country").custom((value, { req }) => {
      if (!req.body.site_id && (!value || !String(value).trim())) {
        throw new Error("country is required for standalone monitor entries");
      }
      return true;
    }),
    body("latitude").custom((value, { req }) => {
      if (!req.body.site_id) {
        const num = parseFloat(value);
        if (value === undefined || value === null || isNaN(num) || num < -90 || num > 90) {
          throw new Error(
            "latitude is required for standalone entries and must be between -90 and 90"
          );
        }
      }
      return true;
    }),
    body("longitude").custom((value, { req }) => {
      if (!req.body.site_id) {
        const num = parseFloat(value);
        if (value === undefined || value === null || isNaN(num) || num < -180 || num > 180) {
          throw new Error(
            "longitude is required for standalone entries and must be between -180 and 180"
          );
        }
      }
      return true;
    }),

    // Optional fields (apply to both shapes)
    body("city").optional().isString().trim(),
    body("type")
      .optional()
      .isIn(MONITOR_TYPES)
      .withMessage(`type must be one of: ${MONITOR_TYPES.join(", ")}`),
    body("status")
      .optional()
      .isIn(MONITOR_STATUSES)
      .withMessage(`status must be one of: ${MONITOR_STATUSES.join(", ")}`),
    body("iso2")
      .optional()
      .isString()
      .isLength({ min: 2, max: 2 })
      .withMessage("iso2 must be a 2-character ISO country code"),
    body("network").optional().isString().trim(),
    body("operator").optional().isString().trim(),
    body("equipment").optional().isString().trim(),
    body("manufacturer").optional().isString().trim(),
    body("pollutants")
      .optional()
      .isArray()
      .withMessage("pollutants must be an array"),
    body("pollutants.*").optional().isString(),
    body("resolution").optional().isString().trim(),
    body("transmission").optional().isString().trim(),
    body("site").optional().isString().trim(),
    body("landUse").optional().isString().trim(),
    body("deployed").optional().isString().trim(),
    body("calibrationLastDate").optional().isString().trim(),
    body("calibrationMethod").optional().isString().trim(),
    body("uptime30d").optional().isString().trim(),
    body("publicData")
      .optional()
      .isIn(["Yes", "No"])
      .withMessage("publicData must be 'Yes' or 'No'"),
    body("organisation").optional().isString().trim(),
    body("coLocation").optional().isString().trim(),
    body("coLocationNote").optional().isString().trim(),
    body("viewDataUrl")
      .optional()
      .isURL()
      .withMessage("viewDataUrl must be a valid URL"),
    body("lastActive")
      .optional()
      .isISO8601()
      .withMessage("lastActive must be a valid ISO 8601 date"),
  ],

  /**
   * DELETE /network-coverage/registry/:registryId
   */
  deleteRegistry: [commonTenant, validObjectId("registryId")],
};

module.exports = networkCoverageValidations;
