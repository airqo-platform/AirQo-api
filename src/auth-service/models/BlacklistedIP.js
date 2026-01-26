const mongoose = require("mongoose");

const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blacklist-ip-model`,
);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const BlacklistedIPSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      unique: true,
      required: [true, "ip is required!"],
    },
    reason: { type: String, default: "Automated blacklisting" },
    blacklistedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

BlacklistedIPSchema.pre("save", function (next) {
  return next();
});

BlacklistedIPSchema.pre("update", function (next) {
  return next();
});

BlacklistedIPSchema.index({ ip: 1 }, { unique: true });

BlacklistedIPSchema.statics = {
  async register(args, next) {
    try {
      const { ip, reason } = args;
      const filter = { ip };

      const update = {
        $set: {
          ip,
          blacklistedAt: new Date(),
        },
        $setOnInsert: {
          reason: "Automated blacklisting",
        },
      };

      if (reason !== undefined && reason !== null) {
        update.$set.reason = reason;
      }

      const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      };

      const data = await this.findOneAndUpdate(filter, update, options);

      if (!isEmpty(data)) {
        return createSuccessResponse("upsert", data._doc, "IP", {
          message: "IP blacklisted successfully",
        });
      } else {
        return createEmptySuccessResponse(
          "IP",
          "operation successful but IP could not be blacklisted",
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      return createErrorResponse(err, "create", logger, "IP");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      logObject("filtering here", filter);
      const inclusionProjection = constants.IPS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.IPS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none",
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
      return createErrorResponse(error, "list", logger, "IP");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = Object.assign({}, update);

      const updatedIP = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options,
      ).exec();

      if (!isEmpty(updatedIP)) {
        return createSuccessResponse("update", updatedIP._doc, "IP");
      } else {
        return createNotFoundResponse(
          "IP",
          "update",
          "IP does not exist, please crosscheck",
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "IP");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          ip: 1,
        },
      };

      const removedIP = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedIP)) {
        return createSuccessResponse("delete", removedIP._doc, "IP");
      } else {
        return createNotFoundResponse(
          "IP",
          "delete",
          "IP does not exist, please crosscheck",
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "IP");
    }
  },
};

BlacklistedIPSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      ip: this.ip,
      reason: this.reason,
      blacklistedAt: this.blacklistedAt,
    };
  },
};

const BlacklistedIPModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let ips = mongoose.model("BlacklistedIPs");
    return ips;
  } catch (error) {
    let ips = getModelByTenant(dbTenant, "BlacklistedIP", BlacklistedIPSchema);
    return ips;
  }
};

module.exports = BlacklistedIPModel;
