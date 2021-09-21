const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const mongoose = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logElement, logObject, logText } = require("../utils/log");
const jsonify = require("../utils/jsonify");
const isEmpty = require("is-empty");
const constants = require("../config/constants");
const HTTPStatus = require("http-status");

const photoSchema = new Schema(
  {
    device_name: { type: String },
    device_id: {
      type: ObjectId,
      required: [true, "the object ID is required!"],
    },
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
    cloudinary: {
      public_id: {
        type: String,
        required: [true, "the cloudinary public_id is required!"],
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
        required: [true, "the cloudinary url is required!"],
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
      img: this.img,
    };
  },
};

photoSchema.statics = {
  async register(args) {
    try {
      logText("registering a new photo....");
      let modifiedArgs = args;
      let createdPhoto = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(createdPhoto)) {
        const data = createdPhoto._doc;
        logObject("data", data);
        return {
          success: true,
          data,
          message: "photo created",
          status: HTTPStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "photo not create despite successful operation",
          status: HTTPStatus.ACCEPTED,
          data,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      logObject("the error", e);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (e.code === 11000) {
        Object.entries(e.keyPattern).forEach(([key, value]) => {
          return (response[key] = "duplicate value");
        });
      } else {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
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
  async list({
    _skip = 0,
    _limit = parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_PHOTOS),
    filter = {},
  } = {}) {
    try {
      let response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "devices",
          localField: "device_id",
          foreignField: "_id",
          as: "device",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          tags: 1,
          name: 1,
          image_url: 1,
          description: 1,
          device: { $arrayElemAt: ["$device", 0] },
        })
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        let data = jsonify(response);
        return {
          success: true,
          message: "successfully retrieved the photo details",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "this photo does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: filter,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      logObject("the error", e);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (e.code === 11000) {
        Object.entries(e.keyPattern).forEach(([key, value]) => {
          return (response[key] = "duplicate value");
        });
      } else {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
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
        for (let k in object) {
          keys[k] = 1;
          return keys;
        }
      };
      projection = setProjection(modifiedUpdateBody);
      options["projection"] = projection;
      let updatedPhoto = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedPhoto", updatedPhoto);
      if (!isEmpty(updatedPhoto)) {
        let data = updatedPhoto._doc;
        logObject("the updated data", data);
        return {
          success: true,
          message: "successfully modified the photo",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "this photo does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: filter,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      logObject("the error", e);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (e.code === 11000) {
        Object.entries(e.keyPattern).forEach(([key, value]) => {
          return (response[key] = "duplicate value");
        });
      } else {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
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
          device_id: 1,
          device_number: 1,
          device_name: 1,
          image_code: 1,
          image_url: 1,
        },
      };
      let removedPhoto = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedPhoto)) {
        let data = jsonify(removedPhoto._doc);
        logObject("the removed photo data", data);
        return {
          success: true,
          message: "successfully removed the photo",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "this photo does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: filter,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      logObject("the error", e);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (e.code === 11000) {
        Object.entries(e.keyPattern).forEach(([key, value]) => {
          return (response[key] = "duplicate value");
        });
      } else {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
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

module.exports = photoSchema;
