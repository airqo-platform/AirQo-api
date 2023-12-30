const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const mongoose = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const { getModelByTenant } = require("@config/database");
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
  }
);

tipsSchema.pre("save", function(next) {
  next();
});

tipsSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

tipsSchema.methods = {
  toJSON() {
    return {
      title: this.title,
      aqi_category: this.aqi_category,
      description: this.description,
      image: this.image,
    };
  },
};

tipsSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new tip....");
      let modifiedArgs = Object.assign({}, args);
      delete modifiedArgs.aqi_category;

      switch (args.aqi_category) {
        case "good":
          modifiedArgs.aqi_category = { min: 0, max: 12.09 };
          break;
        case "moderate":
          modifiedArgs.aqi_category = { min: 12.1, max: 35.49 };
          break;
        case "u4sg":
          modifiedArgs.aqi_category = { min: 35.5, max: 55.49 };
          break;
        case "unhealthy":
          modifiedArgs.aqi_category = { min: 55.5, max: 150.49 };
          break;
        case "very_unhealthy":
          modifiedArgs.aqi_category = { min: 150.5, max: 250.49 };
          break;
        case "hazardous":
          modifiedArgs.aqi_category = { min: 250.5, max: 500 };
          break;
        default:
      }
      const createdTip = await this.create({ ...modifiedArgs });
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
      logObject("the filter in the model", filter);
      logObject("the update in the model", update);
      logObject("the opts in the model", opts);
      let modifiedUpdateBody = Object.assign({}, update);
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }

      delete modifiedUpdateBody.aqi_category;

      switch (update.aqi_category) {
        case "good":
          modifiedUpdateBody.aqi_category = { min: 0, max: 12.09 };
          break;
        case "moderate":
          modifiedUpdateBody.aqi_category = { min: 12.1, max: 35.49 };
          break;
        case "u4sg":
          modifiedUpdateBody.aqi_category = { min: 35.5, max: 55.49 };
          break;
        case "unhealthy":
          modifiedUpdateBody.aqi_category = { min: 55.5, max: 150.49 };
          break;
        case "very_unhealthy":
          modifiedUpdateBody.aqi_category = { min: 150.5, max: 250.49 };
          break;
        case "hazardous":
          modifiedUpdateBody.aqi_category = { min: 250.5, max: 500 };
          break;
        default:
      }

      let options = opts;
      let keys = {};
      const setProjection = (object) => {
        Object.keys(object).forEach((element) => {
          keys[element] = 1;
        });
        return keys;
      };
      logObject("the new modifiedUpdateBody", modifiedUpdateBody);

      const updatedTip = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedTip", updatedTip);
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
  try {
    const healthtips = mongoose.model("healthtips");
    return healthtips;
  } catch (error) {
    const healthtips = getModelByTenant(tenant, "healthtip", tipsSchema);
    return healthtips;
  }
};

module.exports = TipsModel;
