const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const { addWeeksToProvideDateTime } = require("@utils/date");
const constants = require("@config/constants");
const currentDate = new Date();
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- preferences-model`
);
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
    createdAt: { type: Date },
    isFeatured: { type: Boolean, default: false },
  },
  { _id: false }
);

const gridSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    name: { type: String },
    createdAt: { type: Date },
  },
  { _id: false }
);

const cohortSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    name: { type: String },
    createdAt: { type: Date },
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    name: { type: String },
    createdAt: { type: Date },
  },
  { _id: false }
);

const airqloudSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId },
    name: { type: String },
    createdAt: { type: Date },
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

PreferenceSchema.index({ user_id: 1, group_id: 1 }, { unique: true });

PreferenceSchema.pre(
  [
    "save",
    "create",
    "update",
    "findByIdAndUpdate",
    "updateMany",
    "updateOne",
    "findOneAndUpdate",
  ],
  async function (next) {
    try {
      // Determine if this is a new document or an update
      const isNew = this.isNew;
      const updateData = this.getUpdate ? this.getUpdate() : this;

      // Utility function to validate and process ObjectIds
      const processObjectId = (id) => {
        if (!id) return null;
        if (id instanceof mongoose.Types.ObjectId) return id;
        try {
          return mongoose.Types.ObjectId(id);
        } catch (error) {
          logger.error(`Invalid ObjectId: ${id}`);
          throw new Error(`Invalid ObjectId: ${id}`);
        }
      };

      // Comprehensive ID fields processing
      const idFieldsToProcess = [
        "airqloud_id",
        "airqloud_ids",
        "grid_id",
        "grid_ids",
        "cohort_id",
        "cohort_ids",
        "network_id",
        "network_ids",
        "group_id",
        "group_ids",
        "site_ids",
        "device_ids",
      ];

      idFieldsToProcess.forEach((field) => {
        if (updateData[field]) {
          if (Array.isArray(updateData[field])) {
            updateData[field] = updateData[field].map(processObjectId);
          } else {
            updateData[field] = processObjectId(updateData[field]);
          }
        }
      });

      // Validate user_id
      if (!updateData.user_id) {
        return next(new Error("user_id is required"));
      }
      updateData.user_id = processObjectId(updateData.user_id);

      // Set default values if not provided
      const defaultFields = [
        { field: "pollutant", default: "pm2_5" },
        { field: "frequency", default: "hourly" },
        { field: "chartType", default: "line" },
        { field: "chartTitle", default: "Chart Title" },
        { field: "chartSubTitle", default: "Chart SubTitle" },
      ];

      defaultFields.forEach(({ field, default: defaultValue }) => {
        if (isNew && !updateData[field]) {
          updateData[field] = defaultValue;
        }
      });

      // Handle date fields
      if (isNew) {
        const currentDate = new Date();
        updateData.startDate =
          updateData.startDate || addWeeksToProvideDateTime(currentDate, -2);
        updateData.endDate = updateData.endDate || currentDate;
      }

      // Validate and process period schema
      if (updateData.period) {
        const validPeriodFields = ["value", "label", "unitValue", "unit"];
        const periodUpdate = {};

        validPeriodFields.forEach((field) => {
          if (updateData.period[field] !== undefined) {
            periodUpdate[field] = updateData.period[field];
          }
        });

        // Additional period validation
        if (
          periodUpdate.unitValue !== undefined &&
          typeof periodUpdate.unitValue !== "number"
        ) {
          periodUpdate.unitValue = Number(periodUpdate.unitValue);
        }

        updateData.period = periodUpdate;
      }

      // Process and validate selected arrays with their specific schemas
      const selectedArrayProcessors = {
        selected_sites: (site) => {
          const processedSite = { ...site };

          // Validate and process ObjectIds
          if (site._id) processedSite._id = processObjectId(site._id);
          if (site.grid_id)
            processedSite.grid_id = processObjectId(site.grid_id);

          // Validate numeric fields
          const numericFields = [
            "latitude",
            "longitude",
            "approximate_latitude",
            "approximate_longitude",
          ];
          numericFields.forEach((field) => {
            if (processedSite[field] !== undefined) {
              processedSite[field] = Number(processedSite[field]);
            }
          });

          // Ensure createdAt is a valid date
          processedSite.createdAt = site.createdAt || new Date();

          // Validate string fields
          const stringFields = [
            "country",
            "district",
            "sub_county",
            "parish",
            "county",
            "generated_name",
            "name",
            "city",
            "formatted_name",
            "region",
            "search_name",
          ];
          stringFields.forEach((field) => {
            if (processedSite[field]) {
              processedSite[field] = String(processedSite[field]).trim();
            }
          });

          // Ensure boolean fields
          processedSite.isFeatured = !!site.isFeatured;

          return processedSite;
        },
        selected_grids: (grid) => ({
          _id: processObjectId(grid._id),
          name: String(grid.name).trim(),
          createdAt: grid.createdAt || new Date(),
        }),
        selected_cohorts: (cohort) => ({
          _id: processObjectId(cohort._id),
          name: String(cohort.name).trim(),
          createdAt: cohort.createdAt || new Date(),
        }),
        selected_devices: (device) => ({
          _id: processObjectId(device._id),
          name: String(device.name).trim(),
          createdAt: device.createdAt || new Date(),
        }),
        selected_airqlouds: (airqloud) => ({
          _id: processObjectId(airqloud._id),
          name: String(airqloud.name).trim(),
          createdAt: airqloud.createdAt || new Date(),
        }),
      };

      // Process selected arrays
      Object.keys(selectedArrayProcessors).forEach((field) => {
        if (updateData[field]) {
          updateData[field] = updateData[field].map(
            selectedArrayProcessors[field]
          );
        }
      });

      // Prepare $addToSet for array fields to prevent duplicates
      const arrayFieldsToAddToSet = [
        ...idFieldsToProcess,
        "selected_sites",
        "selected_grids",
        "selected_devices",
        "selected_cohorts",
        "selected_airqlouds",
      ];

      arrayFieldsToAddToSet.forEach((field) => {
        if (updateData[field]) {
          updateData.$addToSet = updateData.$addToSet || {};
          updateData.$addToSet[field] = {
            $each: updateData[field],
          };
          delete updateData[field];
        }
      });

      // Optional: Add comprehensive logging
      console.log(
        `Preprocessing preference document: ${isNew ? "New" : "Update"}`,
        {
          user_id: updateData.user_id,
          pollutant: updateData.pollutant,
          startDate: updateData.startDate,
          endDate: updateData.endDate,
        }
      );

      next();
    } catch (error) {
      console.error("Error in Preference pre-hook:", error);
      return next(error);
    }
  }
);

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
  async register(args, next) {
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

      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const preferences = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      preferences.forEach((preference) => {
        preference.selected_sites.sort((a, b) => b.createdAt - a.createdAt);
        preference.selected_airqlouds.sort((a, b) => b.createdAt - a.createdAt);
        preference.selected_grids.sort((a, b) => b.createdAt - a.createdAt);
        preference.selected_cohorts.sort((a, b) => b.createdAt - a.createdAt);
        preference.selected_devices.sort((a, b) => b.createdAt - a.createdAt);
      });

      if (!isEmpty(preferences)) {
        return {
          success: true,
          data: preferences,
          message: "Successfully listed the preferences",
          status: httpStatus.OK,
        };
      } else if (isEmpty(preferences)) {
        return {
          success: true,
          message: "No preferences found for this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
      const updateBody = update;

      const fieldsToUpdate = [
        "selected_sites",
        "selected_grids",
        "selected_cohorts",
        "selected_devices",
        "selected_airqlouds",
      ];

      const fieldsToAddToSet = [
        "airqloud_ids",
        "device_ids",
        "cohort_ids",
        "grid_ids",
        "site_ids",
        "network_ids",
        "group_ids",
      ];

      const handleFieldUpdate = (field) => {
        if (updateBody[field]) {
          updateBody[field] = updateBody[field].map((item) => ({
            ...item,
            createdAt: item.createdAt || new Date(),
          }));

          updateBody["$addToSet"] = {
            [field]: { $each: updateBody[field] },
          };
          delete updateBody[field];
        }
      };

      fieldsToUpdate.forEach(handleFieldUpdate);
      fieldsToAddToSet.forEach((field) => {
        if (updateBody[field]) {
          updateBody["$addToSet"] = {
            [field]: { $each: updateBody[field] },
          };
          delete updateBody[field];
        }
      });

      if (updateBody._id) {
        delete updateBody._id;
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "the User Preference  you are trying to UPDATE does not exist, please crosscheck",
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "the User Preference  you are trying to DELETE does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Data conflicts detected -- ${error.message}`);
      next(
        new HttpError("Data conflicts detected", httpStatus.CONFLICT, {
          message: error.message,
        })
      );
    }
  },
};

const PreferenceModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let preferences = mongoose.model("preferences");
    return preferences;
  } catch (error) {
    let preferences = getModelByTenant(
      dbTenant,
      "preference",
      PreferenceSchema
    );
    return preferences;
  }
};

module.exports = PreferenceModel;
