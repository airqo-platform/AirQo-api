const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const { addWeeksToProvideDateTime } = require("@utils/date");
const currentDate = new Date();
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- preferences-model`
);

const periodSchema = new mongoose.Schema(
  {
    value: { type: String },
    label: { type: String },
    unitValue: { type: Number },
    unit: { type: String },
  },
  { _id: false }
);

const PreferenceSchema = new mongoose.Schema(
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
    airqloud_id: {
      type: ObjectId,
      ref: "airqloud",
      default: mongoose.Types.ObjectId(constants.DEFAULT_AIRQLOUD),
    },
    grid_id: {
      type: ObjectId,
      ref: "grid",
      default: mongoose.Types.ObjectId(constants.DEFAULT_GRID),
    },
    cohort_id: {
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
    user_id: {
      type: ObjectId,
      required: [true, "user_id is required"],
      ref: "user",
      unique: true,
    },
    site_ids: [
      {
        type: ObjectId,
        ref: "site",
      },
    ],
    device_ids: [
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

PreferenceSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

PreferenceSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      pollutant: this.pollutant,
      frequency: this.frequency,
      user_id: this.user_id,
      airqloud_id: this.airqloud_id,
      cohort_id: this.cohort_id,
      grid_id: this.grid_id,
      startDate: this.startDate,
      endDate: this.endDate,
      chartType: this.chartType,
      chartTitle: this.chartTitle,
      chartSubTitle: this.chartSubTitle,
      site_ids: this.site_ids,
      device_ids: this.device_ids,
      network_id: this.network_id,
      period: this.period,
      createdAt: this.createdAt,
    };
  },
};

PreferenceSchema.statics = {
  async register(args) {
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
          message: "preference created successfully with no issues detected",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          message: "preference not created despite successful operation",
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
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}) {
    try {
      const preferences = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      if (!isEmpty(preferences)) {
        return {
          success: true,
          data: preferences,
          message: "successfully listed the preferences",
          status: httpStatus.OK,
        };
      } else if (isEmpty(preferences)) {
        return {
          success: true,
          message: "no preferences found for this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Data conflicts detected -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.CONFLICT,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      if (update._id) {
        delete update._id;
      }
      const updatedPreference = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedPreference)) {
        return {
          success: true,
          message: "successfully modified the preference",
          data: updatedPreference._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedPreference)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "the User Preference  you are trying to UPDATE does not exist, please crosscheck",
          },
        };
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
      return {
        success: false,
        message,
        errors,
        status,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          user_id: 1,
          chartTitle: 1,
          chartSubTitle: 1,
          airqloud_id: 1,
        },
      };
      let removedPreference = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedPreference)) {
        return {
          success: true,
          message: "successfully removed the preference",
          data: removedPreference._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedPreference)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "the User Preference  you are trying to DELETE does not exist, please crosscheck",
          },
        };
      }
    } catch (error) {
      logger.error(`Data conflicts detected -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

const PreferenceModel = (tenant) => {
  try {
    let preferences = mongoose.model("preferences");
    return preferences;
  } catch (error) {
    let preferences = getModelByTenant(tenant, "preference", PreferenceSchema);
    return preferences;
  }
};

module.exports = PreferenceModel;
