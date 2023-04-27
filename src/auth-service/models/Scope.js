const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;

const ScopeSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      unique: true,
      required: [true, "scope is required"],
    },
    network_id: {
      type: ObjectId,
      ref: "network",
      required: [true, "network ID is required"],
    },
    description: { type: String, required: [true, "description is required"] },
  },
  { timestamps: true }
);

ScopeSchema.pre("save", function (next) {
  return next();
});

ScopeSchema.pre("findOneAndUpdate", function () {
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

ScopeSchema.pre("update", function (next) {
  return next();
});

ScopeSchema.index({ scope: 1 }, { unique: true });

ScopeSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Scope created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message: "operation successful but Scope NOT successfully created",
          status: httpStatus.ACCEPTED,
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
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
      let scopes = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .lookup({
          from: "networks",
          localField: "network_id",
          foreignField: "_id",
          as: "network",
        })
        .project({
          _id: 1,
          scope: 1,
          description: 1,
          network: { $arrayElemAt: ["$network", 0] },
        })
        .project({
          "network.__v": 0,
          "network.createdAt": 0,
          "network.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);
      if (!isEmpty(scopes)) {
        return {
          success: true,
          data: scopes,
          message: "successfully listed the Scopes",
          status: httpStatus.OK,
        };
      } else if (isEmpty(scopes)) {
        return {
          success: true,
          message: "no Scopes exist",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
      return {
        success: false,
        message: "unable to retrieve Scopes",
        data: [],
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "unable to retrieve Scopes" },
      };
    } catch (error) {
      return {
        success: false,
        message: "internal server error",
        error: error.message,
        errors: { message: "internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;

      let updatedScope = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedScope)) {
        let data = updatedScope._doc;
        return {
          success: true,
          message: "successfully modified the Scope",
          data,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedScope)) {
        return {
          success: true,
          message: "Scope does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server errors",
        error: error.message,
        errors: { message: "internal server errors" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, scope: 1, description: 1 },
      };
      let removedScope = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedScope)) {
        let data = removedScope._doc;
        return {
          success: true,
          message: "successfully removed the Scope",
          data,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedScope)) {
        return {
          success: true,
          message: "Scope does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server error",
        error: error.message,
        errors: { message: "internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

ScopeSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      scope: this.scope,
      description: this.description,
    };
  },
};

module.exports = ScopeSchema;
