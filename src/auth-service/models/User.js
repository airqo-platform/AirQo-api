const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const validations = require("../utils/validations");
const isEmpty = require("is-empty");
const { log } = require("debug");
const saltRounds = constants.SALT_ROUNDS;
const HTTPStatus = require("http-status");
const AdminJS = require("adminjs");
const AdminJSMongoose = require("@adminjs/mongoose");
AdminJS.registerAdapter(AdminJSMongoose);

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

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
    organizations: [
      {
        type: ObjectId,
        ref: "organization",
      },
    ],
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
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "organizations",
          localField: "_id",
          foreignField: "users",
          as: "organizations",
        })
        .lookup({
          from: "access_tokens",
          localField: "_id",
          foreignField: "userId",
          as: "access_token",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          locationCount: 1,
          organization: 1,
          long_organization: 1,
          firstName: 1,
          lastName: 1,
          userName: 1,
          email: 1,
          privilege: 1,
          profilePicture: 1,
          phoneNumber: 1,
          organizations: "$organizations",
          access_token: { $arrayElemAt: ["$access_token", 0] },
        })
        .project({
          "organizations.__v": 0,
          "organizations.status": 0,
          "organizations.isActive": 0,
          "organizations.isAlias": 0,
          "organizations.tenant": 0,
          "organizations.acronym": 0,
          "organizations.createdAt": 0,
          "organizations.updatedAt": 0,
          "organizations.users": 0,
        })
        .project({
          "access_token.__v": 0,
          "access_token._id": 0,
          "access_token.userId": 0,
          "access_token.createdAt": 0,
          "access_token.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);
      if (!isEmpty(response)) {
        let data = response;
        return {
          success: true,
          message: "successfully retrieved the user details",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "user/s do not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      modifiedUpdate["$addToSet"] = {};
      if (update.password) {
        modifiedUpdate.password = bcrypt.hashSync(update.password, saltRounds);
      }
      if (modifiedUpdate.organizations) {
        modifiedUpdate["$addToSet"]["organizations"] = {};
        modifiedUpdate["$addToSet"]["organizations"]["$each"] =
          modifiedUpdate.organizations;
        delete modifiedUpdate["organizations"];
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
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "user does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "User model server error - remove",
        error: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
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
    };
  },
};

module.exports = UserSchema;
