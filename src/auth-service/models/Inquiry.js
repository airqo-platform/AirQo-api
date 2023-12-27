const mongoose = require("mongoose");
const validator = require("validator");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- inquiry-model`);
const { HttpError } = require("@utils/errors");

const InquirySchema = new mongoose.Schema(
  {
    email: {
      type: String,
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
      let modifiedArgs = Object.assign({}, args);
      const eitherFirstOrLastName = args.firstName
        ? args.firstName
        : args.lastName;
      if (isEmpty(args.fullName) && !isEmpty(eitherFirstOrLastName)) {
        modifiedArgs.fullName = eitherFirstOrLastName;
      }

      const data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "inquiry created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data,
          message: "operation successful but user NOT successfully created",
          status: httpStatus.BAD_REQUEST,
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else if (err.code === 11000) {
        response["message"] = "some duplicate records observed";
      }

      logger.error(`Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inquiries = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      if (!isEmpty(inquiries)) {
        return {
          success: true,
          data: inquiries,
          message: "successfully listed the inquiries",
          status: httpStatus.OK,
        };
      } else if (isEmpty(inquiries)) {
        return {
          success: true,
          message: "no inquiries exist for this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
      let options = { new: true };
      let updatedInquiry = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedInquiry)) {
        let data = updatedInquiry._doc;
        delete data.__v;
        return {
          success: true,
          message: "successfully modified the inquiry",
          data,
        };
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "inquiry does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "inquiry does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
  try {
    const inquiries = mongoose.model("inquiries");
    return inquiries;
  } catch (error) {
    const inquiries = getModelByTenant(tenant, "inquiry", InquirySchema);
    return inquiries;
  }
};

module.exports = InquiryModel;
