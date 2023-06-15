const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;

const FavoriteSchema = new mongoose.Schema(
  {
    place_id: {
      type: String,
      required: [true, "place_id is required"],
      unique: true,
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
    user_id: {
      type: ObjectId,
      trim: true,
      ref: "user",
      required: [true, "user_id is required!"],
    },
  },
  { timestamps: true }
);

FavoriteSchema.pre("save", function (next) {
  return next();
});

FavoriteSchema.pre("update", function (next) {
  return next();
});

FavoriteSchema.index({ place_id: 1 }, { unique: true });

FavoriteSchema.statics = {
  async register(args) {
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
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }
      return {
        success: false,
        error: response,
        errors: response,
        message: "validation errors for some of the provided fields",
        status: httpStatus.CONFLICT,
      };
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      let favorites = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .lookup({
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "users",
        })
        .project({
          _id: 1,
          name: 1,
          location: 1,
          latitude: 1,
          longitude: 1,
          reference_site: 1,
          place_id: 1,
          user: { $arrayElemAt: ["$users", 0] },
        })
        .project({
          "network.__v": 0,
          "network.createdAt": 0,
          "network.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);
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
      return {
        success: false,
        message: "internal server error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
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
        return {
          success: false,
          message: "Favorite does not exist, please crosscheck",
          errors: { message: "Favorite does not exist, please crosscheck" },
          status: httpStatus.BAD_REQUEST,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      const options = {
        projection: { _id: 0, place_id: 1, name: 1, location: 1 },
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
        return {
          success: false,
          message: "Favorite does not exist, please crosscheck",
          errors: { message: "Favorite does not exist, please crosscheck" },
          status: httpStatus.BAD_REQUEST,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
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
    };
  },
};

module.exports = FavoriteSchema;
