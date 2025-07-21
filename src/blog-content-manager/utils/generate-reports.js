const mongoose = require("mongoose");
const AnalyticsModel = require("@models/analytics");
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- generate-reports`);

const AnalyticsReportingUtil = {
  views: async (postId, request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).find({
        metricName: "views",
        category: "post",
        metricName: postId,
      });

      const viewsData = analyticsEntries.reduce((acc, curr) => {
        acc[curr.timestamp] = curr.value;
        return acc;
      }, {});

      return {
        success: true,
        data: viewsData,
        message: "Successfully retrieved view data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  comments: async (postId, request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).find({
        metricName: "comments",
        category: "post",
        metricName: postId,
      });

      const commentsData = analyticsEntries.reduce((acc, curr) => {
        acc[curr.timestamp] = curr.value;
        return acc;
      }, {});

      return {
        success: true,
        data: commentsData,
        message: "Successfully retrieved comment data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  popularPosts: async (request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).aggregate([
        {
          $match: {
            metricName: "views",
            category: "post",
          },
        },
        {
          $group: {
            _id: "$metricName",
            count: { $sum: "$value" },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
      ]);

      const popularPostsData = analyticsEntries.map((entry) => ({
        title: entry._id,
        views: entry.count,
      }));

      return {
        success: true,
        data: popularPostsData,
        message: "Successfully retrieved popular posts data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  userViews: async (userId, request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).find({
        metricName: "views",
        category: "user",
        metricName: userId,
      });

      const userViewsData = analyticsEntries.reduce((acc, curr) => {
        acc[curr.timestamp] = curr.value;
        return acc;
      }, {});

      return {
        success: true,
        data: userViewsData,
        message: "Successfully retrieved user view data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  userComments: async (userId, request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).find({
        metricName: "comments",
        category: "user",
        metricName: userId,
      });

      const userCommentsData = analyticsEntries.reduce((acc, curr) => {
        acc[curr.timestamp] = curr.value;
        return acc;
      }, {});

      return {
        success: true,
        data: userCommentsData,
        message: "Successfully retrieved user comment data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  userActivity: async (userId, request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).aggregate([
        {
          $match: {
            metricName: { $in: ["views", "comments"] },
            category: "user",
            metricName: userId,
          },
        },
        {
          $group: {
            _id: "$timestamp",
            activity: { $push: { type: "$type", value: "$value" } },
          },
        },
      ]);

      const userActivityData = analyticsEntries.map((entry) => ({
        timestamp: entry._id,
        activities: entry.activity,
      }));

      return {
        success: true,
        data: userActivityData,
        message: "Successfully retrieved user activity data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  userGrowthReport: async (request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).aggregate([
        {
          $match: {
            metricName: { $in: ["views", "comments"] },
            category: "user",
          },
        },
        {
          $group: {
            _id: "$metricName",
            count: { $sum: "$value" },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      const growthData = analyticsEntries.map((entry) => ({
        metric: entry._id,
        count: entry.count,
      }));

      return {
        success: true,
        data: growthData,
        message: "Successfully generated user growth report",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  postPerformanceReport: async (request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).aggregate([
        {
          $match: {
            metricName: { $in: ["views", "comments"] },
            category: "post",
          },
        },
        {
          $group: {
            _id: "$metricName",
            count: { $sum: "$value" },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      const performanceData = analyticsEntries.map((entry) => ({
        metric: entry._id,
        count: entry.count,
      }));

      return {
        success: true,
        data: performanceData,
        message: "Successfully generated post performance report",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  postEngagementReport: async (postId, request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).find({
        metricName: { $in: ["likes", "shares", "reposts"] },
        category: "post",
        metricName: postId,
      });

      const engagementData = analyticsEntries.reduce((acc, curr) => {
        acc[curr.metricName] = curr.value;
        return acc;
      }, {});

      return {
        success: true,
        data: engagementData,
        message: "Successfully generated post engagement report",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  userEngagementReport: async (userId, request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).find({
        metricName: { $in: ["likes", "shares", "reposts"] },
        category: "user",
        metricName: userId,
      });

      const engagementData = analyticsEntries.reduce((acc, curr) => {
        acc[curr.metricName] = curr.value;
        return acc;
      }, {});

      return {
        success: true,
        data: engagementData,
        message: "Successfully generated user engagement report",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  dailyActiveUsers: async (request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).aggregate([
        {
          $match: {
            metricName: "views",
            category: "user",
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$timestamp" },
              month: { $month: "$timestamp" },
              day: { $dayOfMonth: "$timestamp" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            day: "$_id.day",
            count: 1,
          },
        },
        {
          $sort: { year: 1, month: 1, day: 1 },
        },
      ]);

      const dailyActiveUsersData = analyticsEntries;

      return {
        success: true,
        data: dailyActiveUsersData,
        message: "Successfully retrieved daily active users data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  monthlyActiveUsers: async (request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).aggregate([
        {
          $match: {
            metricName: "views",
            category: "user",
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$timestamp" },
              month: { $month: "$timestamp" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            count: 1,
          },
        },
        {
          $sort: { year: 1, month: 1 },
        },
      ]);

      const monthlyActiveUsersData = analyticsEntries;

      return {
        success: true,
        data: monthlyActiveUsersData,
        message: "Successfully retrieved monthly active users data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  yearlyActiveUsers: async (request, next) => {
    try {
      const { tenant } = request.query;
      const analyticsEntries = await AnalyticsModel(tenant).aggregate([
        {
          $match: {
            metricName: "views",
            category: "user",
          },
        },
        {
          $group: {
            _id: { year: { $year: "$timestamp" } },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            count: 1,
          },
        },
        {
          $sort: { year: 1 },
        },
      ]);

      const yearlyActiveUsersData = analyticsEntries;

      return {
        success: true,
        data: yearlyActiveUsersData,
        message: "Successfully retrieved yearly active users data",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  generateReport: async (reportType, params, request, next) => {
    try {
      switch (reportType) {
        case "postViews":
          return await this.views(params.postId, request, next);
        case "postComments":
          return await this.comments(params.postId, request, next);
        case "popularPosts":
          return await this.popularPosts(request, next);
        case "userViews":
          return await this.userViews(params.userId, request, next);
        case "userComments":
          return await this.userComments(params.userId, request, next);
        case "userActivity":
          return await this.userActivity(params.userId, request, next);
        case "userGrowthReport":
          return await this.userGrowthReport(request, next);
        case "postPerformanceReport":
          return await this.postPerformanceReport(request, next);
        case "postEngagementReport":
          return await this.postEngagementReport(params.postId, request, next);
        case "userEngagementReport":
          return await this.userEngagementReport(params.userId, request, next);
        case "dailyActiveUsers":
          return await this.dailyActiveUsers(request, next);
        case "monthlyActiveUsers":
          return await this.monthlyActiveUsers(request, next);
        case "yearlyActiveUsers":
          return await this.yearlyActiveUsers(request, next);
        default:
          return {
            success: false,
            message: "Invalid report type",
            status: httpStatus.BAD_REQUEST,
          };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
};

module.exports = AnalyticsReportingUtil;
