const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const jsonify = require("../utils/jsonify");
const validations = require("../utils/validations");
const isEmpty = require("is-empty");
const { log } = require("debug");

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
  privilege: { type: String, required: [true, "the role is required!"] },
  isActive: { type: Boolean },
  duration: { type: Date, default: oneMonthFromNow },
  organization: {
    type: String,
    required: [true, "the organization is required!"],
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

// UserSchema.pre("findOneAndUpdate", async function () {
//   let that = this;
//   let docToUpdate = await this.model.findOne(this.getQuery());
//   let docToUpdateJSON = jsonify(docToUpdate);
//   logObject("docToUpdateJSON", docToUpdateJSON);
//   docToUpdate.password = that._hashPassword(docToUpdateJSON.password);
//   return next();
// });

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userName: 1 }, { unique: true });

UserSchema.statics = {
  async register(args) {
    logObject("the args", args);
    try {
      return {
        success: true,
        data: this.create({
          ...args,
        }),
        message: "user created",
      };
    } catch (error) {
      return {
        error: error.message,
        message: "User model server error",
        success: false,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      logText("we are listing in the model");
      logObject("the filter in the model", filter);
      let response = {};
      let users = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      let data = jsonify(users);
      logObject("the data", data);
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
        success: true,
        message: "unable to retrieve users",
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      logObject("modifiedUpdate", modifiedUpdate);
      logObject("update", update);
      modifiedUpdate.password = this._hashPassword(update.password);
      let udpatedUser = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      let data = jsonify(udpatedUser);
      logObject("updatedUser", data);

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
      let removedUser = await this.findOneAndRemove(filter, options).exec();
      logElement("removedUser", removedUser);
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
        message: "model server error",
        error: error.message,
      };
    }
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
        locationCount: this.locationCount,
        organization: this.organization,
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
      category: this.category,
      jobTitle: this.jobTitle,
      profilePicture: this.profilePicture,
      phoneNumber: this.phoneNumber,
    };
  },
};

module.exports = UserSchema;
