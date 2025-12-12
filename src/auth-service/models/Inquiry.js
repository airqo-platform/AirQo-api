const mongoose = require("mongoose");
const validator = require("validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- inquiry-model`);
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const InquirySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      required: [true, "Email is required"],
      trim: true,
      validate: {
        validator(email) {
          return validator.isEmail(email);
        },
        message: "{VALUE} is not a valid email!",
      },
    },
    fullName: {
      type: String,
      required: [true, "fullName is required!"],
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    message: { type: String, required: [true, "message is required"] },
    category: { type: String, required: [true, "category is required"] },
    network: {
      type: String,
    },
    status: {
      type: String,
      default: "pending",
    },
  },
  { timestamps: true }
);

InquirySchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({ ...args });
      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "inquiry");
      } else {
        return createEmptySuccessResponse("inquiry");
      }
    } catch (err) {
      logObject("the error", err);
      return createErrorResponse(err, "create", logger, "inquiry");
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inquiries = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const totalCount = await this.countDocuments(filter);

      return {
        success: true,
        data: inquiries,
        message: "successfully listed the inquiries",
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
      return createErrorResponse(error, "list", logger, "inquiry");
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      let options = { new: true };
      let updatedInquiry = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedInquiry)) {
        let data = updatedInquiry._doc;
        delete data.__v;
        return createSuccessResponse("update", data, "inquiry");
      } else {
        return createNotFoundResponse("inquiry", "update");
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "inquiry");
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      let removedInquiry = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedInquiry)) {
        let data = removedInquiry._doc;
        return {
          success: true,
          message: "successfully removed the inquiry",
          data,
        };
      } else {
        return {
          success: false,
          message: "inquiry does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "inquiry does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

InquirySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      fullName: this.fullName,
      email: this.email,
      message: this.message,
      category: this.category,
      status: this.status,
      firstName: this.firstName,
      lastName: this.lastName,
      network: this.network,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const InquiryModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const inquiries = mongoose.model("inquiries");
    return inquiries;
  } catch (error) {
    const inquiries = getModelByTenant(dbTenant, "inquiry", InquirySchema);
    return inquiries;
  }
};

module.exports = InquiryModel;
