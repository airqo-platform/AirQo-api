const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const { passwordReg } = require("../utils/validations");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const ObjectId = mongoose.Schema.Types.ObjectId;

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const UserSchema = new Schema({
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
  emailConfirmed: {
    type: Boolean,
    default: false,
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
  userName: {
    type: String,
    required: [true, "UserName is required!"],
    trim: true,
    unique: true,
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
      message: "{VALUE} is not a valid password!",
    },
  },
  privilege: { type: String },
  isActive: { type: Boolean },
  duration: { type: Date, default: oneMonthFromNow },
  organisation: { type: String },
  country: { type: String },
  phoneNumber: { type: Number },
  locationCount: { type: Number },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  jobTitle: {
    type: String,
  },
  website: { type: String },
  category: {
    type: String,
  },
  notifications: {
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    text: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
  },
});

UserSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    this.password = this._hashPassword(this.password);
  }
  return next();
});

UserSchema.pre("findOneAndUpdate", function () {
  let that = this;
  const update = that.getUpdate();
  if (update.__v != null) {
    delete update.__v;
  }
  const keys = ["$set", "$setOnInsert"];
  for (const key of keys) {
    if (update[key] != null && update[key].__v != null) {
      delete update[key].__v;
      if (Object.keys(update[key]).length === 0) {
        delete update[key];
      }
    }
  }
  update.$inc = update.$inc || {};
  update.$inc.__v = 1;
});

UserSchema.pre("update", function (next) {
  if (this.isModified("password")) {
    this.password = this._hashPassword(this.password);
  }
  return next();
});

UserSchema.pre("findByIdAndUpdate", function (next) {
  this.options.runValidators = true;
  if (this.isModified("password")) {
    this.password = this._hashPassword(this.password);
  }
  return next();
});

UserSchema.statics = {
  createUser(args) {
    return this.create({
      ...args,
    });
  },
};

UserSchema.methods = {
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
        _id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        userName: this.userName,
        email: this.email,
        privilege: this.privilege,
        locationCount: this.locationCount,
        organization: this.organization,
      },
      constants.JWT_SECRET
    );
  },
  toAuthJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      token: `JWT ${this.createToken()}`,
      email: this.email,
    };
  },
  toJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      locationCount: this.locationCount,
      privilege: this.privilege,
      website: this.website,
      organization: this.organization,
      category: this.category,
      jobTitle: this.jobTitle,
    };
  },
};

module.exports = UserSchema;
