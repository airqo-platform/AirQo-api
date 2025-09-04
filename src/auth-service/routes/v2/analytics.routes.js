// analytics.routes.js
const express = require("express");
const router = express.Router();
const createAnalyticsController = require("@controllers/analytics.controller");
const analyticsValidations = require("@validators/analytics.validators");
const { validate, headers, pagination } = require("@validators/common");

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

module.exports = router;
