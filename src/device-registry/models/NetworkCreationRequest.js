"use strict";
const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-creation-request-model`
);
const { getModelByTenant } = require("@config/database");

const NetworkCreationRequestSchema = new Schema(
  {
    requester_name: {
      type: String,
      required: [true, "requester_name is required"],
      trim: true,
    },
    requester_email: {
      type: String,
      required: [true, "requester_email is required"],
      match: [/\S+@\S+\.\S+/, "is invalid"],
      trim: true,
      lowercase: true,
    },
    net_name: {
      type: String,
      required: [true, "net_name is required"],
      trim: true,
    },
    net_email: {
      type: String,
      required: [true, "net_email is required"],
      match: [/\S+@\S+\.\S+/, "is invalid"],
      trim: true,
      lowercase: true,
    },
    net_website: {
      type: String,
      trim: true,
    },
    net_category: {
      type: String,
      trim: true,
    },
    net_description: {
      type: String,
      trim: true,
    },
    net_acronym: {
      type: String,
      trim: true,
    },
    // Current lifecycle state of the request
    status: {
      type: String,
      enum: ["pending", "approved", "denied", "under_review"],
      default: "pending",
      index: true,
    },
    // Optional notes left by the reviewer on approval, denial, or review
    reviewer_notes: {
      type: String,
      trim: true,
    },
    // Username or identifier of the admin who acted on the request
    reviewed_by: {
      type: String,
      trim: true,
    },
    reviewed_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

NetworkCreationRequestSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

NetworkCreationRequestSchema.methods.toJSON = function() {
  const {
    _id,
    requester_name,
    requester_email,
    net_name,
    net_email,
    net_website,
    net_category,
    net_description,
    net_acronym,
    status,
    reviewer_notes,
    reviewed_by,
    reviewed_at,
    createdAt,
    updatedAt,
  } = this.toObject();

  return {
    _id,
    requester_name,
    requester_email,
    net_name,
    net_email,
    net_website,
    net_category,
    net_description,
    net_acronym,
    status,
    reviewer_notes,
    reviewed_by,
    reviewed_at,
    createdAt: createdAt ? new Date(createdAt).toISOString().slice(0, 19) : null,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString().slice(0, 19) : null,
  };
};

NetworkCreationRequestSchema.statics.register = async function(args, next) {
  try {
    const created = await this.create({ ...args });

    if (!isEmpty(created)) {
      return {
        success: true,
        data: created,
        message: "sensor manufacturer creation request submitted successfully",
        status: httpStatus.CREATED,
      };
    }

    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message:
          "request not created despite successful operation",
      })
    );
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);

    const response = {
      message: "validation errors for some of the provided fields",
      success: false,
      status: httpStatus.CONFLICT,
      errors: {},
    };

    if (!isEmpty(error.errors)) {
      Object.entries(error.errors).forEach(([key, value]) => {
        response.errors.message = value.message;
        response.errors[value.path] = value.message;
      });
    } else {
      response.errors = { message: error.message };
    }

    next(new HttpError(response.message, response.status, response.errors));
  }
};

NetworkCreationRequestSchema.statics.list = async function(
  { filter = {}, limit = 100, skip = 0 } = {},
  next
) {
  try {
    const data = await this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      success: true,
      message: isEmpty(data)
        ? "No records found for this search"
        : "Successfully retrieved sensor manufacturer creation requests",
      data: data || [],
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

NetworkCreationRequestSchema.statics.modify = async function(
  { filter = {}, update = {} } = {},
  next
) {
  try {
    const updated = await this.findOneAndUpdate(filter, update, {
      new: true,
      lean: true,
      runValidators: true,
    });

    if (!isEmpty(updated)) {
      return {
        success: true,
        message: "request updated successfully",
        data: updated,
        status: httpStatus.OK,
      };
    }

    return {
      success: false,
      message: "request not found",
      errors: { message: "No matching request found" },
      status: httpStatus.NOT_FOUND,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const NetworkCreationRequestModel = (tenant) => {
  const modelName = "NetworkCreationRequest";
  try {
    return getModelByTenant(
      tenant,
      modelName,
      NetworkCreationRequestSchema
    );
  } catch (error) {
    logger.error(
      `getModelByTenant failed for tenant "${tenant}": ${error.message}`
    );
    throw error;
  }
};

module.exports = NetworkCreationRequestModel;
