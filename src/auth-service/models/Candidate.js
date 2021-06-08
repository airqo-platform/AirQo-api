const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;

const CandidateSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    trim: true,
    unique: true,
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
  organization: { type: String, required: [true, "organization is required"] },
  jobTitle: { type: String, required: [true, "jobTitle is required"] },
  category: { type: String, required: [true, "category is required"] },
  website: { type: String, required: [true, "website is required"] },
  isDenied: {
    type: Boolean,
  },
  status: {
    type: String,
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
  list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      let data = this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      return {
        success: true,
        data,
        message: "successfully listed the candidates",
      };
    } catch (error) {
      return {
        success: false,
        message: "unable to list the candidates",
        error: error.message,
      };
    }
  },
  modify({ filter = {}, update = {} } = {}) {
    try {
      options = { new: true };
      this.findOneAndUpdate(filter, update, (error, response) => {
        if (response) {
          return {
            success: true,
            message: "the candidate details have successfully been modified",
            data: update,
          };
        } else if (error) {
          return {
            success: false,
            message: "unable to update the candidate",
            error,
          };
        } else {
          return {
            success: false,
            message: "unable to update the candidate",
          };
        }
      });
    } catch (error) {
      return {
        success: false,
        message: "unable to update the candidate",
        error: error.message,
      };
    }
  },
  remove({ filter = {} } = {}) {
    try {
      let options = { sort: 1 };
      this.findOneAndRemove(filter, options, (error, response) => {
        if (response) {
          return {
            success: true,
            message: "successfully removed the candidate",
            data: response,
          };
        } else if (error) {
          return {
            success: false,
            message: "unable to remove the candidate",
            error,
          };
        } else {
          return {
            success: false,
            message: "unable to remove the candidate",
          };
        }
      });
    } catch (error) {
      return {
        success: false,
        message: "unable to remove the candidate",
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
      organization: this.organization,
      jobTitle: this.jobTitle,
      website: this.website,
    };
  },
};

module.exports = CandidateSchema;
