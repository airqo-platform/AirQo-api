const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("@utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- clients-model`);

const ClientSchema = new Schema(
  {
    user_id: { type: ObjectId, ref: "user" },
    client_secret: { type: String, trim: true },
    redirect_uri: { type: String },
    description: { type: String },
    rateLimit: { type: Number },
  },
  { timestamps: true }
);

ClientSchema.pre("save", function (next) {
  return next();
});

ClientSchema.pre("findOneAndUpdate", function () {
  let that = this;
  const update = that.getUpdate();
  if (update.__v != null) {
    delete update.__v;
  }
  const keys = ["$set", "$setOnInsert"];
  for (const key of keys) {
    if (update[key] != null && update[key].__v != null) {
      delete update[key].__v;
      if (Object.keys(update[key]).length === 0) {
        delete update[key];
      }
    }
  }
  update.$inc = update.$inc || {};
  update.$inc.__v = 1;
});

ClientSchema.pre("update", function (next) {
  return next();
});

ClientSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "client created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message: "operation successful but client NOT successfully created",
          status: httpStatus.OK,
        };
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else if (err.code === 11000) {
        response["message"] = "the Client must be unique for every client";
      }
      return {
        error: response,
        errors: response,
        message: "validation errors for some of the provided fields",
        success: false,
        status: httpStatus.CONFLICT,
      };
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const inclusionProjection = constants.CLIENTS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.CLIENTS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );
      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the client details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no clients exist",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };

      const updatedClient = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedClient)) {
        return {
          success: true,
          message: "successfully modified the client",
          data: updatedClient._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedClient)) {
        return {
          success: true,
          message: "client does not exist, please crosscheck",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "INTERNAL SERVER ERROR",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 1, client_secret: 1 },
      };
      let removedClient = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedClient)) {
        return {
          success: true,
          message: "successfully removed the client",
          data: removedClient._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedClient)) {
        return {
          success: true,
          message: "client does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "internal server errors",
        error: error.message,
        errors: { message: "internal server errors", error: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

ClientSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      client_secret: this.client_secret,
      redirect_uri: this.redirect_uri,
      description: this.description,
      rateLimit: this.rateLimit,
    };
  },
};

module.exports = ClientSchema;
