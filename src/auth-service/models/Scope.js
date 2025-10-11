const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.ObjectId;
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- scope-model`);

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

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

ScopeSchema.pre("update", function (next) {
  return next();
});

ScopeSchema.index({ scope: 1 }, { unique: true });

ScopeSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "scope", {
          message: "Scope created",
        });
      } else {
        return createEmptySuccessResponse(
          "scope",
          "operation successful but Scope NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

      // Handle specific duplicate key errors
      if (err.keyValue) {
        let response = {};
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
        return {
          success: false,
          message: "validation errors for some of the provided inputs",
          status: httpStatus.CONFLICT,
          errors: response,
        };
      } else {
        return createErrorResponse(err, "create", logger, "scope");
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const scopes = await this.aggregate()
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

      return createSuccessResponse("list", scopes, "scope", {
        message: "successfully listed the Scopes",
        emptyMessage: "no Scopes exist",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "scope");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = update;

      const updatedScope = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedScope)) {
        const data = updatedScope._doc;
        return createSuccessResponse("update", data, "scope");
      } else {
        return createNotFoundResponse(
          "scope",
          "update",
          "Scope does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "scope");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: { _id: 0, scope: 1, description: 1 },
      };

      const removedScope = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedScope)) {
        const data = removedScope._doc;
        return createSuccessResponse("delete", data, "scope");
      } else {
        return createNotFoundResponse(
          "scope",
          "delete",
          "Scope does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "scope");
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

const ScopeModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const scopes = mongoose.model("scopes");
    return scopes;
  } catch (error) {
    const scopes = getModelByTenant(dbTenant, "scope", ScopeSchema);
    return scopes;
  }
};

module.exports = ScopeModel;
