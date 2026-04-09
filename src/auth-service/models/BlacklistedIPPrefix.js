const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blacklisted-ip-prefix-model`,
);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const BlacklistedIPPrefixSchema = new mongoose.Schema(
  {
    prefix: {
      type: String,
      unique: true,
      required: [true, "prefix is required!"],
    },
  },
  { timestamps: true },
);

BlacklistedIPPrefixSchema.pre("save", function (next) {
  return next();
});

BlacklistedIPPrefixSchema.pre("update", function (next) {
  return next();
});

BlacklistedIPPrefixSchema.index({ prefix: 1 }, { unique: true });

BlacklistedIPPrefixSchema.statics = {
  async register(args, next) {
    try {
      const { prefix, ...rest } = args;

      const rawResult = await this.findOneAndUpdate(
        { prefix }, // filter — match on the unique key
        { $setOnInsert: { prefix, ...rest } }, // only write fields on INSERT; no-op on match
        {
          upsert: true,
          new: true, // return the resulting document
          runValidators: true,
          rawResult: true, // expose lastErrorObject so we can detect insert vs match
        },
      );

      // rawResult.value is the Mongoose document (toJSON() runs normally — no lean)
      const data = rawResult && rawResult.value;
      const wasExisting = !!(
        rawResult &&
        rawResult.lastErrorObject &&
        rawResult.lastErrorObject.updatedExisting === true
      );

      if (!isEmpty(data)) {
        const message = wasExisting
          ? "IP prefix already exists and is blacklisted"
          : "IP prefix created";
        return createSuccessResponse("create", data._doc, "IP prefix", {
          message,
        });
      } else {
        return createEmptySuccessResponse(
          "IP prefix",
          "operation successful but IP prefix NOT successfully created",
        );
      }
    } catch (err) {
      // E11000 duplicate key — another pod won the upsert race in the same server tick.
      // This is expected under load and is safe to treat as success.
      if (err.code === 11000) {
        logger.warn(
          `⚠️ IP prefix upsert race — prefix already blacklisted. Treating as success.`,
        );
        try {
          const existing = await this.findOne({ prefix: args.prefix });
          return createSuccessResponse("create", existing._doc, "IP prefix", {
            message: "IP prefix already exists and is blacklisted",
          });
        } catch (fetchErr) {
          logger.error(
            `🐛🐛 Could not fetch existing prefix after duplicate key error: ${fetchErr.message}`,
          );
          return {
            success: true,
            message:
              "IP prefix already blacklisted (confirmed via duplicate key)",
            status: httpStatus.OK,
            data: { prefix: args.prefix },
          };
        }
      }

      // Only log as an actual error for unexpected failures
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      return createErrorResponse(err, "create", logger, "IP prefix");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      const inclusionProjection = constants.IP_PREFIX_INCLUSION_PROJECTION;
      const exclusionProjection = constants.IP_PREFIX_EXCLUSION_PROJECTION(
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
        options,
      ).exec();

      if (!isEmpty(updatedIP)) {
        return createSuccessResponse("update", updatedIP._doc, "IP prefix", {
          message: "successfully modified the IP",
        });
      } else {
        return createNotFoundResponse(
          "IP prefix",
          "update",
          "IP does not exist, please crosscheck",
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
          "IP does not exist, please crosscheck",
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "IP prefix");
    }
  },
};

BlacklistedIPPrefixSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      prefix: this.prefix,
    };
  },
};

const BlacklistedIPPrefixModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let prefix = mongoose.model("BlacklistedIPPrefixes");
    return prefix;
  } catch (error) {
    let prefix = getModelByTenant(
      dbTenant,
      "BlacklistedIPPrefix",
      BlacklistedIPPrefixSchema,
    );
    return prefix;
  }
};

module.exports = BlacklistedIPPrefixModel;
