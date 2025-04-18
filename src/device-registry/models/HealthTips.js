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

tipsSchema.statics = {
  async bulkModify(updates, next) {
    try {
      logText("bulk updating tips....");
      let updatedCount = 0;
      const bulkOps = [];

      for (const update of updates) {
        const { aqi_category, tips } = update;
        const { min, max } = aqi_category;

        const filter = {
          "aqi_category.min": { $lte: max },
          "aqi_category.max": { $gte: min },
        };

        // Create update operations for each tip in the array
        for (const tip of tips) {
          bulkOps.push({
            updateOne: {
              filter,
              update: { $set: tip }, // Update with the specific tip data
            },
          });
        }
      }

      if (bulkOps.length > 0) {
        const result = await this.bulkWrite(bulkOps);
        updatedCount = result.modifiedCount;
      }

      return {
        success: true,
        message: `Successfully updated ${updatedCount} tips`,
        data: { updatedCount },
        status: httpStatus.OK,
      };
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
