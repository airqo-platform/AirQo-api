// group-chart-config.validators.js
const { body, param, query } = require("express-validator");
const isEmpty = require("is-empty");
const preferenceValidations = require("./preferences.validators");

// Reused from preferences.validators.js rather than duplicated — same chart
// field rules apply whether the chart belongs to a user or a group.
const {
  chartConfigValidation,
  createNestedValidations,
  commonValidations,
  validateArrayOfObjectIds,
} = preferenceValidations.sharedHelpers;

const groupIdParam = param("grp_id")
  .exists()
  .withMessage("Group ID is required")
  .bail()
  .isMongoId()
  .withMessage("Invalid Group ID");

const chartIdParam = param("chartId")
  .exists()
  .withMessage("Chart ID is required")
  .bail()
  .isMongoId()
  .withMessage("Invalid Chart ID");

// A saved default can apply to more than one device and/or site at once
// (mirrors the old, deprecated Defaults model's sites[]/devices[] arrays),
// so both are optional arrays rather than a single required :deviceId path
// param — but at least one has to be present, since a default has to apply
// to something.
const scopeArrayValidations = [
  ...validateArrayOfObjectIds("device_ids"),
  ...validateArrayOfObjectIds("site_ids"),
];

const atLeastOneScopeRequired = body().custom((_, { req }) => {
  const { device_ids, site_ids } = req.body;
  if (isEmpty(device_ids) && isEmpty(site_ids)) {
    throw new Error(
      "At least one of device_ids or site_ids is required, and must not be empty"
    );
  }
  return true;
});

const deviceIdQuery = query("device_id")
  .optional()
  .isMongoId()
  .withMessage("device_id must be a valid Device ID");

const siteIdQuery = query("site_id")
  .optional()
  .isMongoId()
  .withMessage("site_id must be a valid Site ID");

const groupChartConfigValidations = {
  create: [
    ...commonValidations.tenant,
    groupIdParam,
    ...scopeArrayValidations,
    atLeastOneScopeRequired,
    body("chartConfig")
      .exists()
      .withMessage("chartConfig object is required")
      .bail()
      .isObject()
      .withMessage("chartConfig must be an object"),
    body("chartConfig.fieldId")
      .exists()
      .withMessage("fieldId is required in chartConfig")
      .bail()
      .isInt({ min: 1, max: 8 })
      .withMessage("fieldId must be an integer between 1 and 8"),
    ...createNestedValidations("chartConfig"),
  ],
  update: [
    ...commonValidations.tenant,
    groupIdParam,
    chartIdParam,
    ...scopeArrayValidations,
    ...chartConfigValidation,
  ],
  delete: [...commonValidations.tenant, groupIdParam, chartIdParam],
  list: [
    ...commonValidations.tenant,
    groupIdParam,
    deviceIdQuery,
    siteIdQuery,
  ],
  getById: [...commonValidations.tenant, groupIdParam, chartIdParam],
};

module.exports = groupChartConfigValidations;
