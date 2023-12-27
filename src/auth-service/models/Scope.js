const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");

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
      }
      logger.error(`Internal Server Error -- ${err.message}`);
      next(
        new HttpError(
          "validation errors for some of the provided inputs",
          httpStatus.CONFLICT,
          response
        )
      );
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
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
      } else {
        return {
          success: true,
          message: "no Scopes exist",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
      let modifiedUpdate = update;
      const updatedScope = await this.findOneAndUpdate(
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Scope does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Scope does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
  try {
    const scopes = mongoose.model("scopes");
    return scopes;
  } catch (error) {
    const scopes = getModelByTenant(tenant, "scope", ScopeSchema);
    return scopes;
  }
};

module.exports = ScopeModel;
