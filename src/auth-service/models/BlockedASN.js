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
            /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\/(3[0-2]|[12]\d|\d)$/.test(v),
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
// Unique on provider so repeated POST requests upsert rather than duplicate.
// Pre-deploy requirement: if the collection already has duplicate provider
// values from an earlier deploy, run a one-time deduplication query before
// this index is applied, otherwise the index build will fail on startup.
BlockedASNSchema.index({ provider: 1 }, { unique: true });

// Require at least one of asn or a non-empty cidr_ranges so every document
// carries meaningful blocking information.
// pre('validate') covers save() paths; pre('findOneAndUpdate') covers the
// upsert path used by register() — runValidators:true does not invoke
// document middleware, so both hooks are needed.
BlockedASNSchema.pre("validate", function (next) {
  if (!this.asn && (!this.cidr_ranges || this.cidr_ranges.length === 0)) {
    return next(
      new Error("BlockedASN must have at least one of: asn or cidr_ranges")
    );
  }
  return next();
});

BlockedASNSchema.pre("findOneAndUpdate", function (next) {
  // Only enforce on upserts (new document creation). Partial updates on
  // existing documents (e.g. toggling active or changing reason) are allowed
  // without re-validating cross-field constraints — the document already
  // passed validation when it was first created.
  if (!this.getOptions().upsert) return next();

  const update = this.getUpdate() || {};
  const setData = update.$set || {};
  // cidr_ranges is written via $addToSet.$each in register() so check both
  // operators when deciding whether the constraint is satisfied.
  const addToSetCidrs =
    update.$addToSet &&
    update.$addToSet.cidr_ranges &&
    update.$addToSet.cidr_ranges.$each;

  const asn = setData.asn;
  const cidrRanges = setData.cidr_ranges || addToSetCidrs;

  if (!asn && (!cidrRanges || cidrRanges.length === 0)) {
    return next(
      new Error("BlockedASN must have at least one of: asn or cidr_ranges")
    );
  }
  return next();
});

BlockedASNSchema.statics = {
  async register(args, next) {
    try {
      const { provider, cidr_ranges, ...scalars } = args;

      // Split operators:
      //   $set     — scalar fields (asn, reason, active, blockedAt)
      //   $addToSet — cidr_ranges array, so repeated POSTs merge new ranges
      //               instead of overwriting existing ones.
      const updateOp = {
        $set: { provider, ...scalars },
        ...(cidr_ranges && cidr_ranges.length > 0 && {
          $addToSet: { cidr_ranges: { $each: cidr_ranges } },
        }),
      };

      const rawResult = await this.findOneAndUpdate(
        { provider },
        updateOp,
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          rawResult: true,
        }
      );

      const doc = rawResult && rawResult.value;
      // lastErrorObject.updatedExisting is false for inserts, true for updates.
      const wasInserted = !(
        rawResult &&
        rawResult.lastErrorObject &&
        rawResult.lastErrorObject.updatedExisting
      );

      if (!isEmpty(doc)) {
        return createSuccessResponse("create", doc.toObject(), "blocked ASN", {
          message: wasInserted ? "ASN block created" : "ASN block updated",
        });
      }
      return createEmptySuccessResponse(
        "blocked ASN",
        "operation successful but ASN block NOT created"
      );
    } catch (err) {
      // E11000: concurrent upsert race — another request won the insert.
      // The document now exists; treat as success (same pattern as BlacklistedIPPrefix).
      if (err.code === 11000) {
        logger.warn(
          `⚠️ BlockedASN upsert race — provider already exists. Treating as success.`
        );
        try {
          const existing = await this.findOne({ provider: args.provider });
          return createSuccessResponse("create", existing.toObject(), "blocked ASN", {
            message: "ASN block already exists",
          });
        } catch (fetchErr) {
          logger.error(
            `🐛🐛 Could not fetch existing BlockedASN after duplicate key: ${fetchErr.message}`
          );
          return {
            success: true,
            message: "ASN block already exists (confirmed via duplicate key)",
            status: httpStatus.OK,
            data: { provider: args.provider },
          };
        }
      }
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
