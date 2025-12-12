const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.ObjectId;
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-location-history-model`
);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const LocationHistorySchema = new mongoose.Schema(
  {
    place_id: {
      type: String,
      required: [true, "place_id is required"],
    },
    name: {
      type: String,
      trim: true,
      required: [true, "name is required"],
    },
    location: {
      type: String,
      trim: true,
      required: [true, "location is required"],
    },
    latitude: {
      type: Number,
      required: [true, "latitude is required!"],
    },
    longitude: {
      type: Number,
      required: [true, "longitude is required!"],
    },
    reference_site: {
      type: ObjectId,
      trim: true,
    },
    firebase_user_id: {
      type: String,
      trim: true,
      required: [true, "firebase_user_id is required!"],
    },
    date_time: {
      type: Date,
      required: [true, "the date_time is required"],
    },
  },
  { timestamps: true }
);

LocationHistorySchema.index(
  { firebase_user_id: 1, place_id: 1 },
  { unique: true }
);

LocationHistorySchema.pre("save", function (next) {
  return next();
});

LocationHistorySchema.pre("update", function (next) {
  return next();
});

LocationHistorySchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "location history", {
          message: "Location History created",
        });
      } else {
        return createEmptySuccessResponse(
          "location history",
          "operation successful but Location History NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

      // Handle specific duplicate key errors
      if (err.keyValue) {
        let response = {};
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          status: httpStatus.CONFLICT,
          errors: response,
        };
      } else {
        return createErrorResponse(err, "create", logger, "location history");
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      const inclusionProjection =
        constants.LOCATION_HISTORIES_INCLUSION_PROJECTION;
      const exclusionProjection =
        constants.LOCATION_HISTORIES_EXCLUSION_PROJECTION(
          filter.category ? filter.category : "none"
        );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const pipeline = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      const location_histories = pipeline;

      return {
        success: true,
        data: location_histories,
        message: "successfully listed the Location Histories",
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
      return createErrorResponse(error, "list", logger, "location history");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = update;

      const updatedLocationHistory = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedLocationHistory)) {
        return createSuccessResponse(
          "update",
          updatedLocationHistory._doc,
          "location history"
        );
      } else {
        return createNotFoundResponse(
          "location history",
          "update",
          "Location History does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "location history");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          place_id: 1,
          name: 1,
          location: 1,
          latitude: 1,
          longitude: 1,
          firebase_user_id: 1,
          date_time: 1,
        },
      };

      const removedLocationHistory = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedLocationHistory)) {
        return createSuccessResponse(
          "delete",
          removedLocationHistory._doc,
          "location history"
        );
      } else {
        return createNotFoundResponse(
          "location history",
          "delete",
          "Location History does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "location history");
    }
  },
};

LocationHistorySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      location: this.location,
      latitude: this.latitude,
      longitude: this.longitude,
      place_id: this.place_id,
      reference_site: this.reference_site,
      firebase_user_id: this.firebase_user_id,
      date_time: this.date_time,
    };
  },
};

const LocationHistoryModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const locationHistories = mongoose.model("locationHistories");
    return locationHistories;
  } catch (error) {
    const locationHistories = getModelByTenant(
      dbTenant,
      "locationHistory",
      LocationHistorySchema
    );
    return locationHistories;
  }
};

module.exports = LocationHistoryModel;
