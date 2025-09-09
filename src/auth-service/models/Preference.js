const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const { addWeeksToProvideDateTime } = require("@utils/common");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const constants = require("@config/constants");
const currentDate = new Date();
const ThemeSchema = require("@models/ThemeSchema");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- preferences-model`
);
const { logObject, HttpError } = require("@utils/shared");

const chartConfigSchema = new Schema({
  fieldId: { type: Number, required: true, min: 1, max: 8 }, // ThingSpeak field ID
  title: { type: String, default: "Chart Title" },
  xAxisLabel: { type: String, default: "Time" },
  yAxisLabel: { type: String, default: "Value" },
  color: { type: String, default: "#d62020" },
  backgroundColor: { type: String, default: "#ffffff" },
  chartType: {
    type: String,
    enum: ["Column", "Line", "Bar", "Spline", "Step"],
    default: "line",
  },
  days: { type: Number, default: 1 },
  results: { type: Number, default: 20 },
  timescale: { type: Number, default: 10 }, // Or String for named intervals
  average: { type: Number, default: 10 }, // Or String
  median: { type: Number, default: 10 }, // Or String
  sum: { type: Number, default: 10 }, // Or String
  rounding: { type: Number, default: 2 },
  dataMin: { type: Number },
  dataMax: { type: Number },
  yAxisMin: { type: Number },
  yAxisMax: { type: Number },
  showLegend: { type: Boolean, default: true },
  showGrid: { type: Boolean, default: true },
  showTooltip: { type: Boolean, default: true },
  referenceLines: [
    {
      value: { type: Number, required: true },
      label: { type: String },
      color: { type: String, default: "#FF0000" },
      style: {
        type: String,
        enum: ["solid", "dashed", "dotted"],
        default: "dashed",
      },
    },
  ],
  annotations: [
    {
      x: { type: Number }, // x coordinate or timestamp
      y: { type: Number }, // y coordinate or value
      text: { type: String },
      color: { type: String, default: "#000000" },
    },
  ],
  // For data transformations
  transformation: {
    type: {
      type: String,
      enum: ["none", "log", "sqrt", "pow"],
      default: "none",
    },
    factor: { type: Number, default: 1 }, // For pow transformation
  },
  // For comparison with historical data
  comparisonPeriod: {
    enabled: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ["previousDay", "previousWeek", "previousMonth", "previousYear"],
      default: "previousDay",
    },
  },
  // For multi-series charts
  showMultipleSeries: { type: Boolean, default: false },
  additionalSeries: [
    {
      fieldId: { type: Number, required: true },
      label: { type: String },
      color: { type: String },
    },
  ],
  isPublic: { type: Boolean, default: false },
  refreshInterval: { type: Number, default: 0 }, // 0 means no auto-refresh, value in seconds
});

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
      default: "pm2_5",
    },
    theme: {
      type: ThemeSchema,
      default: () => ({}),
    },
    pollutants: [
      {
        type: String,
        trim: true,
      },
    ],
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
    lastAccessed: { type: Date },
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
    selected_sites: [siteSchema],
    selected_grids: [gridSchema],
    selected_devices: [deviceSchema],
    selected_cohorts: [cohortSchema],
    selected_airqlouds: [airqloudSchema],
    device_ids: [
      {
        type: ObjectId,
        ref: "device",
      },
    ],
    period: { type: periodSchema, required: [true, "period is required!"] },
    chartConfigurations: [chartConfigSchema],
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
        if (typeof id === "string" && id.trim() === "") return null;
        try {
          return mongoose.Types.ObjectId(id);
        } catch (error) {
          logger.error(`Invalid ObjectId: ${id}`);
          throw new Error(`Invalid ObjectId: ${id}`);
        }
      };

      // Define selected array fields with subschemas
      const selectedArrayFields = [
        "selected_sites",
        "selected_grids",
        "selected_devices",
        "selected_cohorts",
        "selected_airqlouds",
      ];

      // Process selected arrays to ensure uniqueness based on _id
      selectedArrayFields.forEach((field) => {
        if (updateData[field]) {
          // Remove duplicates based on _id
          const uniqueArray = updateData[field].filter(
            (item, index, self) =>
              index ===
              self.findIndex(
                (t) =>
                  t._id && item._id && t._id.toString() === item._id.toString()
              )
          );

          // Use $set to replace the existing array with unique entries
          updateData.$set = updateData.$set || {};
          updateData.$set[field] = uniqueArray;

          // Optional: Remove the original field to prevent double processing
          delete updateData[field];
        }
      });

      // Repeat similar logic for array ID fields
      const arrayIdFields = [
        "airqloud_ids",
        "grid_ids",
        "cohort_ids",
        "network_ids",
        "site_ids",
        "device_ids",
        "group_ids",
      ];

      arrayIdFields.forEach((field) => {
        if (updateData[field]) {
          // Ensure unique ObjectIds
          const uniqueIds = [
            ...new Set(
              (Array.isArray(updateData[field])
                ? updateData[field]
                : [updateData[field]]
              )
                .map(processObjectId)
                .filter(Boolean)
                .map((id) => id.toString())
            ),
          ].map(processObjectId);

          // Use $set to replace the existing array with unique entries
          updateData.$set = updateData.$set || {};
          updateData.$set[field] = uniqueIds;

          // Remove the original field
          delete updateData[field];
        }
      });

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
      pollutants: this.pollutants,
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

      // Remove _id if present
      if (createBody._id) {
        delete createBody._id;
      }

      // Preserve default period creation logic
      if (isEmpty(createBody.period)) {
        createBody.period = {
          value: "Last 7 days",
          label: "Last 7 days",
          unitValue: 7,
          unit: "day",
        };
      }

      logObject("createBody", createBody);
      const data = await this.create({
        ...createBody,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "preference", {
          message: "preference created successfully with no issues detected",
        });
      } else {
        return createEmptySuccessResponse(
          "preference",
          "preference not created despite successful operation"
        );
      }
    } catch (err) {
      logObject("error in the object", err);
      logger.error(`Data conflicts detected -- ${err.message}`);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      return createErrorResponse(err, "create", logger, "preference");
    }
  },

  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const { user_id } = filter;

      // Preserve complex group_id logic with DEFAULT_GROUP fallback
      const groupIdPresent = filter.group_id !== undefined;

      let preferences;
      if (!groupIdPresent) {
        const defaultGroupId = constants.DEFAULT_GROUP;
        if (!defaultGroupId) {
          return {
            success: false,
            message:
              "Internal Server Error: DEFAULT_GROUP constant not defined",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { message: "DEFAULT_GROUP constant not defined" },
          };
        }

        // Try to find preferences with default group first
        preferences = await this.find({ user_id, group_id: defaultGroupId })
          .sort({ lastAccessed: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec();

        // Fallback to any preferences for the user if none found with default group
        if (isEmpty(preferences)) {
          preferences = await this.find({ user_id })
            .sort({ lastAccessed: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();
        }
      } else {
        preferences = await this.find(filter)
          .sort({ lastAccessed: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec();
      }

      // Preserve complex array sorting and timestamp updating logic
      if (!isEmpty(preferences)) {
        preferences.forEach((preference) => {
          // Sort selected arrays by createdAt (preserve all field types)
          if (Array.isArray(preference.selected_sites)) {
            preference.selected_sites.sort((a, b) => b.createdAt - a.createdAt);
          }
          if (Array.isArray(preference.selected_airqlouds)) {
            preference.selected_airqlouds.sort(
              (a, b) => b.createdAt - a.createdAt
            );
          }
          if (Array.isArray(preference.selected_grids)) {
            preference.selected_grids.sort((a, b) => b.createdAt - a.createdAt);
          }
          if (Array.isArray(preference.selected_cohorts)) {
            preference.selected_cohorts.sort(
              (a, b) => b.createdAt - a.createdAt
            );
          }
          if (Array.isArray(preference.selected_devices)) {
            preference.selected_devices.sort(
              (a, b) => b.createdAt - a.createdAt
            );
          }
        });

        // Update lastAccessed timestamp for all found preferences
        preferences.forEach(async (preference) => {
          await this.findByIdAndUpdate(preference._id, {
            lastAccessed: new Date(),
          });
        });
      }

      return {
        success: true,
        data: preferences,
        message: "Successfully listed preferences",
        status: httpStatus.OK,
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "preference");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const updateBody = update;

      // Preserve complex field handling arrays
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

      // Preserve complex field update handling with createdAt timestamps
      const handleFieldUpdate = (field) => {
        if (updateBody[field]) {
          updateBody[field] = updateBody[field].map((item) => ({
            ...item,
            createdAt: item.createdAt || new Date(),
          }));

          updateBody["$addToSet"] = updateBody["$addToSet"] || {};
          updateBody["$addToSet"][field] = { $each: updateBody[field] };
          delete updateBody[field];
        }
      };

      // Process all field types
      fieldsToUpdate.forEach(handleFieldUpdate);

      fieldsToAddToSet.forEach((field) => {
        if (updateBody[field]) {
          updateBody["$addToSet"] = updateBody["$addToSet"] || {};
          updateBody["$addToSet"][field] = { $each: updateBody[field] };
          delete updateBody[field];
        }
      });

      // Remove _id from update if present
      if (updateBody._id) {
        delete updateBody._id;
      }

      const updatedPreference = await this.findOneAndUpdate(
        filter,
        updateBody,
        options
      ).exec();

      if (!isEmpty(updatedPreference)) {
        return createSuccessResponse(
          "update",
          updatedPreference._doc,
          "preference"
        );
      } else {
        return createNotFoundResponse(
          "preference",
          "update",
          "the User Preference you are trying to UPDATE does not exist, please crosscheck"
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
        return createErrorResponse(err, "update", logger, "preference");
      }
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          user_id: 1,
          chartTitle: 1,
          chartSubTitle: 1,
          airqloud_id: 1, // Preserve preference-specific projections
        },
      };

      const removedPreference = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedPreference)) {
        return createSuccessResponse(
          "delete",
          removedPreference._doc,
          "preference"
        );
      } else {
        return createNotFoundResponse(
          "preference",
          "delete",
          "the User Preference you are trying to DELETE does not exist, please crosscheck"
        );
      }
    } catch (error) {
      logger.error(`Data conflicts detected -- ${error.message}`);
      return {
        success: false,
        message: "Data conflicts detected",
        status: httpStatus.CONFLICT,
        errors: { message: error.message },
      };
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
