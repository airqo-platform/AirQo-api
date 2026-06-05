const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- blocked-asn-model`);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

/**
 * BlockedASN — stores Autonomous System Number (ASN) entries that should be
 * blocked at the token-verify layer. Each document can cover:
 *   - A single CIDR range  (e.g. "192.0.2.0/24")
 *   - Multiple CIDR ranges belonging to one AS  (e.g. all AWS us-east-1 ranges)
 *
 * Admins populate this collection manually or via a management API.  The verify
 * path loads the list from Redis (10-min TTL) and falls back to MongoDB.
 */
const BlockedASNSchema = new mongoose.Schema(
  {
    asn: {
      type: String,
      trim: true,
    },
    provider: {
      type: String,
      trim: true,
      required: [true, "provider name is required"],
    },
    // One or more CIDR blocks belonging to this AS / provider.
    // Each entry must be valid IPv4 CIDR notation (e.g. "192.0.2.0/24").
    cidr_ranges: [
      {
        type: String,
        trim: true,
        validate: {
          validator: (v) =>
            /^(\d{1,3}\.){3}\d{1,3}\/([0-9]|[1-2]\d|3[0-2])$/.test(v),
          message: (props) => `"${props.value}" is not a valid IPv4 CIDR`,
        },
      },
    ],
    reason: {
      type: String,
      default: "Data-center / cloud provider range",
    },
    active: {
      type: Boolean,
      default: true,
    },
    blockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

BlockedASNSchema.index({ asn: 1 });
BlockedASNSchema.index({ active: 1 });

// Require at least one of asn or a non-empty cidr_ranges so every document
// carries meaningful blocking information.
BlockedASNSchema.pre("validate", function (next) {
  if (!this.asn && (!this.cidr_ranges || this.cidr_ranges.length === 0)) {
    return next(
      new Error("BlockedASN must have at least one of: asn or cidr_ranges")
    );
  }
  return next();
});

BlockedASNSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({ ...args });
      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "blocked ASN", {
          message: "ASN block created",
        });
      }
      return createEmptySuccessResponse(
        "blocked ASN",
        "operation successful but ASN block NOT created"
      );
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      return createErrorResponse(err, "create", logger, "blocked ASN");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .skip(skip || 0)
        .limit(limit || 100)
        .allowDiskUse(true);
      return createSuccessResponse("list", response, "blocked ASN", {
        message: "successfully retrieved blocked ASN entries",
        emptyMessage: "no blocked ASN entries found",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "blocked ASN");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const updated = await this.findOneAndUpdate(filter, update, {
        new: true,
      }).exec();
      if (!isEmpty(updated)) {
        return createSuccessResponse("update", updated.toObject(), "blocked ASN");
      }
      return createNotFoundResponse(
        "blocked ASN",
        "update",
        "entry does not exist"
      );
    } catch (error) {
      return createErrorResponse(error, "update", logger, "blocked ASN");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const removed = await this.findOneAndRemove(filter, {
        projection: { _id: 1, provider: 1 },
      }).exec();
      if (!isEmpty(removed)) {
        return createSuccessResponse("delete", removed.toObject(), "blocked ASN");
      }
      return createNotFoundResponse(
        "blocked ASN",
        "delete",
        "entry does not exist"
      );
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "blocked ASN");
    }
  },
};

BlockedASNSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      asn: this.asn,
      provider: this.provider,
      cidr_ranges: this.cidr_ranges,
      reason: this.reason,
      active: this.active,
      blockedAt: this.blockedAt,
    };
  },
};

const BlockedASNModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("BlockedASNs");
  } catch (error) {
    return getModelByTenant(dbTenant, "BlockedASN", BlockedASNSchema);
  }
};

module.exports = BlockedASNModel;
