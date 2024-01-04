const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const { logObject } = require("@utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- clients-model`);
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");

const ClientSchema = new Schema(
  {
    user_id: {
      type: ObjectId,
      ref: "user",
      required: [true, "user_id is required!"],
    },
    name: { type: String, trim: true, required: [true, "name is required!"] },
    client_secret: { type: String, trim: true },
    redirect_uri: { type: String },
    ip_address: { type: String },
    description: { type: String },
    rateLimit: { type: Number },
  },
  { timestamps: true }
);

ClientSchema.pre("save", function (next) {
  return next();
});

ClientSchema.pre("update", function (next) {
  return next();
});

ClientSchema.statics = {
  async register(args, next) {
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
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
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
      const inclusionProjection = constants.CLIENTS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.CLIENTS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );
      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "access_tokens",
          localField: "_id",
          foreignField: "client_id",
          as: "access_token",
        })
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
  async modify({ filter = {}, update = {} } = {}, next) {
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "client does not exist, please crosscheck",
          })
        );
      }
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
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: { _id: 1, client_secret: 1 },
      };
      const removedClient = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedClient)) {
        return {
          success: true,
          message: "successfully removed the client",
          data: removedClient._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedClient)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "client does not exist, please crosscheck",
          })
        );
      }
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
};

ClientSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      client_secret: this.client_secret,
      redirect_uri: this.redirect_uri,
      name: this.name,
      description: this.description,
      rateLimit: this.rateLimit,
      ip_address: this.ip_address,
    };
  },
};

const ClientModel = (tenant) => {
  try {
    let clients = mongoose.model("clients");
    return clients;
  } catch (error) {
    let clients = getModelByTenant(tenant, "client", ClientSchema);
    return clients;
  }
};

module.exports = ClientModel;
