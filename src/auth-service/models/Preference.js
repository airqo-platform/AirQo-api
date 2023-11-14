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

const siteSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    latitude: { type: Number },
    longitude: { type: Number },
    approximate_latitude: { type: Number },
    approximate_longitude: { type: Number },
    country: { type: String },
    district: { type: String },
    sub_county: { type: String },
    parish: { type: String },
    county: { type: String },
    generated_name: { type: String },
    name: { type: String },
    city: { type: String },
    formatted_name: { type: String },
    region: { type: String },
    search_name: { type: String },
    sub_county: { type: String },
    grid_id: { type: ObjectId },
  },
  { _id: false }
);

const gridSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    name: { type: String },
  },
  { _id: false }
);

const cohortSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    name: { type: String },
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    name: { type: String },
  },
  { _id: false }
);

const airqloudSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    name: { type: String },
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
    airqloud_ids: [
      {
        type: ObjectId,
        ref: "airqloud",
      },
    ],
    grid_id: {
      type: ObjectId,
      ref: "grid",
      default: mongoose.Types.ObjectId(constants.DEFAULT_GRID),
    },
    grid_ids: [
      {
        type: ObjectId,
        ref: "grid",
      },
    ],
    cohort_id: {
      type: ObjectId,
      ref: "cohort",
    },
    cohort_ids: [
      {
        type: ObjectId,
        ref: "cohort",
      },
    ],
    network_id: {
      type: ObjectId,
      ref: "network",
      default: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK),
    },
    network_ids: [
      {
        type: ObjectId,
        ref: "network",
      },
    ],
    group_id: {
      type: ObjectId,
      ref: "group",
      default: mongoose.Types.ObjectId(constants.DEFAULT_GROUP),
    },
    group_ids: [
      {
        type: ObjectId,
        ref: "group",
      },
    ],
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
    selected_sites: [{ type: siteSchema }],
    selected_grids: [{ type: gridSchema }],
    selected_devices: [{ type: deviceSchema }],
    selected_cohorts: [{ type: cohortSchema }],
    selected_airqlouds: [{ type: airqloudSchema }],

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

PreferenceSchema.pre("save", function (next) {
  if (this.selected_sites) {
    this.selected_sites = Array.from(
      new Set(this.selected_sites.map((id) => id.toString()))
    );
  }

  if (this.selected_grids) {
    this.selected_grids = Array.from(
      new Set(this.selected_grids.map((id) => id.toString()))
    );
  }

  if (this.selected_cohorts) {
    this.selected_cohorts = Array.from(
      new Set(this.selected_cohorts.map((id) => id.toString()))
    );
  }

  if (this.selected_devices) {
    this.selected_devices = Array.from(
      new Set(this.selected_devices.map((id) => id.toString()))
    );
  }

  if (this.selected_airqlouds) {
    this.selected_airqlouds = Array.from(
      new Set(this.selected_airqlouds.map((id) => id.toString()))
    );
  }

  if (this.airqloud_ids) {
    this.airqloud_ids = Array.from(
      new Set(this.airqloud_ids.map((id) => id.toString()))
    );
  }

  if (this.device_ids) {
    this.device_ids = Array.from(
      new Set(this.device_ids.map((id) => id.toString()))
    );
  }

  if (this.site_ids) {
    this.site_ids = Array.from(
      new Set(this.site_ids.map((id) => id.toString()))
    );
  }

  if (this.cohort_ids) {
    this.cohort_ids = Array.from(
      new Set(this.cohort_ids.map((id) => id.toString()))
    );
  }

  if (this.grid_ids) {
    this.grid_ids = Array.from(
      new Set(this.grid_ids.map((id) => id.toString()))
    );
  }

  if (this.network_ids) {
    this.network_ids = Array.from(
      new Set(this.network_ids.map((id) => id.toString()))
    );
  }

  if (this.group_ids) {
    this.group_ids = Array.from(
      new Set(this.group_ids.map((id) => id.toString()))
    );
  }

  return next();
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
      airqloud_ids: this.airqloud_ids,
      cohort_ids: this.cohort_ids,
      grid_ids: this.grid_ids,
      startDate: this.startDate,
      endDate: this.endDate,
      chartType: this.chartType,
      chartTitle: this.chartTitle,
      chartSubTitle: this.chartSubTitle,
      site_ids: this.site_ids,
      device_ids: this.device_ids,
      network_id: this.network_id,
      group_id: this.group_id,
      network_ids: this.network_ids,
      group_ids: this.group_ids,
      period: this.period,
      createdAt: this.createdAt,
      selected_sites: this.selected_sites,
      selected_grids: this.selected_grids,
      selected_devices: this.selected_devices,
      selected_cohorts: this.selected_cohorts,
      selected_airqlouds: this.selected_airqlouds,
    };
  },
};

