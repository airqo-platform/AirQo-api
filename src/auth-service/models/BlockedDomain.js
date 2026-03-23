const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blocked-domain-model`,
);
const { logObject, HttpError } = require("@utils/shared");

const BlockedDomainSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    reason: { type: String, default: "Manual block" },
    blockedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

BlockedDomainSchema.statics.register = async function (args) {
  try {
    const { domain, reason } = args;

    // Validate domain input before processing
    if (typeof domain !== "string" || domain.trim() === "") {
      logger.error("Validation Error: domain must be a non-empty string.");
      return {
        success: false,
        message: "Validation Error",
        status: httpStatus.BAD_REQUEST,
        errors: {
          message: "The provided domain is invalid or empty.",
        },
      };
    }
    // Normalize the domain to a consistent hostname format
    let normalizedDomain = domain.trim().toLowerCase();
    try {
      // Add a protocol if missing to handle simple domains like 'example.com'
      const urlString = normalizedDomain.startsWith("http")
        ? normalizedDomain
        : `http://${normalizedDomain}`;
      const url = new URL(urlString);
      normalizedDomain = url.hostname;
      if (normalizedDomain.startsWith("www.")) {
        normalizedDomain = normalizedDomain.substring(4);
      }
    } catch (e) {
      // Fallback for simple strings that might not parse as a URL but are valid domains
      logger.warn(
        `Could not parse '${domain}' as a URL, using as-is after trim/lowercase.`,
      );
    }
    const filter = { domain: normalizedDomain };
    const update = {
      $set: {
        domain: normalizedDomain,
        reason: reason || "Manual block",
        blockedAt: new Date(),
        isActive: true,
      },
    };
    const options = { upsert: true, new: true, runValidators: true };

    const blockedDomain = await this.findOneAndUpdate(filter, update, options);

    return {
      success: true,
      data: blockedDomain._doc,
      message: "Domain blocked successfully",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error blocking domain: ${error.message}`,
    );
    return {
      success: false,
      message: error.message,
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
  }
};

BlockedDomainSchema.statics.list = async function (
  { filter = {}, limit = 100, skip = 0 } = {},
  next,
) {
  try {
    const total = await this.countDocuments(filter);
    const data = await this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (data) {
      return {
        success: true,
        data,
        message: "Successfully retrieved blocked domains",
        status: httpStatus.OK,
        meta: {
          total,
          limit,
          skip,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(total / limit) || 1,
        },
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error on list: ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      }),
    );
  }
};

BlockedDomainSchema.statics.remove = async function (
  { filter = {} } = {},
  next,
) {
  try {
    const options = {
      projection: {
        _id: 0,
        domain: 1,
        reason: 1,
      },
    };

    const removedDomain = await this.findOneAndRemove(filter, options).exec();

    if (!isEmpty(removedDomain)) {
      return {
        success: true,
        message: "Successfully removed the blocked domain",
        data: removedDomain._doc,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "Blocked domain does not exist, please crosscheck",
        status: httpStatus.BAD_REQUEST,
        errors: filter,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error on remove: ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      }),
    );
  }
};

const BlockedDomainModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  return getModelByTenant(dbTenant, "blocked_domain", BlockedDomainSchema);
};

module.exports = BlockedDomainModel;
