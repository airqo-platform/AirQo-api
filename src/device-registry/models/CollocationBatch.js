const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- collocation-batch-model`
);
const { getModelByTenant } = require("@config/database");

// Enum-like statuses (as strings)
const COLLOCATION_BATCH_STATUS = {
  SCHEDULED: "SCHEDULED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
};

const DEVICE_STATUS = {
  ERROR: "ERROR",
  FAILED: "FAILED",
  PASSED: "PASSED",
  RUNNING: "RUNNING",
  SCHEDULED: "SCHEDULED",
};

const DeviceStatusSummaryType = {
  DATA_COMPLETENESS: "DATA_COMPLETENESS",
  INTRA_SENSOR_CORRELATION: "INTRA_SENSOR_CORRELATION",
  INTER_SENSOR_CORRELATION: "INTER_SENSOR_CORRELATION",
  DIFFERENCES: "DIFFERENCES",
};

const collocationBatchSchema = new Schema(
  {
    batch_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    batch_name: {
      type: String,
      required: true,
      trim: true,
    },
    devices: {
      type: [String],
      required: true,
      default: [],
    },
    base_device: {
      type: String,
      required: true,
      trim: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    date_created: {
      type: Date,
      default: Date.now,
    },
    expected_hourly_records: {
      type: Number,
      required: true,
      min: 0,
    },
    inter_correlation_threshold: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    intra_correlation_threshold: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    inter_correlation_r2_threshold: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    intra_correlation_r2_threshold: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    data_completeness_threshold: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    differences_threshold: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    data_completeness_parameter: {
      type: String,
      trim: true,
    },
    inter_correlation_parameter: {
      type: String,
      trim: true,
    },
    intra_correlation_parameter: {
      type: String,
      trim: true,
    },
    differences_parameter: {
      type: String,
      trim: true,
    },
    inter_correlation_additional_parameters: {
      type: [String],
      default: [],
    },
    created_by: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(COLLOCATION_BATCH_STATUS),
      default: COLLOCATION_BATCH_STATUS.SCHEDULED,
    },
    results: {
      type: Schema.Types.Mixed,
      default: null,
    },
    errors: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Static method for registration similar to the Cohort model
collocationBatchSchema.statics.register = async function(args, next) {
  try {
    // Validate inputs similar to Python's validate method
    const validationErrors = [];

    if (args.end_date <= args.start_date) {
      validationErrors.push("End date must be greater than the start date");
    }

    // Add more validations as in the Python implementation
    if (validationErrors.length > 0) {
      return {
        success: false,
        message: validationErrors.join(", "),
        status: httpStatus.BAD_REQUEST,
        errors: validationErrors,
      };
    }

    const createdBatch = await this.create(args);

    return {
      success: true,
      data: createdBatch,
      message: "Collocation batch created",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Collocation Batch Creation Error: ${error.message}`);

    return {
      success: false,
      message: error.message,
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: [error.message],
    };
  }
};

// Method to list collocation batches
collocationBatchSchema.statics.list = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    const batches = await this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      success: true,
      message: batches.length > 0 ? "Batches retrieved" : "No batches found",
      data: batches,
      status: httpStatus.OK,
    };
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

// Method to modify a collocation batch
collocationBatchSchema.statics.modify = async function(
  { filter = {}, update = {} } = {},
  next
) {
  try {
    const options = {
      new: true,
      runValidators: true,
    };

    const updatedBatch = await this.findOneAndUpdate(filter, update, options);

    if (!updatedBatch) {
      return {
        success: false,
        message: "Batch not found",
        status: httpStatus.NOT_FOUND,
      };
    }

    return {
      success: true,
      message: "Batch updated successfully",
      data: updatedBatch,
      status: httpStatus.OK,
    };
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

// Method to remove a collocation batch
collocationBatchSchema.statics.remove = async function(
  { filter = {} } = {},
  next
) {
  try {
    const removedBatch = await this.findOneAndDelete(filter);

    if (!removedBatch) {
      return {
        success: false,
        message: "Batch not found",
        status: httpStatus.NOT_FOUND,
      };
    }

    return {
      success: true,
      message: "Batch removed successfully",
      data: removedBatch,
      status: httpStatus.OK,
    };
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

// Add constant export for statuses
collocationBatchSchema.statics.STATUSES = {
  BATCH_STATUS: COLLOCATION_BATCH_STATUS,
  DEVICE_STATUS: DEVICE_STATUS,
  SUMMARY_TYPES: DeviceStatusSummaryType,
};

const CollocationBatchModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  try {
    return mongoose.model("collocation_batches");
  } catch (error) {
    return getModelByTenant(
      dbTenant,
      "collocation_batch",
      collocationBatchSchema
    );
  }
};

module.exports = CollocationBatchModel;
