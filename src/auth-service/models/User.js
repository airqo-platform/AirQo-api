const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const jsonify = require("../utils/jsonify");
const validations = require("../utils/validations");
const isEmpty = require("is-empty");
const { log } = require("debug");
const saltRounds = constants.SALT_ROUNDS;
const HTTPStatus = require("http-status");

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
        return validations.passwordReg.test(password);
      },
      message: "{VALUE} is not a valid password, please check documentation!",
    },
  },
  privilege: {
    type: String,
    default: "user",
    required: [true, "the role is required!"],
    enum: ["user", "admin", "super", "netmanager"],
  },
  isActive: { type: Boolean },
  duration: { type: Date, default: oneMonthFromNow },
  organization: {
    type: String,
    required: [true, "the organization is required!"],
  },
  long_organization: {
    type: String,
    required: [true, "the long_organization is required!"],
  },
  country: { type: String },
  phoneNumber: { type: Number },
  locationCount: { type: Number, default: 5 },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  jobTitle: {
    type: String,
  },
  website: { type: String },
  description: { type: String },
  category: {
    type: String,
  },
  notifications: {
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    text: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
  },
  profilePicture: {
    type: String,
  },
});

UserSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    this.password = bcrypt.hashSync(this.password, saltRounds);
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
    this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  return next();
});

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userName: 1 }, { unique: true });

UserSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (data) {
        return {
          success: true,
          data,
          message: "user created",
        };
      }
      return {
        success: true,
        data,
        message: "operation successful but user NOT successfully created",
      };
    } catch (err) {
      let e = jsonify(err);
      logObject("the error", e);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      Object.entries(e.keyValue).forEach(([key, value]) => {
        return (response[key] = `the ${key} must be unique`);
      });
      logObject("the response", response);
      return {
        error: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      let users = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      let data = jsonify(users);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the users",
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "no users exist",
          data,
        };
      }
      return {
        success: false,
        message: "unable to retrieve users",
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: "User model server error - list",
        error: error.message,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      logObject("modifiedUpdate", modifiedUpdate);
      if (update.password) {
        modifiedUpdate.password = bcrypt.hashSync(update.password, saltRounds);
      }
      let udpatedUser = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      let data = jsonify(udpatedUser);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the user",
          data,
        };
      } else {
        return {
          success: false,
          message: "user does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "User model server error - modify",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      let removedUser = await this.findOneAndRemove(filter, options).exec();
      let data = jsonify(removedUser);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the user",
          data,
        };
      } else {
        return {
          success: false,
          message: "user does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "User model server error - remove",
        error: error.message,
      };
    }
  },
};

UserSchema.methods = {
  authenticateUser(password) {
    return bcrypt.compareSync(password, this.password);
  },
  createToken() {
    return jwt.sign(
      {
        _id: this._id,
        locationCount: this.locationCount,
        organization: this.organization,
        long_organization: this.long_organization,
        firstName: this.firstName,
        lastName: this.lastName,
        userName: this.userName,
        email: this.email,
        privilege: this.privilege,
        profilePicture: this.profilePicture,
        phoneNumber: this.phoneNumber,
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
      long_organization: this.long_organization,
      category: this.category,
      jobTitle: this.jobTitle,
      profilePicture: this.profilePicture,
      phoneNumber: this.phoneNumber,
    };
  },
};

module.exports = UserSchema;
