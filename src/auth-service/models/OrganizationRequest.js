// models/OrganizationRequest.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
const validator = require("validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- organization-request-model`
);
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const OrganizationRequestSchema = new Schema(
  {
    organization_name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    organization_slug: {
      type: String,
      required: [true, "Organization slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
        },
        message: "Slug must be lowercase alphanumeric with hyphens only",
      },
    },
    contact_email: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
      validate: {
        validator(email) {
          return validator.isEmail(email);
        },
        message: "{VALUE} is not a valid email!",
      },
    },
    contact_name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
    },
    use_case: {
      type: String,
      required: [true, "Use case is required"],
    },
    organization_type: {
      type: String,
      enum: ["academic", "government", "ngo", "private", "other"],
      required: [true, "Organization type is required"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejection_reason: String,
    approved_by: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    approved_at: Date,
    rejected_by: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    rejected_at: Date,
    branding_settings: {
      logo_url: {
        type: String,
        validate: {
          validator: function (v) {
            if (!v) return true; // Allow empty values
            return (
              validator.isURL(v, {
                protocols: ["http", "https"],
                require_protocol: true,
              }) && v.length <= 200
            );
          },
          message: "Logo URL must be a valid URL and not exceed 200 characters",
        },
      },
      primary_color: String,
      secondary_color: String,
    },
    onboarding_token: {
      type: String,
      index: true,
      sparse: true,
      //the JWT token for onboarding flow
    },
    onboarding_completed: {
      type: Boolean,
      default: false,
    },
    onboarding_completed_at: {
      type: Date,
    },
    onboarding_method: {
      type: String,
      enum: ["traditional", "secure_setup"],
      default: "traditional",
    },
  },
  {
    timestamps: true,
  }
);

OrganizationRequestSchema.index({ onboarding_token: 1 }, { sparse: true });
OrganizationRequestSchema.index({ onboarding_completed: 1, createdAt: 1 });

OrganizationRequestSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create(args);

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "organization request", {
          message: "Organization request created successfully",
        });
      } else {
        return createEmptySuccessResponse("organization request");
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);

      // Handle specific duplicate slug error
      if (error.code === 11000) {
        return {
          success: false,
          message: "Organization slug already exists",
          status: httpStatus.CONFLICT,
          errors: { message: "Organization slug already exists" },
        };
      } else {
        return createErrorResponse(
          error,
          "create",
          logger,
          "organization request"
        );
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "users", // Collection name for the user model
            localField: "approved_by",
            foreignField: "_id",
            as: "approved_by_details",
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            approved_by: {
              $cond: {
                if: { $gt: [{ $size: "$approved_by_details" }, 0] },
                then: { $arrayElemAt: ["$approved_by_details", 0] },
                else: null,
              },
            },
          },
        },
        {
          $project: {
            approved_by_details: 0, // Remove the temporary field
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: parseInt(skip) },
        { $limit: parseInt(limit) },
      ];

      const data = await this.aggregate(pipeline);
      const totalCount = await this.countDocuments(filter);

      return createSuccessResponse("list", data, "organization request", {
        message: "Successfully retrieved organization requests",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "organization request");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const updatedRequest = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedRequest)) {
        return createSuccessResponse(
          "update",
          updatedRequest._doc,
          "organization request"
        );
      } else {
        return createNotFoundResponse(
          "organization request",
          "update",
          "Organization request does not exist"
        );
      }
    } catch (error) {
      return createErrorResponse(
        error,
        "update",
        logger,
        "organization request"
      );
    }
  },
};

OrganizationRequestSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      organization_name: this.organization_name,
      organization_slug: this.organization_slug,
      contact_email: this.contact_email,
      contact_name: this.contact_name,
      use_case: this.use_case,
      organization_type: this.organization_type,
      country: this.country,
      status: this.status,
      rejection_reason: this.rejection_reason,
      approved_by: this.approved_by,
      approved_at: this.approved_at,
      branding_settings: this.branding_settings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const OrganizationRequestModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const organization_requests = mongoose.model("organization_requests");
    return organization_requests;
  } catch (error) {
    const organization_requests = getModelByTenant(
      dbTenant,
      "organization_request",
      OrganizationRequestSchema
    );
    return organization_requests;
  }
};

module.exports = OrganizationRequestModel;
