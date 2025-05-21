// models/OrganizationRequest.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
const validator = require("validator");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- organization-request-model`
);

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
      logo_url: String,
      primary_color: String,
      secondary_color: String,
    },
  },
  {
    timestamps: true,
  }
);

OrganizationRequestSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create(args);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Organization request created successfully",
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (error.code === 11000) {
        next(
          new HttpError("Conflict", httpStatus.CONFLICT, {
            message: "Organization slug already exists",
          })
        );
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const data = await this.find(filter)
        .populate("approved_by", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      return {
        success: true,
        data,
        message: "Successfully retrieved organization requests",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
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
        return {
          success: true,
          message: "Successfully modified the organization request",
          data: updatedRequest._doc,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Organization request does not exist",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
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
