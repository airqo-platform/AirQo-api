const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- flagged-token-model`);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} = require("@utils/shared");

/**
 * FlaggedToken — records whenever an API token hits a honeypot endpoint.
 * Because legitimate callers never reach honeypot routes, any hit is a
 * zero-false-positive signal of probing or scraping behaviour.
 *
 * The token is auto-suspended in AccessToken.request_pattern.auto_suspended
 * and the owner is notified via email. This document provides the audit trail.
 */
const FlaggedTokenSchema = new mongoose.Schema(
  {
    token_hash: {
      type: String,
      required: [true, "token_hash is required"],
      index: true,
    },
    token_suffix: { type: String },
    client_id: { type: String },
    ip: { type: String },
    user_agent: { type: String },
    honeypot_path: {
      type: String,
      required: [true, "honeypot_path is required"],
    },
    service: {
      type: String,
      enum: ["auth-service", "device-registry"],
      default: "auth-service",
    },
    flagged_at: { type: Date, default: Date.now },
    action_taken: {
      type: String,
      enum: ["suspended", "alerted", "none"],
      default: "suspended",
    },
    resolved: { type: Boolean, default: false },
    resolved_at: { type: Date },
    resolution_note: { type: String },
  },
  { timestamps: true }
);

FlaggedTokenSchema.index({ token_hash: 1, flagged_at: -1 });
FlaggedTokenSchema.index({ resolved: 1, flagged_at: -1 });

FlaggedTokenSchema.statics = {
  async logHit(args) {
    try {
      const data = await this.create({ ...args });
      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "flagged token", {
          message: "Honeypot hit recorded",
        });
      }
      return { success: true, message: "Honeypot hit recorded" };
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 FlaggedToken.logHit error: ${err.message}`);
      return createErrorResponse(err, "create", logger, "flagged token");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .sort({ flagged_at: -1 })
        .skip(skip || 0)
        .limit(limit || 100)
        .allowDiskUse(true);
      return createSuccessResponse("list", response, "flagged token", {
        message: "successfully retrieved flagged token entries",
        emptyMessage: "no flagged token entries found",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "flagged token");
    }
  },

  async resolve({ filter = {}, note = "" } = {}) {
    try {
      const updated = await this.findOneAndUpdate(
        filter,
        { $set: { resolved: true, resolved_at: new Date(), resolution_note: note } },
        { new: true }
      ).exec();
      if (!isEmpty(updated)) {
        return createSuccessResponse("update", updated.toObject(), "flagged token");
      }
      return createNotFoundResponse(
        "flagged token",
        "resolve",
        "entry does not exist"
      );
    } catch (error) {
      return createErrorResponse(error, "update", logger, "flagged token");
    }
  },
};

FlaggedTokenSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      token_hash: this.token_hash,
      token_suffix: this.token_suffix,
      client_id: this.client_id,
      ip: this.ip,
      user_agent: this.user_agent,
      honeypot_path: this.honeypot_path,
      service: this.service,
      flagged_at: this.flagged_at,
      action_taken: this.action_taken,
      resolved: this.resolved,
      resolved_at: this.resolved_at,
      resolution_note: this.resolution_note,
    };
  },
};

const FlaggedTokenModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("FlaggedTokens");
  } catch (error) {
    return getModelByTenant(dbTenant, "FlaggedToken", FlaggedTokenSchema);
  }
};

module.exports = FlaggedTokenModel;
