//const DataAccess = require("../config/das");
const mongoose = require("mongoose");
const validator = require("validator");
const { passwordReg } = require("../utils/validations");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const ObjectId = mongoose.Schema.Types.ObjectId;

const LocSchema = new mongoose.Schema({
  country: {
    type: String,
    required: [true, "country is required!"],
    trim: true,
    unique: true
  },
  region: {
    type: String,
    required: [true, "country is required!"],
    trim: true,
    unique: true,
    default: "none"
  }
});

LocSchema.pre("save", function(next) {
  if (this.isModified("password")) {
    this.password = this._hashPassword(this.password);
  }
  return next();
});

LocSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      userName: this.userName
    };
  }
};

const loc = mongoose.model("loc", LocSchema);

module.exports = loc;
