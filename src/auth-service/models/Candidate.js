//const DataAccess = require("../config/das");
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
  desc: { type: String, default: "none" },
  company: { type: String, default: "none" },
  country: { type: String, default: "Uganda" },
  jobTitle: { type: String, default: "none" },
  phoneNumber: { type: Number },
  user: { type: ObjectId, ref: "user" },
});

CandidateSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      firstName: this.firstName,
      lastName: this.lastName,
    };
  },
};

const candidate = mongoose.model("candidate", CandidateSchema);

module.exports = candidate;
