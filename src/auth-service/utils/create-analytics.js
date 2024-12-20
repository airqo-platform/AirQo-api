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
function calculateActivityDuration(firstActivity, lastActivity) {
  const duration = new Date(lastActivity) - new Date(firstActivity);
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);

  return {
    totalDays: days,
    totalMonths: months,
    description:
      months > 0
        ? `Active for ${months} month${months !== 1 ? "s" : ""}`
        : `Active for ${days} day${days !== 1 ? "s" : ""}`,
  };
}

function calculateEngagementTier(count) {
  if (count < 10) return "Low Engagement";
  if (count < 50) return "Moderate Engagement";
  if (count < 100) return "High Engagement";
  return "Super User";
}

function generateYearEndEmail(userStats) {
  const {
    username,
    email,
    firstName,
    lastName,
    topServiceDescription,
    activityDuration,
    engagementTier,
    topServices,
    mostUsedEndpoints,
  } = userStats;

  return `
Dear ${username},

Congratulations on an amazing year with AirQo!

🌟 Your 2024 Highlights 🌟

Engagement Level: ${engagementTier}
Activity Duration: ${activityDuration.description}

Top Service: ${topServiceDescription}

Most Used Services:
${topServices
  .slice(0, 3)
  .map(
    (service, index) =>
      `${index + 1}. ${service.service} (Used ${service.count} times)`
  )
  .join("\n")}

Most Visited Endpoints:
${mostUsedEndpoints
  .slice(0, 3)
  .map(
    (endpoint, index) =>
      `${index + 1}. ${endpoint.endpoint} (Accessed ${endpoint.count} times)`
  )
  .join("\n")}

Thank you for being an incredible part of our community!

Best wishes,
The AirQo Team
  `;
}

const analytics = {
  enhancedGetUserStats: async (request, next) => {
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
            uniqueServices: { $addToSet: "$meta.service" },
            uniqueEndpoints: { $addToSet: "$meta.endpoint" },
            firstActivity: { $min: "$timestamp" },
            lastActivity: { $max: "$timestamp" },
            actions: {
              $push: {
                service: "$meta.service",
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
            topServices: {
              $sortArray: {
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
                            cond: { $eq: ["$$action.service", "$$service"] },
                          },
                        },
                      },
                    },
                  },
                },
                sortBy: { count: -1 },
              },
            },
            mostUsedEndpoints: {
              $sortArray: {
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
                            cond: { $eq: ["$$action.endpoint", "$$endpoint"] },
                          },
                        },
                      },
                    },
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

      // Enrich the data with more context
      const enrichedStats = getUserStatsResponse.map((stat) => {
        // Find the most used service context from routesWithService
        const topServiceDetails = stat.topServices[0]
          ? routesWithService.find(
              (route) => route.service === stat.topServices[0].service
            )
          : null;

        return {
          ...stat,
          topServiceDescription: topServiceDetails
            ? `Most used service: ${topServiceDetails.service} (${topServiceDetails.action})`
            : "No primary service identified",
          activityDuration: calculateActivityDuration(
            stat.firstActivity,
            stat.lastActivity
          ),
          engagementTier: calculateEngagementTier(stat.count),
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
  fetchUserStats: async (emails, tenant = "airqo") => {
    try {
      const statsPromises = emails.map(async (email) => {
        const request = {
          query: {
            tenant,
            email,
            startTime: new Date("2024-01-01"),
            endTime: new Date("2024-12-31"),
          },
        };

        try {
          const statsResponse = await analytics.enhancedGetUserStats(request);
          logObject("statsResponse", statsResponse);
          const userStat = statsResponse.data[0]; // Assuming first match

          if (userStat) {
            // Calculate activity duration
            const activityDuration = calculateActivityDuration(
              userStat.firstActivity || new Date("2024-01-01"),
              userStat.lastActivity || new Date()
            );

            // Calculate engagement tier based on total service usage
            const totalServiceCount = userStat.topServices
              ? userStat.topServices.reduce(
                  (sum, service) => sum + (service.count || 0),
                  0
                )
              : 0;
            const engagementTier = calculateEngagementTier(totalServiceCount);

            // Augment user stats with these calculated values
            return {
              ...userStat,
              activityDuration,
              engagementTier,
              // Ensure required fields exist
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
      for (let i = 0; i < userStats.length; i += batchSize) {
        const batch = userStats.slice(i, i + batchSize);
        const emailPromises = batch.map((userStat) => {
          const { email, username } = userStat;

          const emailContent = generateYearEndEmail(userStat);

          return mailer
            .yearEndEmail({
              email,
              firstName: username.split(" ")[0],
              lastName: username.split(" ")[1] || "",
              emailContent,
            })
            .then((response) => {
              if (response && response.success === false) {
                logger.error(
                  `🐛🐛 Error sending year-end email to ${email}: ${stringify(
                    response
                  )}`
                );
              }
              return response;
            });
        });

        await Promise.all(emailPromises);
      }

      return {
        success: true,
        message: `Sent year-end emails to ${userStats.length} users`,
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
  sendYearEndEmails: async (emails, tenant = "airqo") => {
    try {
      // Fetch user stats for provided emails
      const userStats = await analytics.fetchUserStats(emails, tenant);
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
