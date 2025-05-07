const mongoose = require("mongoose").set("debug", true);
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(`${constants.ENVIRONMENT} -- Scope`);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
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
      default: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK),
    },
    description: { type: String, required: [true, "description is required"] },
    tier: {
      type: String,
      enum: ["Free", "Standard", "Premium"],
      required: [true, "subscription tier is required"],
    },
    endpoint_pattern: {
      type: String,
      required: false,
      description:
        "Regex pattern for matching API endpoints this scope applies to",
    },
    resource_type: {
      type: String,
      enum: [
        "measurements",
        "sites",
        "devices",
        "cohorts",
        "grids",
        "forecasts",
        "insights",
      ],
      required: [true, "resource type is required"],
    },
    access_type: {
      type: String,
      enum: ["read", "write"],
      default: "read",
    },
    data_timeframe: {
      type: String,
      enum: ["recent", "historical", "all"],
      default: "recent",
      description:
        "Whether this scope allows access to recent or historical data",
    },
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
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
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
          tier: 1,
          resource_type: 1,
          access_type: 1,
          data_timeframe: 1,
          endpoint_pattern: 1,
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
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // New method: Get scopes by tier
  async getScopesByTier(tier, next) {
    try {
      const scopes = await this.find({ tier }).lean();

      if (!isEmpty(scopes)) {
        return {
          success: true,
          data: scopes,
          message: `Successfully retrieved scopes for ${tier} tier`,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: `No scopes found for ${tier} tier`,
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // New method: Initialize default scopes
  async initializeDefaultScopes(tenant, next) {
    try {
      // Default scopes for Free tier
      const freeScopes = [
        {
          scope: "read:recent_measurements",
          description: "Access to recent measurements (last 24 hours)",
          tier: "Free",
          resource_type: "measurements",
          access_type: "read",
          data_timeframe: "recent",
          endpoint_pattern: "/measurements/recent",
        },
        {
          scope: "read:devices",
          description: "Access to device metadata",
          tier: "Free",
          resource_type: "devices",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:sites",
          description: "Access to site metadata",
          tier: "Free",
          resource_type: "sites",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:cohorts",
          description: "Access to cohort metadata",
          tier: "Free",
          resource_type: "cohorts",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:grids",
          description: "Access to grid metadata",
          tier: "Free",
          resource_type: "grids",
          access_type: "read",
          data_timeframe: "all",
        },
      ];

      // Additional scopes for Standard tier
      const standardScopes = [
        {
          scope: "read:historical_measurements",
          description: "Access to historical measurements",
          tier: "Standard",
          resource_type: "measurements",
          access_type: "read",
          data_timeframe: "historical",
          endpoint_pattern: "/measurements(?!/recent)",
        },
      ];

      // Additional scopes for Premium tier
      const premiumScopes = [
        {
          scope: "read:forecasts",
          description: "Access to air quality forecasts",
          tier: "Premium",
          resource_type: "forecasts",
          access_type: "read",
          data_timeframe: "all",
          endpoint_pattern: "/forecasts",
        },
        {
          scope: "read:insights",
          description: "Access to air quality insights and analytics",
          tier: "Premium",
          resource_type: "insights",
          access_type: "read",
          data_timeframe: "all",
          endpoint_pattern: "/insights",
        },
      ];

      // Combine all scopes
      const allScopes = [...freeScopes, ...standardScopes, ...premiumScopes];

      // Insert scopes, ignoring duplicates
      for (const scope of allScopes) {
        try {
          await this.findOneAndUpdate({ scope: scope.scope }, scope, {
            upsert: true,
            new: true,
          });
        } catch (err) {
          logger.error(
            `Error initializing scope ${scope.scope}: ${err.message}`
          );
        }
      }

      return {
        success: true,
        message: "Default scopes initialized successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
      tier: this.tier,
      resource_type: this.resource_type,
      access_type: this.access_type,
      data_timeframe: this.data_timeframe,
      endpoint_pattern: this.endpoint_pattern,
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