PreferenceSchema.statics = {
  async register(args) {
    try {
      let createBody = args;
      logObject("args", args);
      if (createBody._id) {
        delete createBody._id;
      }

      if (isEmpty(createBody.period)) {
        createBody.period = {
          value: "Last 7 days",
          label: "Last 7 days",
          unitValue: 7,
          unit: "day",
        };
      }

      logObject("createBody", createBody);
      let data = await this.create({
        ...createBody,
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
      logObject("error in the object", err);
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
      let updateBody = update;

      if (updateBody._id) {
        delete updateBody._id;
      }

      if (updateBody.selected_sites) {
        updateBody["$addToSet"] = {
          selected_sites: { $each: updateBody.selected_sites },
        };
        delete updateBody.selected_sites;
      }

      if (updateBody.selected_grids) {
        updateBody["$addToSet"] = {
          selected_grids: { $each: updateBody.selected_grids },
        };
        delete updateBody.selected_grids;
      }

      if (updateBody.selected_cohorts) {
        updateBody["$addToSet"] = {
          selected_cohorts: { $each: updateBody.selected_cohorts },
        };
        delete updateBody.selected_cohorts;
      }

      if (updateBody.selected_devices) {
        updateBody["$addToSet"] = {
          selected_devices: { $each: updateBody.selected_devices },
        };
        delete updateBody.selected_devices;
      }

      if (updateBody.selected_airqlouds) {
        updateBody["$addToSet"] = {
          selected_airqlouds: { $each: updateBody.selected_airqlouds },
        };
        delete updateBody.selected_airqlouds;
      }

      if (updateBody.airqloud_ids) {
        updateBody["$addToSet"] = {
          airqloud_ids: { $each: updateBody.airqloud_ids },
        };
        delete updateBody.airqloud_ids;
      }

      if (updateBody.device_ids) {
        updateBody["$addToSet"] = {
          device_ids: { $each: updateBody.device_ids },
        };
        delete updateBody.device_ids;
      }

      if (updateBody.cohort_ids) {
        updateBody["$addToSet"] = {
          cohort_ids: { $each: updateBody.cohort_ids },
        };
        delete updateBody.cohort_ids;
      }

      if (updateBody.grid_ids) {
        updateBody["$addToSet"] = {
          grid_ids: { $each: updateBody.grid_ids },
        };
        delete updateBody.grid_ids;
      }

      if (updateBody.site_ids) {
        updateBody["$addToSet"] = {
          site_ids: { $each: updateBody.site_ids },
        };
        delete updateBody.site_ids;
      }

      if (updateBody.network_ids) {
        updateBody["$addToSet"] = {
          network_ids: { $each: updateBody.network_ids },
        };
        delete updateBody.network_ids;
      }

      if (updateBody.group_ids) {
        updateBody["$addToSet"] = {
          group_ids: { $each: updateBody.group_ids },
        };
        delete updateBody.group_ids;
      }

      const updatedPreference = await this.findOneAndUpdate(
        filter,
        updateBody,
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
