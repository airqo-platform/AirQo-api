const constants = require("@config/constants");
const { logObject, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const generateFilter = require("@utils/generate-filter");
const { LogModel } = require("@models/log");
const UserModel = require("@models/User");
const stringify = require("@utils/stringify");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-analytics-util`
);
const { HttpError } = require("@utils/errors");
const httpStatus = require("http-status");
const {
  addMonthsToProvideDateTime,
  monthsInfront,
  isTimeEmpty,
  getDifferenceInMonths,
  addDays,
} = require("@utils/date");

const routesWithService = [
  {
    method: "POST",
    uriIncludes: [
      "api/v2/analytics/data-download",
      "api/v1/analytics/data-download",
    ],
    service: "data-export-download",
    action: "Export Data",
  },
  {
    method: "POST",
    uriIncludes: [
      "api/v1/analytics/data-export",
      "api/v2/analytics/data-export",
    ],
    service: "data-export-scheduling",
    action: "Schedule Data Download",
  },
  /**** Sites */
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "Site Creation",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "View Sites",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "Site Update",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "Site Deletion",
  },

  /**** Devices */
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "Device Deletion",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/soft?"],
    service: "device-registry",
    action: "Device SOFT Deletion",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "Device Update",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/soft?"],
    service: "device-registry",
    action: "Device SOFT Update",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "View Devices",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "Device Creation",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/soft?"],
    service: "device-registry",
    action: "Device SOFT Creation",
  },
  /**** Cohorts */
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "View Cohorts",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Create Cohorts",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Update Cohort",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Delete Cohort",
  },

  /**** Grids */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "View Grids",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Update Grid",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Delete Grid",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Create Grid",
  },

  /**** AirQlouds */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "View AirQlouds",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Creation",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Update",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Deletion",
  },

  /**** Site Activities */

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/activities/maintain"],
    service: "device-maintenance",
    action: "Maintain Device",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/activities/recall"],
    service: "device-recall",
    action: "Recall Device",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/activities/deploy"],
    service: "device-deployment",
    action: "Deploy Device",
  },

  /**** Users */
  {
    method: "POST",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "Create User",
  },
  {
    method: "GET",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "View Users",
  },
  {
    method: "PUT",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "Update User",
  },
  {
    method: "DELETE",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "Delete User",
  },

  /****Incentives*/
  {
    method: "POST",
    uriIncludes: [
      "api/v1/incentives/transactions/accounts/payments",
      "api/v2/incentives/transactions/accounts/payments",
    ],
    service: "incentives",
    action: "Add Money to Organizational Account",
  },
  {
    method: "POST",
    uriIncludes: [
      "api/v1/incentives/transactions/hosts",
      "api/v2/incentives/transactions/hosts",
    ],
    service: "incentives",
    action: "Send Money to Host",
  },

  /**** Calibrate */
  {
    method: "POST",
    uriIncludes: ["/api/v1/calibrate", "/api/v2/calibrate"],
    service: "calibrate",
    action: "calibrate device",
  },

  /**** Locate */
  {
    method: "POST",
    uriIncludes: ["/api/v1/locate", "/api/v2/locate"],
    service: "locate",
    action: "Identify Suitable Device Locations",
  },

  /**** Fault Detection */
  {
    method: "POST",
    uriIncludes: ["/api/v1/predict-faults", "/api/v2/predict-faults"],
    service: "fault-detection",
    action: "Detect Faults",
  },

  /**** Readings... */
  {
    method: "GET",
    uriIncludes: [
      "/api/v2/devices/measurements",
      "/api/v2/devices/events",
      "/api/v2/devices/readings",
    ],
    service: "events-registry",
    action: " Retrieve Measurements",
  },

  /**** Data Proxy */
  {
    method: "GET",
    uriIncludes: ["/api/v2/data"],
    service: "data-mgt",
    action: "Retrieve Data",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/data-proxy"],
    service: "data-proxy",
    action: "Retrieve Data",
  },

  /*****Analytics */
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/sites"],
    service: "analytics",
    action: "Retrieve Sites on Analytics Page",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/historical/daily-averages"],
    service: "analytics",
    action: "Retrieve Daily Averages on Analytics Page",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/exceedances-devices"],
    service: "analytics",
    action: "Retrieve Exceedances on Analytics Page",
  },

  /*****KYA lessons */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Retrieve KYA lessons",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Create KYA lesson",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Update KYA lesson",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Delete KYA lesson",
  },
  /*****KYA Quizzes */
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/kya/quizzes/users"],
    service: "kya",
    action: "Retrieve KYA quizzes",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Create KYA quizzes",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Update KYA quiz",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Delete KYA quiz",
  },

  /*****view */
  {
    method: "GET",
    uriIncludes: ["/api/v2/view/mobile-app/version-info"],
    service: "mobile-version",
    action: "View Mobile App Information",
  },

  /*****Predict */
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/daily-forecast"],
    service: "predict",
    action: "Retrieve Daily Forecasts",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/hourly-forecast"],
    service: "predict",
    action: "Retrieve Hourly Forecasts",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/heatmap"],
    service: "predict",
    action: "Retrieve Heatmap",
  },

  /*****Device Monitoring */
  {
    method: "GET",
    uriIncludes: ["/api/v2/monitor"],
    service: "monitor",
    action: "Retrieve Network Statistics Data",
  },

  {
    method: "GET",
    uriIncludes: ["/api/v2/meta-data"],
    service: "meta-data",
    action: "Retrieve Metadata",
  },

  {
    method: "GET",
    uriIncludes: ["/api/v2/network-uptime"],
    service: "network-uptime",
    action: "Retrieve Network Uptime Data",
  },
];

// Helper functions to calculate additional metrics
function calculateActivityDuration(
  firstActivity,
  lastActivity,
  yearStart,
  yearEnd
) {
  // Ensure we're working with Date objects
  const start = new Date(firstActivity);
  const end = new Date(lastActivity);
  const yearStartDate = new Date(yearStart);
  const yearEndDate = new Date(yearEnd);

  // Use the year boundaries if dates fall outside
  const effectiveStart = start < yearStartDate ? yearStartDate : start;
  const effectiveEnd = end > yearEndDate ? yearEndDate : end;

  // Calculate duration
  const duration = effectiveEnd - effectiveStart;
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));

  // Calculate months more accurately
  const months = Math.floor(
    (effectiveEnd.getFullYear() - effectiveStart.getFullYear()) * 12 +
      (effectiveEnd.getMonth() - effectiveStart.getMonth())
  );

  return {
    totalDays: days,
    totalMonths: months,
    yearStart: yearStartDate,
    yearEnd: yearEndDate,
    actualStart: effectiveStart,
    actualEnd: effectiveEnd,
    description:
      months > 0
        ? `Active for ${months} month${months !== 1 ? "s" : ""}`
        : `Active for ${days} day${days !== 1 ? "s" : ""}`,
  };
}

// Helper function for calculating engagement score
function calculateEngagementScore({
  totalActions,
  uniqueServices,
  uniqueEndpoints,
  activityDays,
}) {
  // Use at least 30 days as denominator
  const actionsPerDay = totalActions / Math.max(activityDays, 30);

  const serviceDiversity =
    uniqueServices / Math.min(routesWithService.length, 20);
  const endpointDiversity = Math.min(uniqueEndpoints / 10, 1);

  return (
    (actionsPerDay * 0.4 + serviceDiversity * 0.3 + endpointDiversity * 0.3) *
    100
  );
}

// Simplified engagement tier calculation
function calculateEngagementTier(score) {
  if (score >= 80) return "Elite User";
  if (score >= 65) return "Super User";
  if (score >= 45) return "High Engagement";
  if (score >= 25) return "Moderate Engagement";
  return "Low Engagement";
}

function capitalizeWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatServiceName(serviceName) {
  // Handle null, undefined or empty strings
  if (!serviceName) return "";

  // Replace hyphens with spaces and split into words
  return serviceName.split("-").map(capitalizeWord).join(" ");
}

const analytics = {
  enhancedGetUserStats: async (request, next) => {
    try {
      return {
        success: false,
        message: "enhancedGetUserStats temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "enhancedGetUserStats temporarily disabled" },
      };
      const {
        tenant,
        limit = 1000,
        skip = 0,
        startTime,
        endTime,
      } = request.query;

      const filter = {
        ...generateFilter.logs(request, next),
        timestamp: {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        },
        "meta.service": { $nin: ["unknown", "none", "", null] },
      };

      logger.info(`Applied filter: ${stringify(filter)}`);

      const pipeline = [
        { $match: filter },
        {
          $facet: {
            paginatedResults: [
              {
                $group: {
                  _id: "$meta.email",
                  username: { $first: "$meta.username" },
                  totalCount: { $sum: 1 },
                  uniqueServices: { $addToSet: "$meta.service" },
                  uniqueEndpoints: { $addToSet: "$meta.endpoint" },
                  firstActivity: { $min: "$timestamp" },
                  lastActivity: { $max: "$timestamp" },
                  // Efficient service usage tracking
                  serviceUsage: {
                    $push: {
                      service: "$meta.service",
                      endpoint: "$meta.endpoint",
                    },
                  },
                },
              },
              { $sort: { totalCount: -1 } },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [
              { $group: { _id: "$meta.email" } },
              { $count: "total" },
            ],
          },
        },
      ];

      const [results] = await LogModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      const enrichedStats = results.paginatedResults.map((stat) => {
        // Calculate service statistics
        const serviceStats = stat.serviceUsage.reduce((acc, curr) => {
          const { service } = curr;
          acc[service] = (acc[service] || 0) + 1;
          return acc;
        }, {});

        const topServices = Object.entries(serviceStats)
          .map(([service, count]) => ({
            service: formatServiceName(service),
            count,
          }))
          .sort((a, b) => b.count - a.count);

        const activityDuration = calculateActivityDuration(
          stat.firstActivity,
          stat.lastActivity,
          new Date(startTime),
          new Date(endTime)
        );

        return {
          email: stat._id,
          username: stat.username,
          count: stat.totalCount,
          uniqueServices: stat.uniqueServices,
          uniqueEndpoints: stat.uniqueEndpoints,
          firstActivity: stat.firstActivity,
          lastActivity: stat.lastActivity,
          topServices,
          activityDuration,
          engagementTier: calculateEngagementTier({
            count: stat.totalCount,
            uniqueServices: stat.uniqueServices,
            uniqueEndpoints: stat.uniqueEndpoints,
            activityDuration,
          }),
        };
      });

      return {
        success: true,
        message: "Successfully retrieved user statistics",
        data: enrichedStats,
        total: results.totalCount[0]?.total || 0,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  validateEnvironmentData: async ({
    tenant,
    year = new Date().getFullYear(),
  } = {}) => {
    try {
      return {
        success: false,
        message: " validateEnvironmentData temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: " validateEnvironmentData temporarily disabled" },
      };
      logger.info(
        `Running data validation for environment: ${constants.ENVIRONMENT}`
      );

      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);

      const pipeline = [
        {
          $match: {
            timestamp: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $facet: {
            monthlyDistribution: [
              {
                $group: {
                  _id: {
                    year: { $year: "$timestamp" },
                    month: { $month: "$timestamp" },
                  },
                  count: { $sum: 1 },
                  uniqueUsers: { $addToSet: "$meta.email" },
                  uniqueEndpoints: { $addToSet: "$meta.endpoint" },
                  uniqueServices: { $addToSet: "$meta.service" },
                },
              },
              { $sort: { "_id.year": 1, "_id.month": 1 } },
            ],
            userSample: [
              {
                $group: {
                  _id: "$meta.email",
                  firstActivity: { $min: "$timestamp" },
                  lastActivity: { $max: "$timestamp" },
                  totalActions: { $sum: 1 },
                },
              },
              { $match: { totalActions: { $gt: 100 } } },
              { $limit: 10 },
            ],
            systemMetrics: [
              {
                $group: {
                  _id: null,
                  totalLogs: { $sum: 1 },
                  avgLogsPerDay: {
                    $avg: {
                      $sum: 1,
                    },
                  },
                  uniqueServices: { $addToSet: "$meta.service" },
                  uniqueEndpoints: { $addToSet: "$meta.endpoint" },
                },
              },
            ],
          },
        },
      ];

      const [results] = await LogModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      // Enrich the monthly distribution with percentage changes
      const enrichedDistribution = results.monthlyDistribution.map(
        (month, index, arr) => {
          const prevMonth = index > 0 ? arr[index - 1] : null;
          return {
            year: month._id.year,
            month: month._id.month,
            totalLogs: month.count,
            uniqueUsers: month.uniqueUsers.length,
            uniqueEndpoints: month.uniqueEndpoints.length,
            uniqueServices: month.uniqueServices.length,
            percentageChange: prevMonth
              ? (
                  ((month.count - prevMonth.count) / prevMonth.count) *
                  100
                ).toFixed(2)
              : null,
          };
        }
      );

      return {
        success: true,
        message: "Environment data validation completed",
        data: {
          monthlyDistribution: enrichedDistribution,
          userSample: results.userSample,
          systemMetrics: results.systemMetrics[0],
          timeframe: {
            startDate,
            endDate,
            totalDays: Math.floor(
              (endDate - startDate) / (1000 * 60 * 60 * 24)
            ),
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error in validateEnvironmentData: ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
        }
      );
    }
  },
  fetchUserStats: async ({
    emails = [],
    year = new Date().getFullYear(),
    tenant = "airqo",
    chunkSize = 5,
    timeWindowDays = 90, // Process data in 90-day windows
  } = {}) => {
    try {
      return {
        success: false,
        message: "fetchUserStats temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "fetchUserStats temporarily disabled" },
      };
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      const enrichedStats = [];

      // Process users in chunks to avoid memory overload
      for (let i = 0; i < emails.length; i += chunkSize) {
        const emailChunk = emails.slice(i, i + chunkSize);

        // Break the year into smaller time windows
        const timeWindows = [];
        let currentStart = new Date(startDate);

        while (currentStart < endDate) {
          const windowEnd = new Date(currentStart);
          windowEnd.setDate(windowEnd.getDate() + timeWindowDays);
          const actualEnd = windowEnd > endDate ? endDate : windowEnd;

          timeWindows.push({
            start: new Date(currentStart),
            end: new Date(actualEnd),
          });

          currentStart = new Date(actualEnd);
        }

        // Process each time window for the current user chunk
        const userStatsPromises = timeWindows.map(async (window) => {
          const pipeline = [
            {
              $match: {
                timestamp: {
                  $gte: window.start,
                  $lte: window.end,
                },
                "meta.email": { $in: emailChunk },
                "meta.service": { $nin: ["unknown", "none", "", null] },
              },
            },
            {
              $group: {
                _id: "$meta.email",
                totalCount: { $sum: 1 },
                username: { $first: "$meta.username" },
                firstActivity: { $min: "$timestamp" },
                lastActivity: { $max: "$timestamp" },
                uniqueServices: { $addToSet: "$meta.service" },
                uniqueEndpoints: { $addToSet: "$meta.endpoint" },
                serviceUsage: {
                  $push: {
                    service: "$meta.service",
                  },
                },
              },
            },
          ];

          return LogModel(tenant).aggregate(pipeline).allowDiskUse(true).exec();
        });

        // Wait for all time windows to complete for current user chunk
        const windowResults = await Promise.all(userStatsPromises);

        // Merge results for each user across time windows
        const mergedUserStats = emailChunk.reduce((acc, email) => {
          acc[email] = {
            email,
            totalCount: 0,
            username: "",
            firstActivity: null,
            lastActivity: null,
            uniqueServices: new Set(),
            uniqueEndpoints: new Set(),
            serviceUsage: new Map(),
          };
          return acc;
        }, {});

        // Combine stats from all time windows
        windowResults.flat().forEach((stat) => {
          if (!stat || !stat._id) return;

          const userStats = mergedUserStats[stat._id];
          if (!userStats) return;

          userStats.totalCount += stat.totalCount;
          userStats.username = stat.username;

          if (
            !userStats.firstActivity ||
            stat.firstActivity < userStats.firstActivity
          ) {
            userStats.firstActivity = stat.firstActivity;
          }
          if (
            !userStats.lastActivity ||
            stat.lastActivity > userStats.lastActivity
          ) {
            userStats.lastActivity = stat.lastActivity;
          }

          stat.uniqueServices.forEach((s) => userStats.uniqueServices.add(s));
          stat.uniqueEndpoints.forEach((e) => userStats.uniqueEndpoints.add(e));

          // Update service usage counts
          stat.serviceUsage.forEach((usage) => {
            const current = userStats.serviceUsage.get(usage.service) || 0;
            userStats.serviceUsage.set(usage.service, current + 1);
          });
        });

        // Convert merged stats to final format
        Object.values(mergedUserStats).forEach((stat) => {
          if (stat.totalCount === 0) return; // Skip users with no activity

          const topServices = Array.from(stat.serviceUsage.entries())
            .map(([service, count]) => ({
              service: formatServiceName(service),
              count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          const activityDays = Math.floor(
            (stat.lastActivity - stat.firstActivity) / (1000 * 60 * 60 * 24)
          );

          const engagementScore = calculateEngagementScore({
            totalActions: stat.totalCount,
            uniqueServices: stat.uniqueServices.size,
            uniqueEndpoints: stat.uniqueEndpoints.size,
            activityDays: activityDays || 1,
          });

          enrichedStats.push({
            email: stat.email,
            username: stat.username,
            totalActions: stat.totalCount,
            firstActivity: stat.firstActivity,
            lastActivity: stat.lastActivity,
            uniqueServices: Array.from(stat.uniqueServices),
            uniqueEndpoints: Array.from(stat.uniqueEndpoints),
            topServices,
            activityDuration: {
              totalDays: activityDays,
              totalMonths: Math.floor(activityDays / 30),
              description: `Active for ${Math.floor(activityDays / 30)} months`,
            },
            engagementTier: calculateEngagementTier(engagementScore),
          });
        });

        // Add a small delay between chunks to prevent overwhelming the server
        if (i + chunkSize < emails.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return enrichedStats;
    } catch (error) {
      logger.error(`Error in fetchUserStats: ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  sendEmailsInBatches: async (userStats, batchSize = 100) => {
    try {
      return {
        success: false,
        message: "sendEmailsInBatches temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "sendEmailsInBatches temporarily disabled" },
      };
      let emailsSent = 0;
      let lowEngagementCount = 0;

      for (let i = 0; i < userStats.length; i += batchSize) {
        const batch = userStats.slice(i, i + batchSize);
        const emailPromises = batch
          .filter((userStat) => {
            if (userStat.engagementTier === "Low Engagement") {
              lowEngagementCount++;
              return false;
            }
            return true;
          })
          .map((userStat) => {
            const { email, username } = userStat;

            return mailer
              .yearEndEmail({
                email,
                firstName: username.split(" ")[0],
                lastName: username.split(" ")[1] || "",
                userStat,
              })
              .then((response) => {
                if (response && response.success === false) {
                  logger.error(
                    `🐛🐛 Error sending year-end email to ${email}: ${stringify(
                      response
                    )}`
                  );
                } else {
                  emailsSent++;
                }
                return response;
              });
          });

        await Promise.all(emailPromises);
      }

      return {
        success: true,
        message:
          lowEngagementCount > 0
            ? `Sent year-end emails to ${emailsSent} users. Skipped ${lowEngagementCount} users with low engagement.`
            : `Sent year-end emails to ${emailsSent} users`,
      };
    } catch (error) {
      logger.error(`🐛🐛 Error in sendEmailsInBatches: ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  sendYearEndEmails: async (request) => {
    try {
      return {
        success: false,
        message: "sendYearEndEmails temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "sendYearEndEmails temporarily disabled" },
      };
      const { body, query } = request;
      const { emails } = body;
      const { tenant } = query;

      const userStats = await analytics.fetchUserStats({ emails, tenant });
      logObject("userStats", userStats);

      if (userStats.length > 0) {
        const result = await analytics.sendEmailsInBatches(userStats);
        return result;
      } else {
        logger.info("No user stats found for the provided emails.");
        return {
          success: false,
          message: "No user stats found for the provided emails",
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  listLogs: async (request, next) => {
    try {
      const { tenant, limit = 1000, skip = 0 } = request.query;
      const filter = generateFilter.logs(request, next);
      const responseFromListLogs = await LogModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      if (responseFromListLogs.success === true) {
        return {
          success: true,
          message: responseFromListLogs.message,
          data: responseFromListLogs.data,
          status: responseFromListLogs.status
            ? responseFromListLogs.status
            : httpStatus.OK,
        };
      } else if (responseFromListLogs.success === false) {
        const errorObject = responseFromListLogs.errors
          ? responseFromListLogs.errors
          : { message: "Internal Server Error" };
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: responseFromListLogs.message,
              ...errorObject,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getUserStats: async (request, next) => {
    try {
      const { tenant, limit = 1000, skip = 0 } = request.query;
      const filter = generateFilter.logs(request, next);

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: { email: "$meta.email", endpoint: "$meta.endpoint" },
            service: { $first: "$meta.service" },
            username: { $first: "$meta.username" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            email: "$_id.email",
            endpoint: "$_id.endpoint",
            count: 1,
            service: "$service",
            username: "$username",
          },
        },
      ];

      const getUserStatsResponse = await LogModel(tenant).aggregate(pipeline);
      return {
        success: true,
        message: "Successfully retrieved the user statistics",
        data: getUserStatsResponse,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listStatistics: async (tenant, next) => {
    try {
      const responseFromListStatistics = await UserModel(tenant).listStatistics(
        tenant
      );
      return responseFromListStatistics;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = analytics;
