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

function calculateEngagementTier(stats) {
  const {
    count = 0,
    uniqueServices = [],
    uniqueEndpoints = [],
    activityDuration = { totalDays: 0, totalMonths: 0 },
  } = stats;

  logObject("stats being used to calculate Engagement Tier ", stats);

  // Calculate average actions per day
  const actionsPerDay = count / Math.max(activityDuration.totalDays, 1);

  logObject("actionsPerDay", actionsPerDay);

  // Calculate service diversity score (0-1)
  const activeServices = routesWithService.filter((route) =>
    uniqueServices.includes(route.service)
  ).length;
  const serviceDiversity =
    activeServices / Math.min(routesWithService.length, 20);

  logObject("serviceDiversity", serviceDiversity);

  // Calculate duration score (0-1)
  // Assuming 12 months is the maximum for a perfect score
  const durationScore = Math.min(activityDuration.totalMonths / 12, 1);

  logObject("durationScore", durationScore);

  // Weighted engagement score (0-100)
  const engagementScore =
    durationScore * 40 + // Weight for duration (60%)
    actionsPerDay * 30 + // Weight frequency of actions (16%)
    serviceDiversity * 15 + // Weight service diversity (12%)
    Math.min(uniqueEndpoints.length / 5, 1) * 15; // Weight endpoint diversity (15%)

  logObject("engagementScore components", {
    durationComponent: durationScore * 60,
    actionsComponent: actionsPerDay * 16,
    serviceComponent: serviceDiversity * 12,
    endpointComponent: Math.min(uniqueEndpoints.length / 10, 1) * 12,
  });
  logObject("final engagementScore", engagementScore);

  // Adjusted thresholds with more granular tiers
  if (engagementScore >= 80) return "Elite User";
  if (engagementScore >= 65) return "Super User";
  if (engagementScore >= 45) return "High Engagement";
  if (engagementScore >= 25) return "Moderate Engagement";
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
          $gte: startTime,
          $lte: endTime,
        },
      };

      logger.info(`Applied filter: ${stringify(filter)}`);
      logger.info(
        `Start Date: ${request.query.startTime}, End Date: ${request.query.endTime}`
      );

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: { email: "$meta.email", endpoint: "$meta.endpoint" },
            service: { $first: "$meta.service" },
            username: { $first: "$meta.username" },
            count: { $sum: 1 },
            // Filter out unknown and none from unique services
            uniqueServices: {
              $addToSet: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ["$meta.service", "unknown"] },
                      { $ne: ["$meta.service", "none"] },
                      { $ne: ["$meta.service", null] },
                      { $ne: ["$meta.service", ""] },
                    ],
                  },
                  then: "$meta.service",
                  else: "$$REMOVE",
                },
              },
            },
            uniqueEndpoints: {
              $addToSet: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ["$meta.endpoint", "unknown"] },
                      { $ne: ["$meta.endpoint", "none"] },
                      { $ne: ["$meta.endpoint", null] },
                      { $ne: ["$meta.endpoint", ""] },
                    ],
                  },
                  then: "$meta.endpoint",
                  else: "$$REMOVE",
                },
              },
            },
            firstActivity: { $min: "$timestamp" },
            lastActivity: { $max: "$timestamp" },
            actions: {
              $push: {
                service: {
                  $cond: {
                    if: {
                      $and: [
                        { $ne: ["$meta.service", "unknown"] },
                        { $ne: ["$meta.service", "none"] },
                        { $ne: ["$meta.service", null] },
                        { $ne: ["$meta.service", ""] },
                      ],
                    },
                    then: "$meta.service",
                    else: "$$REMOVE",
                  },
                },
                endpoint: "$meta.endpoint",
                timestamp: "$timestamp",
              },
            },
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
            uniqueServices: 1,
            uniqueEndpoints: 1,
            firstActivity: 1,
            lastActivity: 1,
            // Modified topServices calculation to exclude unknown/none
            topServices: {
              $sortArray: {
                input: {
                  $filter: {
                    input: {
                      $map: {
                        input: {
                          $setIntersection: [
                            "$uniqueServices",
                            routesWithService.map((route) => route.service),
                          ],
                        },
                        as: "service",
                        in: {
                          service: "$$service",
                          count: {
                            $size: {
                              $filter: {
                                input: "$actions",
                                as: "action",
                                cond: {
                                  $eq: ["$$action.service", "$$service"],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                    as: "serviceStats",
                    cond: { $gt: ["$$serviceStats.count", 0] },
                  },
                },
                sortBy: { count: -1 },
              },
            },
            mostUsedEndpoints: {
              $sortArray: {
                input: {
                  $filter: {
                    input: {
                      $map: {
                        input: "$uniqueEndpoints",
                        as: "endpoint",
                        in: {
                          endpoint: "$$endpoint",
                          count: {
                            $size: {
                              $filter: {
                                input: "$actions",
                                as: "action",
                                cond: {
                                  $eq: ["$$action.endpoint", "$$endpoint"],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                    as: "endpointStats",
                    cond: { $gt: ["$$endpointStats.count", 0] },
                  },
                },
                sortBy: { count: -1 },
              },
            },
          },
        },
        { $sort: { count: -1 } },
        { $skip: skip },
        { $limit: limit },
      ];

      const getUserStatsResponse = await LogModel(tenant).aggregate(pipeline);

      logObject("getUserStatsResponse", getUserStatsResponse);

      // Enrich the data with more context
      const enrichedStats = getUserStatsResponse.map((stat) => {
        // Find the most used valid service
        const validTopServices = stat.topServices.filter(
          (service) =>
            service &&
            service.service &&
            service.service !== "unknown" &&
            service.service !== "none"
        );

        const topServiceDetails =
          validTopServices.length > 0
            ? routesWithService.find(
                (route) => route.service === validTopServices[0].service
              )
            : null;

        logObject("validTopServices", validTopServices);
        logObject("topServiceDetails", topServiceDetails);

        return {
          ...stat,
          topServiceDescription: topServiceDetails
            ? `Most used service: ${formatServiceName(
                topServiceDetails.service
              )} (${formatServiceName(topServiceDetails.action)}) Used ${
                validTopServices[0].count
              } times`
            : "No primary service identified",
          // Format service names in topServices array
          topServices: stat.topServices.map((service) => ({
            ...service,
            service: formatServiceName(service.service),
          })),
          activityDuration: calculateActivityDuration(
            stat.firstActivity || startTime,
            stat.lastActivity || endTime,
            startTime,
            endTime
          ),
          engagementTier: calculateEngagementTier(stat),
        };
      });

      return {
        success: true,
        message: "Successfully retrieved the user statistics",
        data: enrichedStats,
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
  validateEnvironmentData: async ({
    tenant,
    year = new Date().getFullYear(),
  } = {}) => {
    try {
      logger.info(
        `Running data validation for environment: ${constants.ENVIRONMENT}`
      );
      logger.info(`Server timezone: ${process.env.TZ || "default"}`);

      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);

      // Check data distribution across months
      const monthlyDistribution = await LogModel(tenant).aggregate([
        {
          $match: {
            timestamp: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
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
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
      ]);

      logger.info(
        `Monthly data distribution for ${year}:`,
        stringify(
          monthlyDistribution.map((month) => ({
            year: month._id.year,
            month: month._id.month,
            totalLogs: month.count,
            uniqueUsers: month.uniqueUsers.length,
            uniqueEndpoints: month.uniqueEndpoints.length,
            uniqueServices: month.uniqueServices.length,
          }))
        )
      );

      // Validate date ranges for a sample of users
      const userSample = await LogModel(tenant).aggregate([
        {
          $match: {
            timestamp: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: "$meta.email",
            firstActivity: { $min: "$timestamp" },
            lastActivity: { $max: "$timestamp" },
            totalActions: { $sum: 1 },
          },
        },
        {
          $match: {
            totalActions: { $gt: 100 }, // Only check active users
          },
        },
        { $limit: 10 }, // Sample size
      ]);

      logger.info(
        `User activity ranges sample:`,
        stringify(
          userSample.map((user) => ({
            email: user._id,
            firstActivity: user.firstActivity,
            lastActivity: user.lastActivity,
            totalActions: user.totalActions,
            durationInDays: Math.ceil(
              (new Date(user.lastActivity) - new Date(user.firstActivity)) /
                (1000 * 60 * 60 * 24)
            ),
          }))
        )
      );

      return {
        success: true,
        message: "Environment data validation completed",
        data: {
          monthlyDistribution,
          userSample,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Error in validateEnvironmentData: ${stringify(error)}`
      );
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  fetchUserStats: async ({
    emails,
    year = new Date().getFullYear(),
    tenant = "airqo",
  } = {}) => {
    try {
      await analytics.validateEnvironmentData({ tenant, year });

      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);

      const statsPromises = emails.map(async (email) => {
        const request = {
          query: {
            tenant,
            email,
            startTime: startDate,
            endTime: endDate,
          },
        };

        try {
          const statsResponse = await analytics.enhancedGetUserStats(request);
          logObject("statsResponse", statsResponse);
          const userStat = statsResponse.data[0]; // Assuming first match
          logObject("userStat", userStat);

          if (userStat) {
            // Calculate activity duration using the year-specific dates
            const activityDuration = calculateActivityDuration(
              userStat.firstActivity || startDate,
              userStat.lastActivity || endDate, // Use year end instead of current date
              startDate,
              endDate
            );

            logObject("Activity duration calculation", {
              firstActivity: userStat.firstActivity,
              lastActivity: userStat.lastActivity,
              startDate,
              endDate,
              calculatedDuration: activityDuration,
            });

            // Calculate engagement tier based on total service usage
            const totalServiceCount = userStat.topServices
              ? userStat.topServices.reduce(
                  (sum, service) => sum + (service.count || 0),
                  0
                )
              : 0;

            logObject("object used for second tier calculation", {
              count: totalServiceCount,
              uniqueServices: userStat.uniqueServices,
              uniqueEndpoints: userStat.uniqueEndpoints,
              activityDuration,
            });
            const engagementTier = calculateEngagementTier({
              count: totalServiceCount,
              uniqueServices: userStat.uniqueServices,
              uniqueEndpoints: userStat.uniqueEndpoints,
              activityDuration,
            });

            // Augment user stats with these calculated values
            return {
              ...userStat,
              activityDuration,
              engagementTier,
              topServiceDescription:
                userStat.topServiceDescription || "No top service",
              topServices: userStat.topServices || [],
              mostUsedEndpoints: userStat.mostUsedEndpoints || [],
            };
          }

          return null;
        } catch (error) {
          logger.error(
            `Error fetching stats for ${email}: ${stringify(error)}`
          );
          return null;
        }
      });

      return (await Promise.all(statsPromises)).filter((stat) => stat !== null);
    } catch (error) {
      logger.error(`🐛🐛 Error in fetchUserStats: ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  sendEmailsInBatches: async (userStats, batchSize = 100) => {
    try {
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
