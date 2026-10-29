const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-comparison-model`
);
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

// Display snapshot taken at save time — lets a saved comparison still render
// a meaningful picker pre-selection even if a site is later renamed or
// removed from the network. The readings endpoint resolves current truth
// separately, at load time.
const ComparisonSiteSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String },
    location: { type: String },
    city: { type: String },
    country: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false }
);

const ComparisonSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: [true, "user_id is required"],
    },
    group_id: {
      type: Schema.Types.ObjectId,
      required: [true, "group_id is required"],
    },
    name: {
      type: String,
      trim: true,
      required: [true, "name is required"],
      minlength: 1,
      maxlength: 120,
    },
    // Preserves the user's chosen order (e.g. picker selection order) —
    // the client expects site_ids back in the same order it sent them.
    site_ids: {
      type: [String],
      required: [true, "site_ids is required"],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 1 && value.length <= 80,
        message: "site_ids must contain between 1 and 80 entries",
      },
    },
    sites: { type: [ComparisonSiteSchema], default: [] },
  },
  { timestamps: true }
);

ComparisonSchema.index({ user_id: 1, group_id: 1, updatedAt: -1 });

ComparisonSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({ ...args });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "comparison", {
          message: "Comparison created",
        });
      }
      return createEmptySuccessResponse(
        "comparison",
        "operation successful but comparison NOT successfully created"
      );
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

      if (err.name === "ValidationError") {
        const response = {};
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
        });
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          status: httpStatus.BAD_REQUEST,
          errors: response,
        };
      }

      return createErrorResponse(err, "create", logger, "comparison");
    }
  },

  async list({ skip = 0, limit = 20, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      const data = await this.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 20)
        .lean();

      return {
        success: true,
        data,
        message: "successfully listed the comparisons",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          total_pages: Math.ceil(totalCount / limit) || 1,
          page: Math.floor(skip / limit) + 1,
          limit,
        },
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "comparison");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true, runValidators: true, context: "query" };

      const updatedComparison = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedComparison)) {
        return createSuccessResponse(
          "update",
          updatedComparison._doc,
          "comparison"
        );
      }
      return createNotFoundResponse(
        "comparison",
        "update",
        "Comparison does not exist, please crosscheck"
      );
    } catch (error) {
      if (error.name === "ValidationError") {
        const response = {};
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
        });
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          status: httpStatus.BAD_REQUEST,
          errors: response,
        };
      }
      return createErrorResponse(error, "update", logger, "comparison");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const removedComparison = await this.findOneAndRemove(filter).exec();

      if (!isEmpty(removedComparison)) {
        return createSuccessResponse(
          "delete",
          removedComparison._doc,
          "comparison",
          { message: "Successfully removed the comparison" }
        );
      }
      return createNotFoundResponse(
        "comparison",
        "delete",
        "Comparison does not exist, please crosscheck"
      );
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "comparison");
    }
  },
};

ComparisonSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      id: this._id,
      user_id: this.user_id,
      group_id: this.group_id,
      name: this.name,
      site_ids: this.site_ids,
      sites: this.sites,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  },
};

const ComparisonModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("comparisons");
  } catch (error) {
    return getModelByTenant(dbTenant, "comparison", ComparisonSchema);
  }
};

module.exports = ComparisonModel;
