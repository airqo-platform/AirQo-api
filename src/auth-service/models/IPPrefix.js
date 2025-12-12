const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blacklisted-ip-prefix-model`
);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

function getDay() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const IPPrefixSchema = new mongoose.Schema(
  {
    prefix: {
      type: String,
      unique: true,
      required: [true, "prefix is required!"],
    },
    prefixCounts: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        day: {
          type: String,
          default: getDay(),
        },
        count: {
          type: Number,
          default: 1,
        },
      },
    ],
  },
  { timestamps: true }
);

IPPrefixSchema.pre("save", function (next) {
  return next();
});

IPPrefixSchema.pre("update", function (next) {
  return next();
});

IPPrefixSchema.index({ prefix: 1, "prefixCounts.day": 1 }, { unique: true });

IPPrefixSchema.statics = {
  async register(args, next) {
    try {
      const modifiedArgs = args;
      const data = await this.create({
        ...modifiedArgs,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "IP prefix", {
          message: "IP created",
        });
      } else {
        return createEmptySuccessResponse(
          "IP prefix",
          "operation successful but IP NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);

      // Handle specific duplicate key errors
      if (err.keyValue) {
        let response = {};
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          status: httpStatus.CONFLICT,
          errors: response,
        };
      } else {
        return createErrorResponse(err, "create", logger, "IP prefix");
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      const inclusionProjection = constants.IP_PREFIX_INCLUSION_PROJECTION;
      const exclusionProjection = constants.IP_PREFIX_EXCLUSION_PROJECTION(
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
        .limit(limit ? limit : 300) // Preserve higher default limit (300)
        .allowDiskUse(true);

      return {
        success: true,
        data: response,
        message: "successfully retrieved the prefix details",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "IP prefix");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = Object.assign({}, update);

      const updatedIP = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedIP)) {
        return createSuccessResponse("update", updatedIP._doc, "IP prefix", {
          message: "successfully modified the IP",
        });
      } else {
        return createNotFoundResponse(
          "IP prefix",
          "update",
          "IP does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "IP prefix");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          prefix: 1, // Preserve prefix field projection
        },
      };

      const removedIP = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedIP)) {
        return createSuccessResponse("delete", removedIP._doc, "IP prefix", {
          message: "successfully removed the IP",
        });
      } else {
        return createNotFoundResponse(
          "IP prefix",
          "delete",
          "IP does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "IP prefix");
    }
  },
};

IPPrefixSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      prefix: this.prefix,
      prefixCounts: this.prefixCounts,
    };
  },
};

const IPPrefixModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let prefix = mongoose.model("IPPrefixes");
    return prefix;
  } catch (error) {
    let prefix = getModelByTenant(dbTenant, "IPPrefix", IPPrefixSchema);
    return prefix;
  }
};

module.exports = IPPrefixModel;
