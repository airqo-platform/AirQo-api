const express = require("express");
const router = express.Router();
const createAnalyticsController = require("@controllers/analytics.controller");
const validateTenant = require("@middleware/validateTenant");
const {
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
} = require("@validators/analytics.validators");

router.get(
  "/activities",
  validateTenant(),
  createAnalyticsController.listActivities
);

router.get("/logs", validateTenant(), createAnalyticsController.listLogs);

router.get(
  "/user-stats",
  validateTenant(),
  createAnalyticsController.getUserStats
);

router.get(
  "/statistics",
  validateTenant(),
  createAnalyticsController.listStatistics
);

// User Engagement Routes
router.get(
  "/:email/engagement",
  validateTenant(),
  userEngagementValidators.getEngagement,
  createAnalyticsController.getUserEngagement
);

router.get(
  "/:email/engagement/metrics",
  validateTenant(),
  userEngagementValidators.getMetrics,
  createAnalyticsController.getEngagementMetrics
);

// Activity Analysis Routes
router.get(
  "/:email/activity-report",
  validateTenant(),
  activityValidators.getReport,
  createAnalyticsController.getActivityReport
);

// Cohort Analysis Routes
router.get(
  "/cohorts",
  validateTenant(),
  cohortValidators.getAnalysis,
  createAnalyticsController.getCohortAnalysis
);

// Predictive Analytics Routes
router.get(
  "/:email/predictions",
  validateTenant(),
  predictiveValidators.getPredictions,
  createAnalyticsController.getPredictiveAnalytics
);

// Service Adoption Routes
router.get(
  "/:email/service-adoption",
  validateTenant(),
  serviceAdoptionValidators.getAdoption,
  createAnalyticsController.getServiceAdoption
);

// Benchmark Routes
router.get(
  "/benchmarks",
  validateTenant(),
  benchmarkValidators.getBenchmarks,
  createAnalyticsController.getBenchmarks
);

// Top Users Routes
router.get(
  "/top-users",
  validateTenant(),
  topUsersValidators.getTopUsers,
  createAnalyticsController.getTopUsers
);

// Aggregated Analytics Routes
router.get(
  "/aggregate",
  validateTenant(),
  aggregateValidators.getAggregated,
  createAnalyticsController.getAggregatedAnalytics
);

// Retention Analysis Routes
router.get(
  "/retention",
  validateTenant(),
  retentionValidators.getRetention,
  createAnalyticsController.getRetentionAnalysis
);

// Health Score Routes
router.get(
  "/:email/health-score",
  validateTenant(),
  healthScoreValidators.getHealthScore,
  createAnalyticsController.getEngagementHealth
);

// Behavior Pattern Routes
router.get(
  "/:email/behavior",
  validateTenant(),
  behaviorValidators.getBehavior,
  createAnalyticsController.getBehaviorPatterns
);

// Existing Email Routes
router.post(
  "/send",
  validateTenant(),
  emailValidators.sendEmails,
  createAnalyticsController.send
);

router.post(
  "/retrieve",
  validateTenant(),
  emailValidators.retrieveStats,
  createAnalyticsController.fetchUserStats
);

router.get(
  "/validate-environment",
  createAnalyticsController.validateEnvironment
);

module.exports = router;
