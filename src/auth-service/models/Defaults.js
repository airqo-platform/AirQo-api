const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const { addWeeksToProvideDateTime } = require("@utils/common");
const currentDate = new Date();
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- defaults-model`);

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const periodSchema = new mongoose.Schema(
  {
    value: { type: String },
    label: { type: String },
    unitValue: { type: Number },
    unit: { type: String },
  },
  { _id: false }
);

const DefaultsSchema = new mongoose.Schema(
  {
    pollutant: {
      type: String,
      trim: true,
      required: [true, "pollutant is required!"],
      default: "pm2_5",
    },
    frequency: {
      type: String,
      required: [true, "frequency is required!"],
      default: "hourly",
    },
    startDate: {
      type: Date,
      required: [true, "startDate is required!"],
      default: addWeeksToProvideDateTime(currentDate, -2),
    },
    endDate: {
      type: Date,
      required: [true, "endDate is required!"],
      default: currentDate,
    },
    chartType: {
      type: String,
      required: [true, "chartTyoe is required!"],
      default: "line",
    },
    chartTitle: {
      type: String,
      required: [true, "chartTitle is required!"],
      default: "Chart Title",
    },
    chartSubTitle: {
      type: String,
      required: [true, "chartSubTitle is required!"],
      default: "Chart SubTitle",
    },
    airqloud: {
      type: ObjectId,
      ref: "airqloud",
      default: mongoose.Types.ObjectId(constants.DEFAULT_AIRQLOUD),
    },
    grid: {
      type: ObjectId,
      ref: "grid",
      default: mongoose.Types.ObjectId(constants.DEFAULT_GRID),
    },
    cohort: {
      type: ObjectId,
      ref: "cohort",
    },
    network_id: {
      type: ObjectId,
      ref: "network",
      default: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK),
    },
    group_id: {
      type: ObjectId,
      ref: "group",
      default: mongoose.Types.ObjectId(constants.DEFAULT_GROUP),
    },
    user: {
      type: ObjectId,
      required: [true, "user is required"],
      ref: "user",
    },
    sites: [
      {
        type: ObjectId,
        ref: "site",
      },
    ],
    devices: [
      {
        type: ObjectId,
        ref: "device",
      },
    ],
    period: { type: periodSchema, required: [true, "period is required!"] },
  },
  {
    timestamps: true,
  }
);

DefaultsSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

DefaultsSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      pollutant: this.pollutant,
      frequency: this.frequency,
      user: this.user,
      airqloud: this.airqloud,
      startDate: this.startDate,
      endDate: this.endDate,
      chartType: this.chartType,
      chartTitle: this.chartTitle,
      chartSubTitle: this.chartSubTitle,
      sites: this.sites,
      devices: this.devices,
      network_id: this.network_id,
      period: this.period,
      createdAt: this.createdAt,
    };
  },
};

DefaultsSchema.statics = {
  async register(args, next) {
    try {
      let body = args;

      // Remove _id if present
      if (body._id) {
        delete body._id;
      }

      // Preserve default period logic
      if (isEmpty(args.period)) {
        args.period = {
          value: "Last 7 days",
          label: "Last 7 days",
          unitValue: 7,
          unit: "day",
        };
      }

      const data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "default", {
          message: "default created successfully with no issues detected",
        });
      } else {
        return createEmptySuccessResponse(
          "default",
          "default not created despite successful operation"
        );
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      return createErrorResponse(err, "create", logger, "default");
    }
  },

  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const defaults = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const totalCount = await this.countDocuments(filter);

      return {
        success: true,
        data: defaults,
        message: "successfully listed the defaults",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "default");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };

      // Remove _id from update if present
      if (update._id) {
        delete update._id;
      }

      const updatedDefault = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedDefault)) {
        return createSuccessResponse("update", updatedDefault._doc, "default");
      } else {
        return createNotFoundResponse(
          "default",
          "update",
          "The User Default you are trying to UPDATE does not exist, please crosscheck"
        );
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);

      // Handle specific duplicate errors
      if (err.code == 11000) {
        return {
          success: false,
          message: "duplicate values provided",
          status: httpStatus.CONFLICT,
          errors: err.keyValue || { message: err.message },
        };
      } else {
        return createErrorResponse(err, "update", logger, "default");
      }
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          user: 1,
          chartTitle: 1,
          chartSubTitle: 1,
          airqloud: 1,
        },
      };

      const removedDefault = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedDefault)) {
        return createSuccessResponse("delete", removedDefault._doc, "default");
      } else {
        return createNotFoundResponse(
          "default",
          "delete",
          "the User Default you are trying to DELETE does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "default");
    }
  },
};

const DefaultModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let defaults = mongoose.model("defaults");
    return defaults;
  } catch (error) {
    let defaults = getModelByTenant(dbTenant, "default", DefaultsSchema);
    return defaults;
  }
};

module.exports = DefaultModel;
