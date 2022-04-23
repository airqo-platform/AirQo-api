const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const saltRounds = constants.SALT_ROUNDS;
const HTTPStatus = require("http-status");
const datesUtil = require("../utils/date");
const ObjectId = mongoose.Schema.Types.ObjectId;

const UserSchema = new Schema(
  {
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
      required: [true, "firstName is required!"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "lastName is required"],
      trim: true,
    },
    userName: {
      type: String,
      required: [true, "userName is required!"],
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required!"],
      trim: true,
    },
    privilege: { type: String, required: [true, "the role is required!"] },
    isActive: { type: Boolean },
    duration: { type: Date, default: datesUtil.monthsInfront(1) },
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
    emailVerified: {
      type: Boolean,
      default: false,
    },
    confirmationCode: {
      type: String,
    },
    roles: [
      {
        type: ObjectId,
        ref: "Role",
      },
    ],
  },
  { timestamps: true }
);

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
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }

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
      if (!isEmpty(users)) {
        let data = users;
        return {
          success: true,
          data,
          message: "successfully retrieved the users",
        };
      } else if (isEmpty(users)) {
        return {
          success: true,
          message: "no users exist",
          data: [],
        };
      }
      return {
        success: false,
        message: "unable to retrieve users",
        data: [],
      };
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      if (update.password) {
        modifiedUpdate.password = bcrypt.hashSync(update.password, saltRounds);
      }
      let updatedUser = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      if (!isEmpty(updatedUser)) {
        let data = updatedUser._doc;
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

      if (!isEmpty(removedUser)) {
        let data = removedUser._doc;
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
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      verified: this.verified,
    };
  },
};

module.exports = UserSchema;
