const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const mongoose = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logObject, logText, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- health-tip-model`);

const aqiRangeSchema = new Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  { _id: false }
);

const tipsSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "the title is required!"],
    },
    tag_line: {
      type: String,
      required: [true, "the tag_line is required!"],
    },
    description: {
      required: [true, "the description is required!"],
      type: String,
      trim: true,
    },
    image: {
      required: [true, "the image is required!"],
      type: String,
      trim: true,
    },
    aqi_category: {
      type: aqiRangeSchema,
      required: [true, "the aqi_category is required!"],
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        fields: { title: 1, aqi_category: 1 },
        unique: true,
      },
    ],
  }
);

tipsSchema.pre("save", function(next) {
  if (!this.tag_line && this.aqi_category) {
    // Set default tag_line based on AQI category if missing
    const DEFAULT_TAG_LINES = {
      "0-9.1": "Today is a great day for outdoor activity.",
      "9.101-35.49": "The air quality today is moderate.",
      "35.491-55.49": "The air quality is unhealthy for sensitive people.",
      "55.491-125.49": "The air quality today might irritate your lungs.",
      "125.491-225.49": "The air quality is reaching levels of high alert.",
      "225.491-null": "The air quality can cause a health emergency.",
    };

    const key =
      this.aqi_category.max === null
        ? `${this.aqi_category.min}-null`
        : `${this.aqi_category.min}-${this.aqi_category.max}`;

    this.tag_line =
      DEFAULT_TAG_LINES[key] || "Air quality information available.";
  }
  next();
});

tipsSchema.plugin(uniqueValidator, {
  message: `A health tip with the title '{VALUE}' and this aqi_category already exists!`,
});

tipsSchema.methods = {
  toJSON() {
    return {
      title: this.title,
      tag_line: this.tag_line,
      aqi_category: this.aqi_category,
      description: this.description,
      image: this.image,
    };
  },
};

const _removeInvalidTips = async function(model) {
  // Get valid AQI ranges from the configuration
  const validAqiRanges = Object.values(constants.AQI_INDEX);

  // Build a query to find all tips with invalid AQI ranges
  const validRangeFilters = validAqiRanges.map((range) => {
    const filter = {
      "aqi_category.min": range.min,
    };

    // Handle null max value for hazardous range
    if (range.max === null) {
      filter["aqi_category.max"] = null;
    } else {
      filter["aqi_category.max"] = range.max;
    }

    return filter;
  });

  // Find tips that don't match any valid range
  const invalidTips = await model
    .find({
      $nor: validRangeFilters,
    })
    .exec();

  // Delete the invalid tips
  let deleteResult = { deletedCount: 0 };
  if (invalidTips.length > 0) {
    deleteResult = await model
      .deleteMany({
        $nor: validRangeFilters,
      })
      .exec();
  }

  // Find AQI categories without tips
  const categoriesWithoutTips = [];
  for (const range of validAqiRanges) {
    const filter = {
      "aqi_category.min": range.min,
    };

    if (range.max === null) {
      filter["aqi_category.max"] = null;
    } else {
      filter["aqi_category.max"] = range.max;
    }

    const count = await model.countDocuments(filter).exec();
    if (count === 0) {
      categoriesWithoutTips.push({
        min: range.min,
        max: range.max,
      });
    }
  }

  return {
    removedCount: deleteResult.deletedCount,
    invalidTipsRemoved: invalidTips.map((tip) => ({
      title: tip.title,
      aqi_category: tip.aqi_category,
    })),
    categoriesWithoutTips,
  };
};

tipsSchema.statics = {
  async bulkModify(updates, next) {
    try {
      logText("bulk updating tips....");
      let updatedCount = 0;
      const bulkOps = [];

      for (const update of updates) {
        const { aqi_category, tips } = update;
        const { min, max } = aqi_category;

        // Create filter for matching tips by AQI range
        const filter = {
          "aqi_category.min": min,
          "aqi_category.max": max,
        };

        // Process each tip in the array
        for (const tip of tips) {
          if (!tip.title) {
            // If no title is provided, update all tips in this AQI range
            bulkOps.push({
              updateMany: {
                filter,
                update: { $set: tip },
              },
            });
          } else {
            // If title is provided, target that specific tip
            bulkOps.push({
              updateOne: {
                filter: { ...filter, title: tip.title },
                update: { $set: tip },
                upsert: true, // Create if doesn't exist
              },
            });
          }
        }

        // NEW: Add operation to update any remaining tips in this AQI range that don't have tag_line
        // This handles legacy tips that might not be explicitly mentioned in the request
        if (tips.length > 0 && tips[0].tag_line) {
          bulkOps.push({
            updateMany: {
              filter: {
                ...filter,
                $or: [
                  { tag_line: { $exists: false } },
                  { tag_line: null },
                  { tag_line: "" },
                ],
              },
              update: {
                $set: {
                  tag_line: tips[0].tag_line, // Use the first tip's tag_line as default
                },
              },
            },
          });
        }
      }

      if (bulkOps.length > 0) {
        const result = await this.bulkWrite(bulkOps);
        updatedCount = result.modifiedCount + (result.upsertedCount || 0);
      }

      // Call the private helper function to remove invalid tips
      const { removedCount } = await _removeInvalidTips(this);

      return {
        success: true,
        message: `Successfully updated ${updatedCount} tips and removed ${removedCount} invalid tips`,
        data: { updatedCount, removedCount },
        status: httpStatus.OK,
      };
    } catch (error) {
      // Original error handling code remains unchanged
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;

      if (!isEmpty(error.code) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      } else {
        response["message"] = error.message;
      }

      next(new HttpError(message, status, response));
    }
  },

  async removeInvalidTips(next) {
    try {
      logText("removing invalid health tips....");

      // Call the private helper function to remove invalid tips
      const result = await _removeInvalidTips(this);

      return {
        success: true,
        message: `Successfully removed ${result.removedCount} invalid tips`,
        data: result,
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "Error removing invalid health tips";
      let status = httpStatus.INTERNAL_SERVER_ERROR;

      response["message"] = error.message;
      next(new HttpError(message, status, response));
    }
  },
  async register(args, next) {
    try {
      logText("registering a new tip....");
      const createdTip = await this.create({ ...args });
      if (!isEmpty(createdTip)) {
        return {
          success: true,
          data: createdTip._doc,
          message: "tip created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdTip)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "tip not created despite successful operation",
            }
          )
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.keyPattern) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response.message = value.message;
          response[key] = value.message;
          return response;
        });
      }

      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      let response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          title: 1,
          tag_line: 1,
          aqi_category: 1,
          description: 1,
          image: 1,
        })
        .skip(skip ? skip : 0)
        .limit(
          limit ? limit : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_TIPS)
        )
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        logObject("response", response);
        return {
          success: true,
          message: "successfully retrieved the tip(s)",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No tips found for this operation",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = { message: error.message };
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (error.code === 11000) {
        if (!isEmpty(error.keyPattern)) {
          Object.entries(error.keyPattern).forEach(([key, value]) => {
            response["message"] = "duplicate value";
            response[key] = "duplicate value";
            return response;
          });
        } else {
          response.message = "duplicate value";
        }
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }

      next(new HttpError(message, status, response));
    }
  },
  async modify({ filter = {}, update = {}, opts = { new: true } } = {}, next) {
    try {
      const updatedTip = await this.findOneAndUpdate(filter, update, opts);
      if (!isEmpty(updatedTip)) {
        return {
          success: true,
          message: "successfully modified the tip",
          data: updatedTip._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedTip)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No tips found for this operation",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.code) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }

      next(new HttpError(message, status, response));
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: {
          _id: 1,
          title: 1,
          tag_line: 1,
          aqi_category: 1,
          description: 1,
          image: 1,
        },
      };
      const removedTip = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedTip)) {
        return {
          success: true,
          message: "successfully removed the tip",
          data: removedTip._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedTip)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No tips found for this operation",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.code) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }

      next(new HttpError(message, status, response));
    }
  },
};

const TipsModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const healthtips = mongoose.model("healthtips");
    return healthtips;
  } catch (error) {
    const healthtips = getModelByTenant(dbTenant, "healthtip", tipsSchema);
    return healthtips;
  }
};

module.exports = TipsModel;
