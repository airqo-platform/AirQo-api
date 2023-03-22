const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const mongoose = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logElement, logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const HTTPStatus = require("http-status");

/**
 * we need to have a field
 * that maps the air quality reading (NOT CATEGORY) to a health tip
 */
const aqiRangeSchema = new Schema({
  min: { type: Number, required: true },
  max: { type: Number, required: true },
});

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
    };
  },
};

tipsSchema.statics = {
  async register(args) {
    try {
      logText("registering a new tip....");
      let modifiedArgs = Object.assign({}, args);
      delete modifiedArgs.aqi_category;

      switch (args.aqi_category) {
        case "good":
          modifiedArgs.aqi_category = { min: 0, max: 50 };
          break;
        case "moderate":
          modifiedArgs.aqi_category = { min: 51, max: 100 };
          break;
        case "u4sg":
          modifiedArgs.aqi_category = { min: 101, max: 150 };
          break;
        case "unhealthy":
          modifiedArgs.aqi_category = { min: 151, max: 200 };
          break;
        case "very_unhealthy":
          modifiedArgs.aqi_category = { min: 201, max: 300 };
          break;
        case "hazardous":
          modifiedArgs.aqi_category = { min: 301, max: 500 };
          break;
        default:
        // code block
      }
      const createdTip = await this.create({ ...modifiedArgs });
      if (!isEmpty(createdTip)) {
        return {
          success: true,
          data: createdTip._doc,
          message: "tip created",
          status: HTTPStatus.CREATED,
        };
      } else if (isEmpty(createdTip)) {
        return {
          success: false,
          message: "tip not created despite successful operation",
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "tip not created despite successful operation" },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (!isEmpty(err.keyPattern) && err.code === 11000) {
        Object.entries(err.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response.message = value.message;
          response[key] = value.message;
          return response;
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}) {
    try {
      let response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          title: 1,
          aqi_category: 1,
          description: 1,
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
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No tips found for this operation",
          status: HTTPStatus.OK,
          data: [],
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = { message: err.message };
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (err.code === 11000) {
        if (!isEmpty(err.keyPattern)) {
          Object.entries(err.keyPattern).forEach(([key, value]) => {
            response["message"] = "duplicate value";
            response[key] = "duplicate value";
            return response;
          });
        } else {
          response.message = "duplicate value";
        }
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async modify({ filter = {}, update = {}, opts = { new: true } } = {}) {
    try {
      logObject("the filter in the model", filter);
      logObject("the update in the model", update);
      logObject("the opts in the model", opts);
      let modifiedUpdateBody = update;
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }
      let options = opts;
      let keys = {};
      const setProjection = (object) => {
        Object.keys(object).forEach((element) => {
          keys[element] = 1;
        });
        return keys;
      };
      logObject("modifiedUpdateBody", modifiedUpdateBody);
      const projection = setProjection(modifiedUpdateBody);
      logObject("projection", projection);
      options["projection"] = projection;
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
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(updatedTip)) {
        return {
          success: false,
          message: "No tips found for this operation",
          status: HTTPStatus.BAD_REQUEST,
          errors: { message: "No tips found for this operation" },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (!isEmpty(err.code) && err.code === 11000) {
        Object.entries(err.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          title: 1,
          aqi_category: 1,
          description: 1,
        },
      };
      const removedPhoto = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedPhoto)) {
        return {
          success: true,
          message: "successfully removed the tip",
          data: removedPhoto._doc,
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(removedPhoto)) {
        return {
          success: false,
          message: "No tips found for this operation",
          status: HTTPStatus.BAD_REQUEST,
          errors: { message: "No tips found for this operation" },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (!isEmpty(err.code) && err.code === 11000) {
        Object.entries(err.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
};

module.exports = tipsSchema;
