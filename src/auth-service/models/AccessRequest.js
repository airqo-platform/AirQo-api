const mongoose = require("mongoose");
const { Schema } = mongoose;
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;
const httpStatus = require("http-status");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- access-request-model`
);

const AccessRequestSchema = new Schema(
  {
    user_id: {
      type: ObjectId,
      ref: "user",
    },
    email: {
      type: String,
      trim: true,
      validate: {
        validator(email) {
          return validator.isEmail(email);
        },
        message: "{VALUE} is not a valid email!",
      },
    },
    requestType: {
      type: String,
      enum: ["network", "group"],
      required: [true, "Request type is required"],
    },
    targetId: {
      type: ObjectId,
      required: [true, "Target ID is required"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

AccessRequestSchema.index({
  user_id: 1,
  targetId: 1,
  requestType: 1,
  status: 1,
});
AccessRequestSchema.index({ email: 1, targetId: 1, requestType: 1, status: 1 });
AccessRequestSchema.index({ status: 1, expires_at: 1 });
AccessRequestSchema.index({ targetId: 1, requestType: 1, status: 1 });

AccessRequestSchema.statics = {
  async register(args, next) {
    try {
      const newArgs = Object.assign({}, args);
      const data = await this.create({
        ...newArgs,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "access request", {
          message: "access request created",
        });
      } else {
        return createEmptySuccessResponse(
          "access request",
          "operation successful but Access Request NOT successfully created"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "create", logger, "access request");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection =
        constants.ACCESS_REQUESTS_INCLUSION_PROJECTION;
      const exclusionProjection =
        constants.ACCESS_REQUESTS_EXCLUSION_PROJECTION(
          filter.category ? filter.category : "none"
        );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const data = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "email",
          foreignField: "email",
          as: "user",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);

      const totalCount = await this.countDocuments(filter);

      return {
        success: true,
        data: data,
        message: "successfully listed the access requests",
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
      return createErrorResponse(error, "list", logger, "access request");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const updatedAccessRequest = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedAccessRequest)) {
        return createSuccessResponse(
          "update",
          updatedAccessRequest._doc,
          "access request"
        );
      } else {
        return createNotFoundResponse(
          "access request",
          "update",
          "access request does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "access request");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          user_id: 1,
          email: 1,
          requestType: 1,
          targetId: 1,
          status: 1,
        },
      };

      const removedAccessRequest = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedAccessRequest)) {
        return createSuccessResponse(
          "delete",
          removedAccessRequest._doc,
          "access request"
        );
      } else {
        return createNotFoundResponse(
          "access request",
          "delete",
          "access request does not exist, please crosscheck"
        );
      }
    } catch (error) {
      logObject("the model error", error); // Preserve custom logging
      return createErrorResponse(error, "delete", logger, "access request");
    }
  },
};

AccessRequestSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      user_id: this.user_id,
      email: this.email,
      requestType: this.requestType,
      targetId: this.targetId,
      status: this.status,
    };
  },
};

const AccessRequestModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const access_requests = mongoose.model("access_requests");
    return access_requests;
  } catch (error) {
    const access_requests = getModelByTenant(
      dbTenant,
      "access_request",
      AccessRequestSchema
    );
    return access_requests;
  }
};

module.exports = AccessRequestModel;
