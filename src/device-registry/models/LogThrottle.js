const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const moment = require("moment-timezone");
const { getModelByTenant } = require("@config/database");

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- log-throttle-model`
);

const logThrottleSchema = new Schema(
  {
    date: {
      type: String,
      required: [true, "date is required!"],
      trim: true,
      // Format: YYYY-MM-DD
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },
    logType: {
      type: String,
      required: [true, "logType is required!"],
      trim: true,
      enum: {
        values: constants.ALLOWED_LOG_TYPES,
        message: `logType must be one of: ${constants.ALLOWED_LOG_TYPES.join(
          ", "
        )}`,
      },
    },
    count: {
      type: Number,
      default: 0,
      min: [0, "Count cannot be negative"],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    environment: {
      type: String,
      default: constants.ENVIRONMENT,
      required: [true, "environment is required!"],
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "log_throttle_tracking",
  }
);

// Create compound unique index for efficient queries and prevent duplicates
logThrottleSchema.index(
  { date: 1, logType: 1, environment: 1 },
  { unique: true, name: "log_throttle_unique_idx" }
);

// TTL index - automatically delete documents after a configurable period
logThrottleSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: (constants.LOG_THROTTLE_TTL_DAYS || 30) * 24 * 60 * 60, // TTL in seconds, configurable
    name: "log_throttle_ttl_idx",
    background: true,
  }
);

// Additional indexes for performance
logThrottleSchema.index({ date: 1 });
logThrottleSchema.index({ environment: 1 });

// Instance methods
logThrottleSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      date: this.date,
      logType: this.logType,
      count: this.count,
      lastUpdated: this.lastUpdated,
      environment: this.environment,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

// Static methods
logThrottleSchema.statics = {
  async incrementCount(
    { date, logType, environment = constants.ENVIRONMENT },
    next
  ) {
    try {
      const result = await this.findOneAndUpdate(
        {
          date: date,
          logType: logType,
          environment: environment,
        },
        {
          $inc: { count: 1 },
          $set: { lastUpdated: new Date() },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      if (!isEmpty(result)) {
        return {
          success: true,
          data: result,
          message: "Log count incremented successfully",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "Failed to increment log count",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      if (error.code === 11000) {
        try {
          const existingDoc = await this.findOneAndUpdate(
            {
              date: date,
              logType: logType,
              environment: environment,
            },
            {
              $inc: { count: 1 },
              $set: { lastUpdated: new Date() },
            },
            {
              new: true,
            }
          );

          if (!isEmpty(existingDoc)) {
            return {
              success: true,
              data: existingDoc,
              message: "Log count incremented successfully (retry)",
              status: httpStatus.OK,
            };
          }
        } catch (retryError) {
          logger.error(
            `🐛🐛 Log Throttle Increment Retry Error -- ${JSON.stringify(
              retryError || ""
            )}`
          );
        }
      }

      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(
        `🐛🐛 Log Throttle Increment Error -- ${stringifiedMessage}`
      );

      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw error;
      }
    }
  },

  async getCurrentCount(
    { date, logType, environment = constants.ENVIRONMENT },
    next
  ) {
    try {
      const result = await this.findOne({
        date: date,
        logType: logType,
        environment: environment,
      });

      return {
        success: true,
        data: {
          count: result?.count || 0,
          lastUpdated: result?.lastUpdated || null,
          exists: !!result,
        },
        message: "Current count retrieved successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(
        `🐛🐛 Log Throttle Get Count Error -- ${stringifiedMessage}`
      );

      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        return {
          success: false,
          data: { count: 0, lastUpdated: null, exists: false },
          message: "Failed to retrieve count, defaulting to 0",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    }
  },

  async getDailyCounts({ date, environment = constants.ENVIRONMENT }, next) {
    try {
      const results = await this.find({
        date: date,
        environment: environment,
      });

      const counts = {};
      results.forEach((doc) => {
        counts[doc.logType] = {
          count: doc.count,
          lastUpdated: doc.lastUpdated,
        };
      });

      return {
        success: true,
        data: counts,
        message: "Daily counts retrieved successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(
        `🐛🐛 Log Throttle Get Daily Counts Error -- ${stringifiedMessage}`
      );

      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        return {
          success: false,
          data: {},
          message: "Failed to retrieve daily counts",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    }
  },

  async cleanupOldEntries(
    { daysToKeep = 7, environment = constants.ENVIRONMENT },
    next
  ) {
    try {
      const cutoffDate = moment()
        .tz(constants.TIMEZONE)
        .subtract(daysToKeep, "days")
        .format("YYYY-MM-DD");

      const deleteResult = await this.deleteMany({
        date: { $lt: cutoffDate },
        environment: environment,
      });

      return {
        success: true,
        data: {
          deletedCount: deleteResult.deletedCount || 0,
          cutoffDate: cutoffDate,
        },
        message: `Successfully cleaned up ${deleteResult.deletedCount ||
          0} old log throttle entries`,
        status: httpStatus.OK,
      };
    } catch (error) {
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(`🐛🐛 Log Throttle Cleanup Error -- ${stringifiedMessage}`);

      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        return {
          success: false,
          data: { deletedCount: 0, cutoffDate: null },
          message: "Failed to cleanup old entries",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    }
  },

  async resetDailyCounts({ date, environment = constants.ENVIRONMENT }, next) {
    try {
      const updateResult = await this.updateMany(
        {
          date: date,
          environment: environment,
        },
        {
          $set: {
            count: 0,
            lastUpdated: new Date(),
          },
        }
      );

      return {
        success: true,
        data: {
          modifiedCount: updateResult.modifiedCount || 0,
          matchedCount: updateResult.matchedCount || 0,
        },
        message: `Successfully reset ${updateResult.modifiedCount ||
          0} log throttle entries`,
        status: httpStatus.OK,
      };
    } catch (error) {
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(`🐛🐛 Log Throttle Reset Error -- ${stringifiedMessage}`);

      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        return {
          success: false,
          data: { modifiedCount: 0, matchedCount: 0 },
          message: "Failed to reset daily counts",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    }
  },
};

logThrottleSchema.pre("save", function(next) {
  if (!this.environment) {
    this.environment = constants.ENVIRONMENT;
  }
  if (this.count < 0) {
    this.count = 0;
  }
  next();
});

logThrottleSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany", "update"],
  function(next) {
    const update = this.getUpdate();
    if (update) {
      if (update.$set && !update.$set.environment) {
        update.$set.environment = constants.ENVIRONMENT;
      }
      if (update.$set && update.$set.count < 0) {
        update.$set.count = 0;
      }
    }
    next();
  }
);

const LogThrottleModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model(`log_throttles_${dbTenant}`);
  } catch (error) {
    return getModelByTenant(dbTenant, "log_throttle", logThrottleSchema);
  }
};

module.exports = LogThrottleModel;
