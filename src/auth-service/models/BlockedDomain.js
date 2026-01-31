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
    const normalizedDomain = domain.trim().toLowerCase();
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

// Add other static methods like list, modify, remove as needed

const BlockedDomainModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("blocked_domains");
  } catch (error) {
    return getModelByTenant(dbTenant, "blocked_domain", BlockedDomainSchema);
  }
};

module.exports = BlockedDomainModel;
