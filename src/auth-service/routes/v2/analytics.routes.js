// analytics.routes.js
const express = require("express");
const router = express.Router();
const createAnalyticsController = require("@controllers/analytics.controller");
const analyticsValidations = require("@validators/analytics.validators");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

router.use(headers);

router.get(
  "/activities",
  analyticsValidations.tenant,
  createAnalyticsController.listActivities
);

router.get(
  "/logs",
  analyticsValidations.tenant,
  createAnalyticsController.listLogs
);

router.get(
  "/user-stats",
  analyticsValidations.tenant,
  createAnalyticsController.getUserStats
);

router.get(
  "/statistics",
  analyticsValidations.tenant,
  createAnalyticsController.listStatistics
);

router.get(
  "/:email/engagement",
  analyticsValidations.userEngagementValidators.getEngagement,
  createAnalyticsController.getUserEngagement
);

router.get(
  "/:email/engagement/metrics",
  analyticsValidations.userEngagementValidators.getMetrics,
  createAnalyticsController.getEngagementMetrics
);

router.get(
  "/:email/activity-report",
  analyticsValidations.activityValidators.getReport,
  createAnalyticsController.getActivityReport
);

router.get(
  "/cohorts",
  analyticsValidations.cohortValidators.getAnalysis,
  createAnalyticsController.getCohortAnalysis
);

router.get(
  "/:email/predictions",
  analyticsValidations.predictiveValidators.getPredictions,
  createAnalyticsController.getPredictiveAnalytics
);

router.get(
  "/:email/service-adoption",
  analyticsValidations.serviceAdoptionValidators.getAdoption,
  createAnalyticsController.getServiceAdoption
);

router.get(
  "/benchmarks",
  analyticsValidations.benchmarkValidators.getBenchmarks,
  createAnalyticsController.getBenchmarks
);

router.get(
  "/top-users",
  analyticsValidations.topUsersValidators.getTopUsers,
  createAnalyticsController.getTopUsers
);

router.get(
  "/aggregate",
  analyticsValidations.aggregateValidators.getAggregated,
  createAnalyticsController.getAggregatedAnalytics
);

router.get(
  "/retention",
  analyticsValidations.retentionValidators.getRetention,
  createAnalyticsController.getRetentionAnalysis
);

router.get(
  "/:email/health-score",
  analyticsValidations.healthScoreValidators.getHealthScore,
  createAnalyticsController.getEngagementHealth
);

router.get(
  "/:email/behavior",
  analyticsValidations.behaviorValidators.getBehavior,
  createAnalyticsController.getBehaviorPatterns
);

router.post(
  "/send",
  analyticsValidations.emailValidators.sendEmails,
  createAnalyticsController.send
);

router.post(
  "/retrieve",
  analyticsValidations.emailValidators.retrieveStats,
  createAnalyticsController.fetchUserStats
);

router.get(
  "/validate-environment",
  createAnalyticsController.validateEnvironment
);

router.get(
  "/presto/user-stats",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getPrestoUserStats
);
router.get(
  "/presto/new-api-users",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getNewAPIUsers
);
router.get(
  "/presto/active-api-users",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getActiveAPIUsers
);
router.get(
  "/presto/recent-users",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getRecentUsers
);
router.get(
  "/presto/new-users",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getNewUsers
);

// New routes for Presto analytics
router.get(
  "/presto/user-engagement",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getUserEngagementMetricsPresto
);

router.get(
  "/presto/activity-summary",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getActivitySummaryPresto
);

router.get(
  "/presto/top-devices",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getTopDevicesPresto
);

router.get(
  "/presto/location-data",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getLocationDataPresto
);

router.post(
  "/presto/custom-query",
  analyticsValidations.tenant,
  analyticsValidations.validateCustomQuery,
  createAnalyticsController.executeCustomQueryPresto
);

router.get(
  "/presto/daily-active-users",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getDailyActiveUsers
);

router.get(
  "/presto/monthly-active-users",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getMonthlyActiveUsers
);

router.get(
  "/presto/average-usage-time",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getAverageUsageTimePerUser
);

router.get(
  "/presto/most-used-features",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getMostUsedFeatures
);

router.get(
  "/presto/least-used-features",
  analyticsValidations.tenant,
  analyticsValidations.validateDateRange,
  createAnalyticsController.getLeastUsedFeatures
);

module.exports = router;
