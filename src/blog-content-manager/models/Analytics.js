const mongoose = require("mongoose").set("debug", true);
const uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- analytics-model`);
const { HttpError } = require("@utils/errors");

const AnalyticsSchema = new mongoose.Schema(
  {
    metricName: {
      type: String,
      required: [true, "Metric name is required"],
      trim: true,
      unique: true,
    },
    value: {
      type: Number,
      required: [true, "Metric value is required"],
    },
    type: {
      type: String,
      enum: [
        "pageviews",
        "uniquevisitors",
        "bounces",
        "timeonpage",
        "avgtimeonsite",
      ],
      default: "pageviews",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    category: {
      type: String,
      required: [true, "Metric category is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

AnalyticsSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

AnalyticsSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      metricName: this.metricName,
      value: this.value,
      type: this.type,
      timestamp: this.timestamp,
      category: this.category,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

AnalyticsSchema.statics = {
  async create(args, next) {
    try {
      let body = args;
      if (body._id) {
        delete body._id;
      }
      let data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Analytics entry created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create analytics entry",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          data: null,
        };
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async list({ skip = 0, limit = 20, filter = {} } = {}, next) {
    try {
      const analyticsEntries = await this.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(analyticsEntries)) {
        return {
          success: true,
          data: analyticsEntries,
          total,
          message: "Successfully retrieved analytics entries",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No analytics entries found",
          data: [],
          total: 0,
          status: httpStatus.OK,
        };
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

  async findById(id, next) {
    try {
      const analyticsEntry = await this.findOne({ _id: id }).exec();

      if (!isEmpty(analyticsEntry)) {
        return {
          success: true,
          data: analyticsEntry,
          message: "Successfully retrieved analytics entry",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Analytics entry not found", httpStatus.NOT_FOUND));
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

  async update({ id, update = {} } = {}, next) {
    try {
      const options = { new: true, runValidators: true };
      if (update._id) {
        delete update._id;
      }
      const updatedAnalyticsEntry = await this.findByIdAndUpdate(
        id,
        update,
        options
      ).exec();

      if (!isEmpty(updatedAnalyticsEntry)) {
        return {
          success: true,
          message: "Successfully updated the analytics entry",
          data: updatedAnalyticsEntry,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Analytics entry not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedAnalyticsEntry = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedAnalyticsEntry)) {
        return {
          success: true,
          message: "Successfully removed the analytics entry",
          data: removedAnalyticsEntry,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Analytics entry not found", httpStatus.NOT_FOUND));
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

  async getMetricStats(metricName, category, next) {
    try {
      const analyticsEntries = await this.find({
        metricName,
        category,
      });

      const stats = analyticsEntries.reduce((acc, curr) => {
        acc[curr.type] = (acc[curr.type] || 0) + curr.value;
        return acc;
      }, {});

      return {
        success: true,
        data: stats,
        message: "Successfully retrieved metric statistics",
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
    }
  },
};

const AnalyticsModel = (tenant) => {
  try {
    let analytics = mongoose.model("analytics");
    return analytics;
  } catch (error) {
    let analytics = getModelByTenant(tenant, "analytics", AnalyticsSchema);
    return analytics;
  }
};

module.exports = AnalyticsModel;
