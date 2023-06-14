const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { logObject, logElement } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- candidate-model`);

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
    network_id: {
      type: ObjectId,
      required: [true, "network_id is required!"],
      trim: true,
      ref: "network",
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
    country: { type: String, required: [true, "country is required"] },
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
  async register(args) {
    try {
      let newArgs = Object.assign({}, args);
      if (isEmpty(newArgs.network_id)) {
        newArgs.network_id = constants.DEFAULT_NETWORK;
        logObject("newArgs.network_id", newArgs.network_id);
      }
      const data = await this.create({
        ...newArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "candidate created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message:
            "operation successful but candidate NOT successfully created",
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        errors: { message: error.message },
        message: "unable to create candidate",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const inclusionProjection = constants.CANDIDATES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.CANDIDATES_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );
      const data = await this.aggregate()

        .match(filter)
        .lookup({
          from: "users",
          localField: "email",
          foreignField: "email",
          as: "user",
        })
        .lookup({
          from: "networks",
          localField: "network_id",
          foreignField: "_id",
          as: "network",
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
          message: "successfully listed the candidates",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          message: "no candidates exist",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        success: false,
        message: "unable to list the candidates",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      const updatedCandidate = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedCandidate)) {
        return {
          success: true,
          message: "successfully modified the candidate",
          data: updatedCandidate._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedCandidate)) {
        return {
          success: false,
          message: "candidate does not exist, please crosscheck",
          errors: { message: "candidate does not exist, please crosscheck" },
          status: httpStatus.BAD_REQUEST,
        };
      }
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
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
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      const removedCandidate = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedCandidate)) {
        return {
          success: true,
          message: "successfully removed the candidate",
          data: removedCandidate._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedCandidate)) {
        return {
          success: false,
          message: "candidate does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "candidate does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
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
      network_id: this.network_id,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      country: this.country,
    };
  },
};

module.exports = CandidateSchema;
