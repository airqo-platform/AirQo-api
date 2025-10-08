const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const ObjectId = mongoose.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- clients-model`);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const ClientSchema = new Schema(
  {
    user_id: {
      type: ObjectId,
      ref: "user",
      required: [true, "user_id is required!"],
    },
    name: { type: String, trim: true, required: [true, "name is required!"] },
    client_secret: { type: String, trim: true },
    isActive: { type: Boolean, default: false },
    redirect_uri: { type: String },
    ip_address: { type: String },
    ip_addresses: [{ type: String }],
    description: { type: String },
    rateLimit: { type: Number },
  },
  { timestamps: true }
);

ClientSchema.pre("save", function (next) {
  const fieldsToAddToSet = ["ip_addresses"];

  fieldsToAddToSet.forEach((field) => {
    if (this[field]) {
      this[field] = Array.from(new Set(this[field].map((id) => id.toString())));
    }
  });
  return next();
});

ClientSchema.pre("update", function (next) {
  return next();
});

ClientSchema.statics = {
  async register(args, next) {
    try {
      let createBody = args;

      // Remove _id if present
      if (createBody._id) {
        delete createBody._id;
      }

      const data = await this.create({
        // Fixed: was undeclared variable
        ...createBody,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "client", {
          message: "client created",
        });
      } else {
        return createEmptySuccessResponse(
          "client",
          "operation successful but client NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err); // Preserve custom logging
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);

      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;

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
      } else {
        message = "Internal Server Error";
        status = httpStatus.INTERNAL_SERVER_ERROR;
        response = { message: err.message };
      }

      return {
        success: false,
        message,
        status,
        errors: response,
      };
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
        .lookup({
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "client", {
        message: "successfully retrieved the client details",
        emptyMessage: "no clients exist",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "client");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      // Preserve unique removeDuplicates function for IP addresses
      function removeDuplicates(arr) {
        return [...new Set(arr)];
      }

      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);

      // Preserve IP address deduplication logic
      if (modifiedUpdate.ip_addresses) {
        modifiedUpdate.ip_addresses = removeDuplicates(
          modifiedUpdate.ip_addresses
        );
      }

      const updatedClient = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedClient)) {
        return createSuccessResponse("update", updatedClient._doc, "client");
      } else {
        return createNotFoundResponse(
          "client",
          "update",
          "client does not exist, please crosscheck"
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);

      let response = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;

      if (error.code === 11000 || error.code === 11001) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        if (error.keyValue) {
          Object.entries(error.keyValue).forEach(([key, value]) => {
            return (response[key] = `the ${key} must be unique`);
          });
        }
      } else if (error.errors) {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        Object.entries(error.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else {
        response = { message: error.message };
      }

      return {
        success: false,
        message,
        status,
        errors: response,
      };
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: { _id: 1, client_secret: 1 }, // Preserve client_secret projection
      };

      const removedClient = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedClient)) {
        return createSuccessResponse("delete", removedClient._doc, "client");
      } else {
        return createNotFoundResponse(
          "client",
          "delete",
          "client does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "client");
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
      isActive: this.isActive,
      description: this.description,
      rateLimit: this.rateLimit,
      ip_address: this.ip_address,
      ip_addresses: this.ip_addresses,
    };
  },
};

const ClientModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  return getModelByTenant(dbTenant, "client", ClientSchema);
};

module.exports = ClientModel;
