const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { logObject, logElement } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");

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
    message: { type: String, required: [true, "message is required"] },
    category: { type: String, required: [true, "category is required"] },
    status: {
      type: String,
      default: "pending",
    },
  },
  { timestamps: true }
);

InquirySchema.statics = {
  register(args) {
    try {
      return {
        success: true,
        data: this.create({
          ...args,
        }),
        message: "inquiry created",
        status: httpStatus.OK,
      };
    } catch (error) {
      return {
        errors: { message: error.message },
        message: "unable to create inquiry",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      let inquiries = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      if (!isEmpty(inquiries)) {
        let data = inquiries;
        return {
          success: true,
          data,
          message: "successfully listed the inquiries",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "no inquiries exist for this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "unable to list the inquiries",
        error: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
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
        return {
          success: false,
          message: "inquiry does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
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
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

module.exports = InquirySchema;
