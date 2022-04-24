const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { logObject, logElement } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");

const CandidateSchema = new mongoose.Schema(
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
    firstName: {
      type: String,
      required: [true, "FirstName is required!"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "LastName is required"],
      trim: true,
    },
    description: { type: String, required: [true, "description is required"] },
    long_organization: {
      type: String,
      required: [true, "long_organization is required"],
    },
    jobTitle: { type: String, required: [true, "jobTitle is required"] },
    category: { type: String, required: [true, "category is required"] },
    website: { type: String, required: [true, "website is required"] },
    status: {
      type: String,
      default: "pending",
    },
    is_email_verified: {
      type: Boolean,
      default: false,
    },
    confirmationCode: {
      type: String,
    },
  },
  { timestamps: true }
);

CandidateSchema.statics = {
  register(args) {
    try {
      return {
        success: true,
        data: this.create({
          ...args,
        }),
        message: "candidate created",
        status: httpStatus.OK,
      };
    } catch (error) {
      return {
        errors: { message: error.message },
        message: "Internal Server Error",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      logObject("the filter for list candidates", filter);
      let candidates = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      if (!isEmpty(candidates)) {
        let data = candidates;
        return {
          success: true,
          data,
          message: "successfully listed the candidates",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "no candidates exist",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      logObject("the filter for update candidate", filter);
      let updatedCandidate = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();
      logObject("updatedCandidate", updatedCandidate);
      if (!isEmpty(updatedCandidate)) {
        let data = updatedCandidate._doc;
        return {
          success: true,
          message: "successfully modified the candidate",
          data,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "candidate does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: { message: "unable to modify non existent candidate" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      let removedCandidate = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedCandidate)) {
        let data = removedCandidate._doc;
        return {
          success: true,
          message: "successfully removed the candidate",
          data,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "candidate does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

CandidateSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      description: this.description,
      category: this.category,
      long_organization: this.long_organization,
      jobTitle: this.jobTitle,
      website: this.website,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      is_email_verified: this.is_email_verified,
    };
  },
};

module.exports = CandidateSchema;
