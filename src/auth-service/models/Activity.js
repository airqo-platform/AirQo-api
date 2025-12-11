const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;
const { Schema } = mongoose;
var uniqueValidator = require("mongoose-unique-validator");

const constants = require("@config/constants");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- activity-model`);

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const activitySchema = new Schema(
  {
    email: { type: String, required: true },
    username: { type: String },
    tenant: { type: String, required: true },
    // Daily stats
    dailyStats: [
      {
        date: { type: Date, required: true },
        totalActions: { type: Number, default: 0 },
        services: [
          {
            name: String,
            count: Number,
          },
        ],
        endpoints: [
          {
            name: String,
            count: Number,
          },
        ],
      },
    ],
    monthlyStats: [
      {
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        totalActions: { type: Number, default: 0 },
        uniqueServices: [String],
        uniqueEndpoints: [String],
        topServices: [
          {
            name: String,
            count: Number,
          },
        ],
        engagementScore: Number,
        engagementTier: String,
        firstActivity: Date,
        lastActivity: Date,
      },
    ],
    overallStats: {
      totalActions: { type: Number, default: 0 },
      firstActivity: Date,
      lastActivity: Date,
      engagementScore: Number,
      engagementTier: String,
    },
    lastProcessedLog: { type: mongoose.Schema.Types.ObjectId, ref: "logs" },
  },
  {
    timestamps: true,
    indexes: [
      { email: 1, tenant: 1 },
      { tenant: 1, "monthlyStats.year": 1, "monthlyStats.month": 1 },
      { "dailyStats.date": 1 },
      { lastProcessedLog: 1 },
    ],
  }
);

activitySchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

activitySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
    };
  },
};

activitySchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "activity", {
          message: "activity created",
        });
      } else {
        return createEmptySuccessResponse(
          "activity",
          "activity NOT successfully created but operation successful"
        );
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      return createErrorResponse(err, "create", logger, "activity");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      logObject("filter", filter);
      const inclusionProjection = constants.ACTIVITIES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.ACTIVITIES_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      return {
        success: true,
        data: response,
        message: "successfully retrieved the activities",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (err) {
      return createErrorResponse(err, "list", logger, "activity");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      // Remove tenant from update (immutable field)
      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      const updatedActivity = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedActivity)) {
        return createSuccessResponse(
          "update",
          updatedActivity._doc,
          "activity"
        );
      } else {
        return createNotFoundResponse(
          "activity",
          "update",
          "activity does not exist, please crosscheck -- Not Found"
        );
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      return createErrorResponse(err, "update", logger, "activity");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1, // Preserve minimal projection
        },
      };

      const removedActivity = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedActivity)) {
        return createSuccessResponse(
          "delete",
          removedActivity._doc,
          "activity"
        );
      } else {
        return createNotFoundResponse(
          "activity",
          "delete",
          "Bad Request, activity Not Found -- please crosscheck"
        );
      }
    } catch (err) {
      return createErrorResponse(err, "delete", logger, "activity");
    }
  },
};

const ActivityModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("activities");
  } catch (error) {
    return getModelByTenant(dbTenant, "activity", activitySchema);
  }
};

module.exports = ActivityModel;
