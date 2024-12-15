const constants = require("@config/constants");
const { logObject, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const { LogModel } = require("@models/log");
const UserModel = require("@models/User");
const stringify = require("@utils/stringify");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-analytics-util`
);
const { HttpError } = require("@utils/errors");
const httpStatus = require("http-status");

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
            startTime: "2024-01-01",
            endTime: "2024-12-31",
          },
        };

        try {
          const statsResponse = await analytics.enhancedGetUserStats(request);
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
