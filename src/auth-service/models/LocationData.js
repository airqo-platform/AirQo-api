const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.ObjectId;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- location-data-model`
);

const LocationDataSchema = new Schema(
  {
    userId: {
      type: ObjectId,
      ref: "user",
      required: [true, "User ID is required"],
    },
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
    },
    timestamp: {
      type: Date,
      required: [true, "Timestamp is required"],
    },
    accuracy: {
      type: Number,
    },
    isSharedWithResearchers: {
      type: Boolean,
      default: false,
    },
    contextData: {
      type: Schema.Types.Mixed,
    },
    consentTimestamp: {
      type: Date,
    },
  },
  { timestamps: true }
);

LocationDataSchema.index({ userId: 1, timestamp: -1 });

LocationDataSchema.statics = {
  async register(args) {
    // In a real scenario, this would likely be a bulk insert operation
    // from a mobile device, not a single point registration.
    try {
      const data = await this.create({ ...args });
      return createSuccessResponse("create", data, "location data point");
    } catch (error) {
      logger.error(`Error on register location data: ${error.message}`);
      return createErrorResponse(error, "register", logger, "location data");
    }
  },

  async list({ filter = {}, skip = 0, limit = 1000 } = {}) {
    try {
      const locationData = await this.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      const total = await this.countDocuments(filter);
      return createSuccessResponse(
        "list",
        { data: locationData, total },
        "location data"
      );
    } catch (error) {
      logger.error(`Error on list location data: ${error.message}`);
      return createErrorResponse(error, "list", logger, "location data");
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      const updatedPoint = await this.findOneAndUpdate(filter, update, options);
      if (!updatedPoint) {
        return createNotFoundResponse("location data point", "update");
      }
      return createSuccessResponse(
        "update",
        updatedPoint,
        "location data point"
      );
    } catch (error) {
      logger.error(`Error on modify location data point: ${error.message}`);
      return createErrorResponse(
        error,
        "modify",
        logger,
        "location data point"
      );
    }
  },

  async remove({ filter = {} } = {}) {
    try {
      const removedPoint = await this.findOneAndRemove(filter);
      if (!removedPoint) {
        return createNotFoundResponse("location data point", "delete");
      }
      return createSuccessResponse(
        "delete",
        removedPoint,
        "location data point"
      );
    } catch (error) {
      logger.error(`Error on remove location data point: ${error.message}`);
      return createErrorResponse(
        error,
        "remove",
        logger,
        "location data point"
      );
    }
  },

  async removeMany({ filter = {} } = {}) {
    try {
      const result = await this.deleteMany(filter);
      return createSuccessResponse("delete", result, "location data points");
    } catch (error) {
      logger.error(
        `Error on removeMany location data points: ${error.message}`
      );
      return createErrorResponse(error, "remove", logger, "location data");
    }
  },
};

const LocationDataModel = (tenant) => {
  try {
    return mongoose.model("locationdatas");
  } catch (error) {
    return getModelByTenant(tenant, "locationdata", LocationDataSchema);
  }
};

module.exports = LocationDataModel;
