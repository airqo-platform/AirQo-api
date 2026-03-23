const { query, body, param, oneOf } = require("express-validator");
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

const validateTimeframe = query("timeframe")
  .optional()
  .isIn(["last7days", "last30days", "last90days", "custom"])
  .withMessage("Invalid timeframe");

const validateDateRange = [
  query("startDate")
    .if(query("timeframe").equals("custom"))
    .isISO8601()
    .withMessage("Start date required for custom timeframe"),
  query("endDate")
    .if(query("timeframe").equals("custom"))
    .isISO8601()
    .withMessage("End date required for custom timeframe"),
];

const validateUserEmail = param("email")
  .isEmail()
  .withMessage("Valid email is required");

const validatePeriod = query("period")
  .isIn(["daily", "weekly", "monthly", "quarterly", "yearly"])
  .withMessage("Invalid period");

const validateCohortPeriod = query("period")
  .isIn(["daily", "weekly", "monthly"])
  .withMessage("Invalid cohort period");

const validateMetricType = query("metric")
  .isIn(["engagement", "retention", "activity", "growth"])
  .withMessage("Invalid metric type");

const validateYearMonth = [
  query("year").isInt().withMessage("Invalid year"),
  query("month").isInt({ min: 0, max: 11 }).withMessage("Invalid month (0-11)"),
];

const validateGroupBy = query("groupBy")
  .isIn(["service", "endpoint", "user"])
  .withMessage("Invalid grouping parameter");

const validateEmailsArray = body("emails")
  .exists()
  .withMessage("the emails array field must be provided in the request body")
  .bail()
  .isArray()
  .withMessage("emails must be provided as an array")
  .bail()
  .notEmpty()
  .withMessage("the provided emails array cannot be empty");

// Grouped validation rules for different endpoints
const userEngagementValidators = {
  getEngagement: [validateUserEmail, validateTimeframe, ...validateDateRange],
  getMetrics: [validateUserEmail, ...validateYearMonth],
};

const activityValidators = {
  getReport: [validateUserEmail, validateTimeframe, ...validateDateRange],
};

const cohortValidators = {
  getAnalysis: [
    validateCohortPeriod,
    query("metrics")
      .optional()
      .isArray()
      .withMessage("Metrics must be an array"),
    query("minCohortSize")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Invalid minimum cohort size"),
  ],
};

const predictiveValidators = {
  getPredictions: [
    validateUserEmail,
    query("includeChurnRisk")
      .optional()
      .isBoolean()
      .withMessage("Invalid churn risk inclusion parameter"),
  ],
};

const serviceAdoptionValidators = {
  getAdoption: [
    validateUserEmail,
    query("includeRecommendations")
      .optional()
      .isBoolean()
      .withMessage("Invalid recommendations parameter"),
  ],
};

const benchmarkValidators = {
  getBenchmarks: [validateMetricType, validatePeriod],
};

const topUsersValidators = {
  getTopUsers: [
    ...validateYearMonth,
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Invalid limit"),
    validateMetricType.optional(),
  ],
};

const aggregateValidators = {
  getAggregated: [
    query("startDate").isISO8601().withMessage("Invalid start date"),
    query("endDate").isISO8601().withMessage("Invalid end date"),
    validateGroupBy,
  ],
};

const retentionValidators = {
  getRetention: [
    validateCohortPeriod.optional(),
    query("period")
      .isInt({ min: 1, max: 12 })
      .withMessage("Invalid period range"),
  ],
};

const healthScoreValidators = {
  getHealthScore: [
    validateUserEmail,
    query("includeFactors")
      .optional()
      .isBoolean()
      .withMessage("Invalid factors inclusion parameter"),
  ],
};

const behaviorValidators = {
  getBehavior: [
    validateUserEmail,
    query("includeSegmentation")
      .optional()
      .isBoolean()
      .withMessage("Invalid segmentation parameter"),
  ],
};

const emailValidators = {
  sendEmails: [validateEmailsArray],
  retrieveStats: [validateEmailsArray],
};

module.exports = {
  tenant: validateTenant,
  userEngagementValidators,
  activityValidators,
  cohortValidators,
  predictiveValidators,
  serviceAdoptionValidators,
  benchmarkValidators,
  topUsersValidators,
  aggregateValidators,
  retentionValidators,
  healthScoreValidators,
  behaviorValidators,
  emailValidators,
};
