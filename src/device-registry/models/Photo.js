const { Schema } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const mongoose = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logElement, logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- photo-model`);

const photoSchema = new Schema(
  {
    device_name: { type: String },
    network: {
      type: String,
      trim: true,
    },
    group: {
      type: String,
      trim: true,
    },
    device_id: {
      type: ObjectId,
    },
    site_id: { type: ObjectId, unique: true },
    airqloud_id: { type: ObjectId, unique: true },
    device_number: {},
    image_url: {
      type: String,
      required: [true, "the image_url is required!"],
    },
    image_code: {
      type: String,
      required: [true, "the code is required!"],
    },
    description: {
      type: String,
    },
    tags: [{ type: String }],
    metadata: {
      public_id: {
        type: String,
        required: [true, "the metadata public_id is required!"],
      },
      version: { type: Number },
      signature: { type: String },
      width: { type: Number },
      height: { type: Number },
      format: { type: String },
      resource_type: { type: String },
      created_at: { type: Date },
      bytes: { type: Number },
      type: { type: String },
      url: {
        type: String,
        required: [true, "the metadata url is required!"],
      },
      secure_url: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

photoSchema.pre("save", function(next) {
  next();
});

photoSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

photoSchema.methods = {
  toJSON() {
    return {
      image_url: this.image_url,
      metadata: this.metadata,
      id: this._id,
      tags: this.tags,
      name: this.name,
      network: this.network,
      group: this.group,
      image_url: this.image_url,
      device_id: this.device_id,
      site_id: this.site_id,
      airqloud_id: this.airqloud_id,
      device_name: this.device_name,
      image_code: this.image_code,
      description: this.description,
      metadata: this.metadata,
    };
  },
};

photoSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new photo....");
      let modifiedArgs = Object.assign({}, args);
      const createdPhoto = await this.create({ ...modifiedArgs });
      if (!isEmpty(createdPhoto)) {
        return {
          success: true,
          data: createdPhoto._doc,
          message: "photo created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdPhoto)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "photo not created despite successful operation",
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
          tags: 1,
          name: 1,
          image_url: 1,
          device_id: 1,
          device_name: 1,
          image_code: 1,
          description: 1,
          metadata: 1,
          network: 1,
          group: 1,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 1000)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        logObject("response", response);
        return {
          success: true,
          message: "successfully retrieved the photo(s)",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No images found for this operation",
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

      modifiedUpdateBody["$addToSet"] = {};
      if (modifiedUpdateBody.tags) {
        modifiedUpdateBody["$addToSet"]["tags"] = {};
        modifiedUpdateBody["$addToSet"]["tags"]["$each"] =
          modifiedUpdateBody.tags;
        delete modifiedUpdateBody["tags"];
      }

      const updatedPhoto = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedPhoto", updatedPhoto);
      if (!isEmpty(updatedPhoto)) {
        return {
          success: true,
          message: "successfully modified the photo",
          data: updatedPhoto._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedPhoto)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No images found for this operation",
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
          device_id: 1,
          device_number: 1,
          device_name: 1,
          network: 1,
          image_code: 1,
          image_url: 1,
        },
      };
      const removedPhoto = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedPhoto)) {
        return {
          success: true,
          message: "successfully removed the photo",
          data: removedPhoto._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedPhoto)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No images found for this operation",
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

const PhotoModel = (tenant) => {
  try {
    const photos = mongoose.model("photos");
    return photos;
  } catch (error) {
    const photos = getModelByTenant(tenant, "photo", photoSchema);
    return photos;
  }
};

module.exports = PhotoModel;
