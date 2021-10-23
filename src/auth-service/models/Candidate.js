const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { logObject, logElement } = require("../utils/log");
const isEmpty = require("is-empty");

const CandidateSchema = new mongoose.Schema({
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
});

CandidateSchema.statics = {
  register(args) {
    try {
      return {
        success: true,
        data: this.create({
          ...args,
        }),
        message: "candidate created",
      };
    } catch (error) {
      return {
        error: error.message,
        message: "unable to create candidate",
        success: false,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
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
        };
      } else {
        return {
          success: true,
          message: "no candidates exist",
          data,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "unable to list the candidates",
        error: error.message,
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
    };
  },
};

module.exports = CandidateSchema;
