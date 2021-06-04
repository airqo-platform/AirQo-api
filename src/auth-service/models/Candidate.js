const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Schema.Types.ObjectId;

const CandidateSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
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
  createCandidate(args) {
    return this.create({
      ...args,
    });
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
