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
    .isIn(["kcca", "airqo", "airqount"])
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

const validateCustomQuery = [
  body("prestoQuery")
    .exists()
    .withMessage("prestoQuery is required")
    .bail()
    .notEmpty()
    .withMessage("prestoQuery cannot be empty")
    .bail()
    .trim()
    .custom((value) => {
      // Whitelist of allowed queries (example)
      const allowedQueries = [
        /^SELECT\s+COUNT\(\*\)\s+AS\s+totalUsers\s+FROM\s+mongodb\."airqo_.*"\.users$/i,
        /^SELECT\s+AVG\(age\)\s+AS\s+averageAge\s+FROM\s+mongodb\."airqo_.*"\.users$/i,
        /^SELECT\s+COUNT\(\*\)\s+AS\s+activeUsers\s+FROM\s+mongodb\."airqo_.*"\.users\s+WHERE\s+isActive\s*=\s*true$/i,
        /^SELECT\s+log\.meta\.endpoint,\s+COUNT\(\*\)\s+AS\s+usageCount\s+FROM\s+mongodb\."airqo_.*"\.logs\s+GROUP\s+BY\s+log\.meta\.endpoint\s+ORDER\s+BY\s+usageCount\s+DESC\s+LIMIT\s+\d+$/i,
        /^SELECT\s+COUNT\(\*\)\s+AS\s+recentUsers\s+FROM\s+mongodb\."airqo_.*"\.users\s+WHERE\s+lastLogin\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+lastLogin\s*<=\s*TIMESTAMP\s+'.*'$/i,
        /^SELECT\s+COUNT\(\*\)\s+AS\s+newUsers\s+FROM\s+mongodb\."airqo_.*"\.users\s+WHERE\s+createdAt\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+createdAt\s*<=\s*TIMESTAMP\s+'.*'$/i,
        /^SELECT\s+COUNT\(DISTINCT\s+user_id\)\s+AS\s+newAPIUsers\s+FROM\s+mongodb\."airqo_.*"\.clients\s+WHERE\s+createdAt\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+createdAt\s*<=\s*TIMESTAMP\s+'.*'$/i,
        /^SELECT\s+COUNT\(DISTINCT\s+user_id\)\s+AS\s+activeAPIUsers\s+FROM\s+mongodb\."airqo_.*"\.clients\s+WHERE\s+lastActive\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+lastActive\s*<=\s*TIMESTAMP\s+'.*'$/i,
        /^SELECT\s+log\.meta\.device\s+AS\s+device,\s+COUNT\(\*\)\s+AS\s+eventCount\s+FROM\s+mongodb\."airqo_.*"\.logs\s+WHERE\s+log\.timestamp\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+log\.timestamp\s*<=\s*TIMESTAMP\s+'.*'\s+GROUP\s+BY\s+log\.meta\.device\s+ORDER\s+BY\s+eventCount\s+DESC\s+LIMIT\s+\d+$/i,
        /^SELECT\s+users\.country\s+AS\s+country,\s+COUNT\(\*\)\s+AS\s+userCount\s+FROM\s+mongodb\."airqo_.*"\.users\s+WHERE\s+users\.createdAt\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+users\.createdAt\s*<=\s*TIMESTAMP\s+'.*'\s+GROUP\s+BY\s+users\.country\s+ORDER\s+BY\s+userCount\s+DESC$/i,
        /^SELECT\s+COUNT\(DISTINCT\s+log\.meta\.endpoint\)\s+AS\s+uniqueEndpoints,\s+COUNT\(DISTINCT\s+log\.meta\.service\)\s+AS\s+uniqueServices,\s+COUNT\(\*\)\s+AS\s+totalActions\s+FROM\s+mongodb\."airqo_.*"\.logs\s+WHERE\s+log\.timestamp\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+log\.timestamp\s*<=\s*TIMESTAMP\s+'.*'$/i,
        /^SELECT\s+COUNT\(DISTINCT\s+log\.meta\.email\)\s+AS\s+uniqueUsers,\s+COUNT\(\*\)\s+AS\s+totalEvents\s+FROM\s+mongodb\."airqo_.*"\.logs\s+WHERE\s+log\.timestamp\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+log\.timestamp\s*<=\s*TIMESTAMP\s+'.*'$/i,
        /^SELECT\s+AVG\(CAST\(lastActive\s*-\s*createdAt\s+AS\s+DOUBLE\)\)\s+AS\s+averageUsageTime\s+FROM\s+mongodb\."airqo_.*"\.clients\s+WHERE\s+lastActive\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+lastActive\s*<=\s*TIMESTAMP\s+'.*'$/i,
        /^SELECT\s+log\.meta\.endpoint\s+AS\s+endpoint,\s+COUNT\(\*\)\s+AS\s+usageCount\s+FROM\s+mongodb\."airqo_.*"\.logs\s+WHERE\s+log\.timestamp\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+log\.timestamp\s*<=\s*TIMESTAMP\s+'.*'\s+GROUP\s+BY\s+log\.meta\.endpoint\s+ORDER\s+BY\s+usageCount\s+DESC\s+LIMIT\s+\d+$/i,
        /^SELECT\s+log\.meta\.endpoint\s+AS\s+endpoint,\s+COUNT\(\*\)\s+AS\s+usageCount\s+FROM\s+mongodb\."airqo_.*"\.logs\s+WHERE\s+log\.timestamp\s*>=\s*TIMESTAMP\s+'.*'\s+AND\s+log\.timestamp\s*<=\s*TIMESTAMP\s+'.*'\s+GROUP\s+BY\s+log\.meta\.endpoint\s+ORDER\s+BY\s+usageCount\s+ASC\s+LIMIT\s+\d+$/i,
      ];

      const isValid = allowedQueries.some((regex) => regex.test(value));
      if (!isValid) {
        throw new Error(
          "prestoQuery is not valid or is not in the allowed list of queries"
        );
      }
      return true;
    }),
];

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
  validateDateRange,
  validateCustomQuery,
};
