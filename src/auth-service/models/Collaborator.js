//const DataAccess = require("../config/das");
const mongoose = require("mongoose");
const validator = require("validator");
const { passwordReg } = require("../utils/validations");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const ObjectId = mongoose.Schema.Types.ObjectId;

const ColabSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required"],
    trim: true,
    validate: {
      validator(email) {
        return validator.isEmail(email);
      },
      message: "{VALUE} is not a valid email!"
    }
  },
  firstName: {
    type: String,
    required: [true, "FirstName is required!"],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, "LastName is required"],
    trim: true
  },
  userName: {
    type: String,
    required: [true, "UserName is required!"],
    trim: true,
    unique: true
  },
  password: {
    type: String,
    required: [true, "Password is required!"],
    trim: true,
    minlength: [6, "Password is required"],
    validate: {
      validator(password) {
        return passwordReg.test(password);
      },
      message: "{VALUE} is not a valid password!"
    }
  },
  admin: { type: ObjectId, ref: "user" }
});

ColabSchema.pre("save", function(next) {
  if (this.isModified("password")) {
    this.password = this._hashPassword(this.password);
  }
  return next();
});

ColabSchema.methods = {
  _hashPassword(password) {
    // bcrypt.hash(password, saltRounds).then(function (hash) {
    //     return hash;
    // })
    return bcrypt.hashSync(password, saltRounds);
  },
  authenticateUser(password) {
    // bcrypt.compare(password, this.password).then(function (res) {
    //     return res;
    // })
    return bcrypt.compareSync(password, this.password);
  },
  createToken() {
    return jwt.sign(
      {
        _id: this._id
      },
      constants.JWT_SECRET
    );
  },
  toAuthJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      token: `JWT ${this.createToken()}`
    };
  },
  toJSON() {
    return {
      _id: this._id,
      userName: this.userName
    };
  }
};

const colab = mongoose.model("colab", ColabSchema);

module.exports = colab;
