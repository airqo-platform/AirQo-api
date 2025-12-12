const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- whitelist-ip-model`
);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const WhitelistedIPSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      unique: true,
      required: [true, "ip is required!"],
    },
  },
  { timestamps: true }
);

WhitelistedIPSchema.pre("save", function (next) {
  return next();
});

WhitelistedIPSchema.pre("update", function (next) {
  return next();
});

WhitelistedIPSchema.index({ ip: 1 }, { unique: true });

WhitelistedIPSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "whitelisted IP", {
          message: "IP created",
        });
      } else {
        return createEmptySuccessResponse(
          "whitelisted IP",
          "operation successful but IP NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

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
        // Preserve specific IP duplicate handling
        const duplicate_record = args.ip ? args.ip : "";
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] = "the ip must be unique";
      } else {
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
      const totalCount = await this.countDocuments(filter);

      logObject("filtering here", filter);
      const inclusionProjection = constants.IPS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.IPS_EXCLUSION_PROJECTION(
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
        message: "successfully retrieved the ip details",
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
      return createErrorResponse(error, "list", logger, "whitelisted IP");
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
        return createSuccessResponse(
          "update",
          updatedIP._doc,
          "whitelisted IP",
          {
            message: "successfully modified the IP",
          }
        );
      } else {
        return createNotFoundResponse(
          "whitelisted IP",
          "update",
          "IP does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "whitelisted IP");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          ip: 1, // Preserve ip field projection
        },
      };

      const removedIP = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedIP)) {
        return createSuccessResponse(
          "delete",
          removedIP._doc,
          "whitelisted IP",
          {
            message: "successfully removed the IP",
          }
        );
      } else {
        return createNotFoundResponse(
          "whitelisted IP",
          "delete",
          "IP does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "whitelisted IP");
    }
  },
};

WhitelistedIPSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      ip: this.ip,
    };
  },
};

const WhitelistedIPModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let ips = mongoose.model("WhitelistedIPs");
    return ips;
  } catch (error) {
    let ips = getModelByTenant(dbTenant, "WhitelistedIP", WhitelistedIPSchema);
    return ips;
  }
};

module.exports = WhitelistedIPModel;
