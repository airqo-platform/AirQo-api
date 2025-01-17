const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const { logObject } = require("@utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- campaign-model`);
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");

const CampaignSchema = new Schema(
  {
    // Basic campaign information
    title: {
      type: String,
      required: [true, "Campaign title is required!"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Campaign description is required!"],
    },

    // Campaign creator/owner
    created_by: {
      type: ObjectId,
      ref: "user",
      required: [true, "Campaign creator is required!"],
    },

    // Financial details
    target_amount: {
      type: Number,
      required: [true, "Target amount is required!"],
      min: [0, "Target amount cannot be negative"],
    },
    current_amount: {
      type: Number,
      default: 0,
      min: [0, "Current amount cannot be negative"],
    },
    currency: {
      type: String,
      required: [true, "Currency is required!"],
      default: "USD",
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },

    // Campaign duration
    start_date: {
      type: Date,
      required: [true, "Start date is required!"],
    },
    end_date: {
      type: Date,
      required: [true, "End date is required!"],
    },

    // Campaign status
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "cancelled"],
      default: "draft",
    },

    // Campaign visibility
    is_public: {
      type: Boolean,
      default: true,
    },

    // Campaign category/type
    category: {
      type: String,
      required: [true, "Campaign category is required!"],
      enum: ["environment", "education", "health", "technology", "other"],
    },

    // Additional campaign details
    images: [
      {
        url: String,
        caption: String,
      },
    ],
    tags: [String],

    // Campaign updates/posts
    updates: [
      {
        title: String,
        content: String,
        created_at: {
          type: Date,
          default: Date.now,
        },
        created_by: {
          type: ObjectId,
          ref: "user",
        },
      },
    ],

    // Additional metadata
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    autoIndex: true,
  }
);

// Indexes for faster querying
CampaignSchema.index({ status: 1, start_date: -1, end_date: -1 });
CampaignSchema.index({ created_by: 1, status: 1 });
CampaignSchema.index({ category: 1, status: 1 });

CampaignSchema.statics = {
  /**
   * Create a new campaign
   * @param {Object} args - Campaign details
   * @param {Function} next - Error handling callback
   */
  async create(args, next) {
    try {
      if (args._id) {
        delete args._id;
      }

      const data = await this.create(args);

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Campaign created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          data: [],
          message: "Campaign could not be created",
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }
    } catch (err) {
      logger.error(`Campaign Creation Error: ${err.message}`);

      let response = {};
      if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
        });
      }

      next(
        new HttpError(
          "Validation errors for campaign",
          httpStatus.BAD_REQUEST,
          response
        )
      );
    }
  },

  /**
   * List campaigns with filtering and pagination
   * @param {Object} options - Query options
   * @param {Function} next - Error handling callback
   */
  async list(
    { skip = 0, limit = 20, filter = {}, sort = { createdAt: -1 } } = {},
    next
  ) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "Successfully retrieved campaigns",
          data: response,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No campaigns found",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      logger.error(`Campaign Listing Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /**
   * Get campaign statistics
   * @param {Object} filter - Aggregation filter
   */
  async getStats(filter = {}) {
    return this.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          totalTargetAmount: { $sum: "$target_amount" },
          totalRaisedAmount: { $sum: "$current_amount" },
          campaignsByCategory: {
            $push: {
              category: "$category",
              count: 1,
              amount: "$current_amount",
            },
          },
        },
      },
    ]);
  },
};

CampaignSchema.methods = {
  /**
   * Custom JSON representation
   */
  toJSON() {
    return {
      _id: this._id,
      title: this.title,
      description: this.description,
      target_amount: this.target_amount,
      current_amount: this.current_amount,
      currency: this.currency,
      status: this.status,
      start_date: this.start_date,
      end_date: this.end_date,
      category: this.category,
      created_by: this.created_by,
      createdAt: this.createdAt,
    };
  },
};

const CampaignModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  try {
    let campaigns = mongoose.model("campaigns");
    return campaigns;
  } catch (error) {
    let campaigns = getModelByTenant(dbTenant, "campaign", CampaignSchema);
    return campaigns;
  }
};

module.exports = CampaignModel;
