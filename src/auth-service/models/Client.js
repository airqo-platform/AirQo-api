const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const { logObject, logElement, logText } = require("@utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");

const ClientSchema = new Schema(
  {
    client_id: {
      type: String,
      required: [true, "client is required!"],
      trim: true,
      unique: true,
    },
    client_secret: {
      type: String,
      required: [true, "client_secret is required!"],
      trim: true,
    },
    name: {
      type: String,
      required: [true, "client is required!"],
      trim: true,
    },
    redirect_uri: {
      type: String,
    },
    networks: [
      {
        type: ObjectId,
        ref: "network",
      },
    ],
    description: { type: String },
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

ClientSchema.index({ client_id: 1 }, { unique: true });

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
        const duplicate_record = args.client_id
          ? args.client_id
          : args.client_id;
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] = "the client_id must be unique for every client";
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
      logText("we are inside the model/collection....");
      const projectAll = {
        _id: 1,
        client_id: 1,
        client_secret: 1,
        redirect_uri: 1,
        name: 1,
        description: 1,
        networks: "$networks",
      };

      const projectSummary = {};

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "networks",
          localField: "_id",
          foreignField: "net_clients",
          as: "networks",
        })
        .sort({ createdAt: -1 })
        .project(projectAll)
        .project({
          "networks.__v": 0,
          "networks.net_status": 0,
          "networks.net_acronym": 0,
          "networks.createdAt": 0,
          "networks.updatedAt": 0,
          "networks.net_clients": 0,
          "networks.net_roles": 0,
          "networks.net_groups": 0,
          "networks.net_description": 0,
          "networks.net_departments": 0,
          "networks.net_permissions": 0,
          "networks.net_email": 0,
          "networks.net_category": 0,
          "networks.net_phoneNumber": 0,
          "networks.net_manager": 0,
        })
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
      let modifiedUpdate = update;
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.networks) {
        modifiedUpdate["$addToSet"]["networks"] = {};
        modifiedUpdate["$addToSet"]["networks"]["$each"] =
          modifiedUpdate.networks;
        delete modifiedUpdate["networks"];
      }

      let updatedClient = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
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
      return {
        success: false,
        message: "INTERNAL SERVER ERROR",
        error: error.message,
        errors: { message: "internal server error", error: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, client_id: 1, client_secret: 1, name: 1 },
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
      client_id: this.client_id,
      client_secret: this.client_secret,
      name: this.name,
      redirect_uri: this.redirect_uri,
    };
  },
};

module.exports = ClientSchema;
