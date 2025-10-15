const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.ObjectId;
const { createSuccessResponse, createErrorResponse } = require("@utils/shared");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- alert-response-model`
);

const AlertContextSchema = new Schema(
  {
    category: { type: String },
    pollutionLevel: { type: Number },
    pollutant: { type: String },
    location: { type: String },
    timestamp: { type: Date },
  },
  { _id: false }
);

const AlertResponseSchema = new Schema(
  {
    alertId: {
      type: String,
      required: [true, "Alert ID is required"],
      index: true,
    },
    userId: {
      type: ObjectId,
      ref: "user",
      required: [true, "User ID is required"],
      index: true,
    },
    responseType: {
      type: String,
      required: [true, "Response type is required"],
      enum: ["followed", "notFollowed", "dismissed"],
    },
    followedReason: {
      type: String,
      enum: [
        "stayedIndoors",
        "changedPlans",
        "woreMask",
        "reducedOutdoorActivity",
        "closedWindows",
        "other",
        null,
      ],
    },
    notFollowedReason: {
      type: String,
      enum: [
        "hadToGoOut",
        "noAlternative",
        "tooInconvenient",
        "didntBelieveAlert",
        "alreadyIndoors",
        "lackResources",
        "other",
        null,
      ],
    },
    customReason: {
      type: String,
      trim: true,
    },
    respondedAt: {
      type: Date,
      required: [true, "Response timestamp is required"],
    },
    alertContext: {
      type: AlertContextSchema,
    },
  },
  { timestamps: true }
);

AlertResponseSchema.index({ userId: 1, respondedAt: -1 });
AlertResponseSchema.index({ alertId: 1, userId: 1 }, { unique: true });

AlertResponseSchema.statics = {
  async register(args) {
    try {
      const data = await this.create({ ...args });
      return createSuccessResponse("create", data, "alert response");
    } catch (error) {
      logger.error(`Error on register alert response: ${error.message}`);
      return createErrorResponse(error, "register", logger, "alert response");
    }
  },
  async list({ filter = {}, skip = 0, limit = 1000 } = {}) {
    try {
      const responses = await this.find(filter)
        .sort({ respondedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await this.countDocuments(filter);

      return createSuccessResponse(
        "list",
        { data: responses, total },
        "alert responses"
      );
    } catch (error) {
      logger.error(`Error on list alert responses: ${error.message}`);
      return createErrorResponse(error, "list", logger, "alert responses");
    }
  },
  async getStats({ filter = {} } = {}) {
    try {
      const pipeline = [
        { $match: filter },
        {
          $facet: {
            // Facet 1: Main counts and overall stats
            mainStats: [
              {
                $group: {
                  _id: null,
                  totalResponses: { $sum: 1 },
                  followedCount: {
                    $sum: {
                      $cond: [{ $eq: ["$responseType", "followed"] }, 1, 0],
                    },
                  },
                  notFollowedCount: {
                    $sum: {
                      $cond: [{ $eq: ["$responseType", "notFollowed"] }, 1, 0],
                    },
                  },
                  dismissedCount: {
                    $sum: {
                      $cond: [{ $eq: ["$responseType", "dismissed"] }, 1, 0],
                    },
                  },
                  lastResponseDate: { $max: "$respondedAt" },
                  avgResponseTimeMillis: {
                    $avg: {
                      $subtract: ["$respondedAt", "$alertContext.timestamp"],
                    },
                  },
                },
              },
            ],
            // Facet 2: Group by followed reasons
            followedReasons: [
              {
                $match: {
                  responseType: "followed",
                  followedReason: { $ne: null },
                },
              },
              { $group: { _id: "$followedReason", count: { $sum: 1 } } },
              { $project: { _id: 0, reason: "$_id", count: 1 } },
            ],
            // Facet 3: Group by not followed reasons
            notFollowedReasons: [
              {
                $match: {
                  responseType: "notFollowed",
                  notFollowedReason: { $ne: null },
                },
              },
              { $group: { _id: "$notFollowedReason", count: { $sum: 1 } } },
              { $project: { _id: 0, reason: "$_id", count: 1 } },
            ],
            // Facet 4: Group by alert category
            responsesByCategory: [
              { $match: { "alertContext.category": { $ne: null } } },
              {
                $group: {
                  _id: "$alertContext.category",
                  followed: {
                    $sum: {
                      $cond: [{ $eq: ["$responseType", "followed"] }, 1, 0],
                    },
                  },
                  notFollowed: {
                    $sum: {
                      $cond: [{ $eq: ["$responseType", "notFollowed"] }, 1, 0],
                    },
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  category: "$_id",
                  followed: 1,
                  notFollowed: 1,
                },
              },
            ],
          },
        },
      ];

      const result = await this.aggregate(pipeline);

      if (!result || result.length === 0 || result[0].mainStats.length === 0) {
        return createSuccessResponse("getStats", {}, "alert response stats");
      }

      const mainStats = result[0].mainStats[0];
      const followedReasons = result[0].followedReasons.reduce((acc, item) => {
        acc[item.reason] = item.count;
        return acc;
      }, {});
      const notFollowedReasons = result[0].notFollowedReasons.reduce(
        (acc, item) => {
          acc[item.reason] = item.count;
          return acc;
        },
        {}
      );
      const responsesByCategory = result[0].responsesByCategory.reduce(
        (acc, item) => {
          acc[item.category] = {
            followed: item.followed,
            notFollowed: item.notFollowed,
          };
          return acc;
        },
        {}
      );

      const stats = {
        totalResponses: mainStats.totalResponses || 0,
        followedCount: mainStats.followedCount || 0,
        notFollowedCount: mainStats.notFollowedCount || 0,
        dismissedCount: mainStats.dismissedCount || 0,
        followedPercentage:
          mainStats.totalResponses > 0
            ? (mainStats.followedCount / mainStats.totalResponses) * 100
            : 0,
        followedReasons,
        notFollowedReasons,
        lastResponseDate: mainStats.lastResponseDate,
        averageResponseTime: mainStats.avgResponseTimeMillis
          ? mainStats.avgResponseTimeMillis / (1000 * 60) // in minutes
          : 0,
        responsesByCategory,
      };

      return createSuccessResponse("getStats", stats, "alert response stats");
    } catch (error) {
      logger.error(`Error on getStats for alert responses: ${error.message}`);
      return createErrorResponse(
        error,
        "getStats",
        logger,
        "alert response stats"
      );
    }
  },
};

const AlertResponseModel = (tenant) => {
  try {
    return mongoose.model("alertresponses");
  } catch (error) {
    return getModelByTenant(tenant, "alertresponse", AlertResponseSchema);
  }
};

module.exports = AlertResponseModel;
