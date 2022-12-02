const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { logObject, logElement } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("../config/constants");

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
    isDenied: {
      type: Boolean,
    },
    status: {
      type: String,
      default: "pending",
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
        message: "unable to create candidate",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      const project = {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        description: 1,
        category: 1,
        long_organization: 1,
        jobTitle: 1,
        website: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        existing_user: { $arrayElemAt: ["$user", 0] },
      };

      const data = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "email",
          foreignField: "email",
          as: "user",
        })
        .sort({ createdAt: -1 })
        .project(project)
        .project({
          "existing_user.locationCount": 0,
          "existing_user.privilege": 0,
          "existing_user.website": 0,
          "existing_user.organization": 0,
          "existing_user.long_organization": 0,
          "existing_user.category": 0,
          "existing_user.jobTitle": 0,
          "existing_user.profilePicture": 0,
          "existing_user. phoneNumber": 0,
          "existing_user.description": 0,
          "existing_user.createdAt": 0,
          "existing_user.updatedAt": 0,
          "existing_user.notifications": 0,
          "existing_user.emailConfirmed": 0,
          "existing_user.password": 0,
          "existing_user.__v": 0,
          "existing_user.duration": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the candidates",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          message: "no candidates exist",
          data,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "unable to list the candidates",
        error: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let updatedCandidate = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedCandidate)) {
        let data = updatedCandidate._doc;
        return {
          success: true,
          message: "successfully modified the candidate",
          data,
        };
      } else {
        return {
          success: false,
          message: "candidate does not exist, please crosscheck",
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
        };
      } else {
        return {
          success: false,
          message: "candidate does not exist, please crosscheck",
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
    };
  },
};

module.exports = CandidateSchema;
