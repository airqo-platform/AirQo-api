// group-chart-config.validators.js
const { body, param } = require("express-validator");
const preferenceValidations = require("./preferences.validators");

// Reused from preferences.validators.js rather than duplicated — same chart
// field rules apply whether the chart belongs to a user or a group.
const {
  chartConfigValidation,
  createNestedValidations,
  commonValidations,
} = preferenceValidations;

const groupIdParam = param("grp_id")
  .exists()
  .withMessage("Group ID is required")
  .bail()
  .isMongoId()
  .withMessage("Invalid Group ID");

const deviceIdParam = param("deviceId")
  .exists()
  .withMessage("Device ID is required")
  .bail()
  .isMongoId()
  .withMessage("Invalid Device ID");

const chartIdParam = param("chartId")
  .exists()
  .withMessage("Chart ID is required")
  .bail()
  .isMongoId()
  .withMessage("Invalid Chart ID");

const groupChartConfigValidations = {
  create: [
    ...commonValidations.tenant,
    groupIdParam,
    deviceIdParam,
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
    deviceIdParam,
    chartIdParam,
    ...chartConfigValidation,
  ],
  delete: [
    ...commonValidations.tenant,
    groupIdParam,
    deviceIdParam,
    chartIdParam,
  ],
  list: [...commonValidations.tenant, groupIdParam, deviceIdParam],
  getById: [
    ...commonValidations.tenant,
    groupIdParam,
    deviceIdParam,
    chartIdParam,
  ],
};

module.exports = groupChartConfigValidations;
