const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blacklist-ip-range-model`
);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const BlacklistedIPRangeSchema = new mongoose.Schema(
  {
    range: {
      type: String,
      required: [true, "range is required!"],
    },
  },
  { timestamps: true }
);

BlacklistedIPRangeSchema.pre("save", function (next) {
  return next();
});

BlacklistedIPRangeSchema.pre("update", function (next) {
  return next();
});

BlacklistedIPRangeSchema.index({ range: 1 }, { unique: true });

BlacklistedIPRangeSchema.statics = {
  async register(args, next) {
    try {
      const modifiedArgs = args;
      const data = await this.create({
        ...modifiedArgs,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "IP range", {
          message: "IP Range created",
        });
      } else {
        return createEmptySuccessResponse(
          "IP range",
          "operation successful but IP Range NOT successfully created"
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
        return createErrorResponse(err, "create", logger, "IP range");
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      logObject("filtering here", filter);
      const inclusionProjection = constants.IP_RANGES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.IP_RANGES_EXCLUSION_PROJECTION(
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
        message: "successfully retrieved the range details",
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
      return createErrorResponse(error, "list", logger, "IP range");
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
        return createSuccessResponse("update", updatedIP._doc, "IP range", {
          message: "successfully modified the IP Range",
        });
      } else {
        return createNotFoundResponse(
          "IP range",
          "update",
          "IP Range does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "IP range");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          range: 1, // Preserve range field projection
        },
      };

      const removedIP = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedIP)) {
        return createSuccessResponse("delete", removedIP._doc, "IP range", {
          message: "successfully removed the IP Range",
        });
      } else {
        return createNotFoundResponse(
          "IP range",
          "delete",
          "IP Range does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "IP range");
    }
  },
};

BlacklistedIPRangeSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      range: this.range,
    };
  },
};

const BlacklistedIPRangeModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let ips = mongoose.model("BlacklistedIPRanges");
    return ips;
  } catch (error) {
    let ips = getModelByTenant(
      dbTenant,
      "BlacklistedIPRange",
      BlacklistedIPRangeSchema
    );
    return ips;
  }
};

module.exports = BlacklistedIPRangeModel;
