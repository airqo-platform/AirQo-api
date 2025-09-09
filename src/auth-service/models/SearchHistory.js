const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-search-history-model`
);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const SearchHistorySchema = new mongoose.Schema(
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

SearchHistorySchema.index(
  { firebase_user_id: 1, date_time: 1 },
  { unique: true }
);

SearchHistorySchema.pre("save", function (next) {
  return next();
});

SearchHistorySchema.pre("update", function (next) {
  return next();
});

SearchHistorySchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "search history", {
          message: "Search History created",
        });
      } else {
        return createEmptySuccessResponse(
          "search history",
          "operation successful but Search History NOT successfully created"
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
          message: "validation errors for some of the provided input",
          status: httpStatus.CONFLICT,
          errors: response,
        };
      } else {
        return createErrorResponse(err, "create", logger, "search history");
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection =
        constants.SEARCH_HISTORIES_INCLUSION_PROJECTION;
      const exclusionProjection =
        constants.SEARCH_HISTORIES_EXCLUSION_PROJECTION(
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

      const search_histories = pipeline;

      return createSuccessResponse("list", search_histories, "search history", {
        message: "successfully listed the Search Histories",
        emptyMessage: "no Search Histories exist",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "search history");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = update;

      const updatedSearchHistory = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedSearchHistory)) {
        return createSuccessResponse(
          "update",
          updatedSearchHistory._doc,
          "search history"
        );
      } else {
        return createNotFoundResponse(
          "search history",
          "update",
          "Search History does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "search history");
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

      const removedSearchHistory = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedSearchHistory)) {
        return createSuccessResponse(
          "delete",
          removedSearchHistory._doc,
          "search history"
        );
      } else {
        return createNotFoundResponse(
          "search history",
          "delete",
          "Search History does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "search history");
    }
  },
};

SearchHistorySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      location: this.location,
      latitude: this.latitude,
      longitude: this.longitude,
      place_id: this.place_id,
      firebase_user_id: this.firebase_user_id,
      date_time: this.date_time,
    };
  },
};

const SearchHistoryModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const searchHistories = mongoose.model("searchHistories");
    return searchHistories;
  } catch (error) {
    const searchHistories = getModelByTenant(
      dbTenant,
      "searchHistory",
      SearchHistorySchema
    );
    return searchHistories;
  }
};

module.exports = SearchHistoryModel;
