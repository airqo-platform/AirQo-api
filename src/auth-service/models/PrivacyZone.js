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
  `${constants.ENVIRONMENT} -- privacy-zone-model`
);

const PrivacyZoneSchema = new Schema(
  {
    userId: {
      type: ObjectId,
      ref: "user",
      required: [true, "User ID is required"],
    },
    name: {
      type: String,
      required: [true, "Privacy zone name is required"],
      trim: true,
    },
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: -180,
      max: 180,
    },
    radius: {
      type: Number,
      required: [true, "Radius is required"],
      min: [1, "Radius must be at least 1 meter"],
    },
  },
  { timestamps: true }
);

PrivacyZoneSchema.index({ userId: 1, name: 1 }, { unique: true });

PrivacyZoneSchema.statics = {
  async register(args) {
    try {
      const data = await this.create({ ...args });
      return createSuccessResponse("create", data, "privacy zone");
    } catch (error) {
      logger.error(`Error on register privacy zone: ${error.message}`);
      return createErrorResponse(error, "register", logger, "privacy zone");
    }
  },

  async list({ filter = {}, skip = 0, limit = 1000 } = {}) {
    try {
      const privacyZones = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      const totalCount = await this.countDocuments(filter);

      return {
        success: true,
        data: privacyZones,
        message: "successfully listed the privacy zones",
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
      logger.error(`Error on list privacy zones: ${error.message}`);
      return createErrorResponse(error, "list", logger, "privacy zone");
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      const updatedZone = await this.findOneAndUpdate(filter, update, options);
      if (!updatedZone) {
        return createNotFoundResponse("privacy zone", "update");
      }
      return createSuccessResponse("update", updatedZone, "privacy zone");
    } catch (error) {
      logger.error(`Error on modify privacy zone: ${error.message}`);
      return createErrorResponse(error, "modify", logger, "privacy zone");
    }
  },

  async remove({ filter = {} } = {}) {
    try {
      const removedZone = await this.findOneAndRemove(filter);
      if (!removedZone) {
        return createNotFoundResponse("privacy zone", "delete");
      }
      return createSuccessResponse("delete", removedZone, "privacy zone");
    } catch (error) {
      logger.error(`Error on remove privacy zone: ${error.message}`);
      return createErrorResponse(error, "remove", logger, "privacy zone");
    }
  },
};

const PrivacyZoneModel = (tenant) => {
  try {
    return mongoose.model("privacyzones");
  } catch (error) {
    return getModelByTenant(tenant, "privacyzone", PrivacyZoneSchema);
  }
};

module.exports = PrivacyZoneModel;
