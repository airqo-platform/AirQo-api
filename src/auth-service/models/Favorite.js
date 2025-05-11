const mongoose = require("mongoose").set("debug", true);
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-favorite-model`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const FavoriteSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

FavoriteSchema.index({ place_id: 1, firebase_user_id: 1 }, { unique: true });

FavoriteSchema.pre("save", function (next) {
  return next();
});

FavoriteSchema.pre("update", function (next) {
  return next();
});

FavoriteSchema.statics = {
  async register(args, next) {
    try {
      data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Favorite created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message: "operation successful but Favorite NOT successfully created",
          status: httpStatus.ACCEPTED,
        };
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${JSON.stringify(err)}`);
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(
        new HttpError(
          "validation errors for some of the provided fields",
          httpStatus.CONFLICT,
          response
        )
      );
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.FAVORITES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.FAVORITES_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      let pipeline = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      const favorites = pipeline;
      if (!isEmpty(favorites)) {
        return {
          success: true,
          data: favorites,
          message: "successfully listed the favorites",
          status: httpStatus.OK,
        };
      } else if (isEmpty(favorites)) {
        return {
          success: true,
          message: "no favorites exist",
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
      let options = { new: true };
      let modifiedUpdate = update;

      const updatedFavorite = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedFavorite)) {
        return {
          success: true,
          message: "successfully modified the Favorite",
          data: updatedFavorite._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedFavorite)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Favorite does not exist, please crosscheck",
          })
        );
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
        },
      };
      const removedFavorite = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedFavorite)) {
        return {
          success: true,
          message: "successfully removed the Favorite",
          data: removedFavorite._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedFavorite)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Favorite does not exist, please crosscheck",
          })
        );
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
  syncFavorites: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant, favorite_places, firebase_user_id } = {
        ...body,
        ...query,
        ...params,
      };

      let responseFromCreateFavorite = {
        success: true,
        data: [],
        message: "No missing favorite places",
      };
      let responseFromDeleteFavorite = {
        success: true,
        data: [],
        message: "No extra favorite places",
      };

      let filter = {
        firebase_user_id: firebase_user_id,
      };

      let unsynced_favorite_places = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

      unsynced_favorite_places = unsynced_favorite_places.map(
        ({ _id, ...rest }) => rest
      );

      // Handle empty favorite_places
      if (favorite_places.length === 0) {
        for (let favorite of unsynced_favorite_places) {
          responseFromDeleteFavorite = await FavoriteModel(
            tenant.toLowerCase()
          ).remove(
            {
              filter: favorite,
            },
            next
          );
        }

        return {
          success: true,
          message: "No favorite places to sync",
          data: [],
        };
      }

      // Find missing favorites
      const missing_favorite_places = favorite_places.filter((item) => {
        const found = unsynced_favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            favorite.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      // Create missing favorites with proper duplicate handling
      if (missing_favorite_places.length > 0) {
        for (let favorite of missing_favorite_places) {
          try {
            // Check if favorite already exists
            const existingFavorite = await FavoriteModel(
              tenant.toLowerCase()
            ).findOne({
              firebase_user_id: favorite.firebase_user_id,
              place_id: favorite.place_id,
            });

            if (!existingFavorite) {
              responseFromCreateFavorite = await FavoriteModel(
                tenant.toLowerCase()
              ).register(favorite, next);
              logObject(
                "responseFromCreateFavorite",
                responseFromCreateFavorite
              );
            }
          } catch (error) {
            // Handle duplicate key error gracefully
            if (error.code === 11000) {
              logger.info(
                `Favorite already exists for place_id: ${favorite.place_id}, firebase_user_id: ${favorite.firebase_user_id}`
              );
              continue; // Skip to next iteration
            } else {
              throw error; // Re-throw if it's not a duplicate key error
            }
          }
        }
      }

      // Find extra favorites
      const extra_favorite_places = unsynced_favorite_places.filter((item) => {
        const found = favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            favorite.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      // Delete extra favorites
      if (extra_favorite_places.length > 0) {
        for (let favorite of extra_favorite_places) {
          let filter = {
            firebase_user_id: favorite.firebase_user_id,
            place_id: favorite.place_id,
          };
          responseFromDeleteFavorite = await FavoriteModel(
            tenant.toLowerCase()
          ).remove(
            {
              filter,
            },
            next
          );
        }
      }

      // Get synchronized favorites
      let synchronizedFavorites = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

      if (
        responseFromCreateFavorite &&
        responseFromDeleteFavorite &&
        responseFromCreateFavorite.success === false &&
        responseFromDeleteFavorite.success === false
      ) {
        next(
          new HttpError(
            "Error Synchronizing favorites",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Response from Create Favorite: ${
                responseFromCreateFavorite?.errors?.message || "Unknown error"
              }
             + Response from Delete Favorite: ${
               responseFromDeleteFavorite?.errors?.message || "Unknown error"
             }`,
            }
          )
        );
      }

      return {
        success: true,
        message: "Favorites Synchronized",
        data: synchronizedFavorites,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async upsert(args, next) {
    try {
      const { place_id, firebase_user_id, ...updateData } = args;

      const existing = await this.findOne({ place_id, firebase_user_id });

      if (existing) {
        // Update existing favorite
        return this.modify(
          {
            filter: { _id: existing._id },
            update: args,
          },
          next
        );
      }

      // Create new favorite if doesn't exist
      return this.register(args, next);
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error -- ${JSON.stringify(err)}`);

      // Handle specific MongoDB errors
      if (err.code === 11000) {
        // Handle race condition where record was created between find and create
        const existing = await this.findOne({ place_id, firebase_user_id });
        if (existing) {
          return this.modify(
            {
              filter: { _id: existing._id },
              update: args,
            },
            next
          );
        }
      }

      // For other errors, use the standard error handling
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: err.message }
        )
      );
    }
  },
};

FavoriteSchema.methods = {
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
    };
  },
};

const FavoriteModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let favorites = mongoose.model("favorites");
    return favorites;
  } catch (error) {
    let favorites = getModelByTenant(dbTenant, "favorite", FavoriteSchema);
    return favorites;
  }
};

module.exports = FavoriteModel;
