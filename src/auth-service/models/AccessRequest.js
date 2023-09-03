const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { logObject, logElement } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
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
      required: [true, "User ID is required"],
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
    // Additional fields for comments, timestamps, etc.
  },
  {
    timestamps: true,
  }
);

AccessRequestSchema.statics = {
  async register(args) {
    try {
      let newArgs = Object.assign({}, args);
      const data = await this.create({
        ...newArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "access request created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message:
            "operation successful but access request NOT successfully created",
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        errors: { message: error.message },
        message: "unable to create access request",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const inclusionProjection =
        constants.ACCESS_REQUESTS_INCLUSION_PROJECTION;
      const exclusionProjection =
        constants.ACCESS_REQUESTS_EXCLUSION_PROJECTION(
          filter.category ? filter.category : "none"
        );
      const data = await this.aggregate()

        .match(filter)
        .lookup({
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the access_requests",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          message: "no access_requests exist",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        success: false,
        message: "unable to list the access_requests",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      const updatedAccessRequest = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedAccessRequest)) {
        return {
          success: true,
          message: "successfully modified the access request",
          data: updatedAccessRequest._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedAccessRequest)) {
        return {
          success: false,
          message: "access request does not exist, please crosscheck",
          errors: {
            message: "access request does not exist, please crosscheck",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      const options = {
        projection: {
          _id: 1,
          user_id: 1,
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
        return {
          success: true,
          message: "successfully removed the access request",
          data: removedAccessRequest._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedAccessRequest)) {
        return {
          success: false,
          message: "access request does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "access request does not exist, please crosscheck",
          },
        };
      }
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

AccessRequestSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      user_id: this.user_id,
      requestType: this.requestType,
      targetId: this.targetId,
      status: this.status,
    };
  },
};

const AccessRequestModel = (tenant) => {
  try {
    const access_requests = mongoose.model("access_requests");
    return access_requests;
  } catch (error) {
    const access_requests = getModelByTenant(
      tenant,
      "access_request",
      AccessRequestSchema
    );
    return access_requests;
  }
};

module.exports = AccessRequestModel;
