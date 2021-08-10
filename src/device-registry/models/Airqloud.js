const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("../utils/log");
const jsonify = require("../utils/jsonify");
const isEmpty = require("is-empty");
const constants = require("../config/constants");
const HTTPStatus = require("http-status");

const polygonSchema = new Schema({
  type: {
    type: String,
    enum: ["Polygon"],
    required: true,
  },
  coordinates: {
    type: [[[Number]]],
    required: true,
  },
});

const airqloudSchema = new Schema(
  {
    location: polygonSchema,
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
    },
    generated_name: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
    },
    airqloud_tags: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

airqloudSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

airqloudSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

airqloudSchema.index({ name: 1 }, { unique: true });

airqloudSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

airqloudSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      generated_name: this.generated_name,
      description: this.description,
      airqloud_tags: this.airqloud_tags,
      location: this.location,
    };
  },
};

airqloudSchema.statics = {
  async register(args) {
    try {
      let createdAirQloud = await this.create({
        ...args,
      });
      let data = jsonify(createdAirQloud);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "airqloud created",
          status: HTTPStatus.OK,
        };
      }
      if (isEmpty(data)) {
        return {
          success: true,
          message: "airqloud not created despite successful operation",
          status: HTTPStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      let response = {};
      logObject("the err", e);
      let error = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        error = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
        error = err.errors;
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        error: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({
    skip = 0,
    limit = constants.DEFAULT_LIMIT_FOR_QUERYING_AIRQLOUDS,
    filter = {},
  } = {}) {
    try {
      let data = this.aggregate()
        .match(filter)
        .lookup({
          from: "sites",
          localField: "_id",
          foreignField: "airqloud_id",
          as: "sites",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          name: 1,
          generated_name: 1,
          description: 1,
          airqloud_tags: 1,
          location: 1,
          sites: "$sites",
        })
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true);

      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully fetched the AirQlouds",
          data,
          status: HTTPStatus.OK,
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "there are no records for this search",
          data,
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      let error = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        error = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      }
      return {
        error,
        message,
        success: false,
        status,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdateBody = update;
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }
      let udpatedUser = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      ).exec();
      let data = jsonify(udpatedUser);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the airqloud",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "airqloud does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      let error = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        error = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      }
      return {
        error,
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
          name: 1,
          generated_name: 1,
          airqloud_tags: 1,
          description: 1,
        },
      };
      let removedAirqloud = await this.findOneAndRemove(filter, options).exec();
      let data = jsonify(removedAirqloud);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the airqloud",
          data,
          status: HTTPStatus.OK,
        };
      }

      if (isEmpty(data)) {
        return {
          success: false,
          message: "airqloud does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      let error = {};
      let message = err.message;
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        error = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      }
      return {
        success: false,
        message,
        error,
        status,
      };
    }
  },
};

module.exports = airqloudSchema;
