const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const { addWeeksToProvideDateTime } = require("@utils/date");
const currentDate = new Date();
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- defaults-model`);
const { HttpError } = require("@utils/errors");

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
      if (body._id) {
        delete body._id;
      }
      if (isEmpty(args.period)) {
        args.period = {
          value: "Last 7 days",
          label: "Last 7 days",
          unitValue: 7,
          unit: "day",
        };
      }
      let data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "default created successfully with no issues detected",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          message: "default not created despite successful operation",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }

      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const defaults = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      if (!isEmpty(defaults)) {
        return {
          success: true,
          data: defaults,
          message: "successfully listed the defaults",
          status: httpStatus.OK,
        };
      } else if (isEmpty(defaults)) {
        return {
          success: true,
          message: "no defaults found for this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      if (update._id) {
        delete update._id;
      }
      const updatedDefault = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedDefault)) {
        return {
          success: true,
          message: "successfully modified the default",
          data: updatedDefault._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedDefault)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "The User Default you are trying to UPDATE does not exist, please crosscheck",
          })
        );
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      let errors = { message: err.message };
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code == 11000) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
      }
      next(new HttpError(message, status, errors));
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
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
        return {
          success: true,
          message: "successfully removed the default",
          data: removedDefault._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedDefault)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "the User Default  you are trying to DELETE does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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

const DefaultModel = (tenant) => {
  try {
    let defaults = mongoose.model("defaults");
    return defaults;
  } catch (error) {
    let defaults = getModelByTenant(tenant, "default", DefaultsSchema);
    return defaults;
  }
};

module.exports = DefaultModel;
