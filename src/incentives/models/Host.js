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

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const HostSchema = new Schema({
  first_name: {
    type: String,
    required: [true, "FirstName is required!"],
    trim: true,
  },
  last_name: {
    type: String,
    required: [true, "LastName is required"],
    trim: true,
  },
  phone_number: {
    type: Number,
  },
  email: {
    type: String,
  },
  site_id: {
    type: ObjectId,
  },
  device_id: {
    type: ObjectId,
  },
});

HostSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    // this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  return next();
});

HostSchema.pre("findOneAndUpdate", function () {
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

HostSchema.pre("update", function (next) {
  if (this.isModified("password")) {
    // this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  return next();
});

HostSchema.index({ email: 1 }, { unique: true });

HostSchema.statics = {
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
        message: "User model server error - register",
        success: false,
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
        // modifiedUpdate.password = bcrypt.hashSync(update.password, saltRounds);
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

HostSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      firstName: this.firstName,
      lastName: this.lastName,
      site_id: this.site_id,
      device_id: this.device_id,
    };
  },
};

module.exports = HostSchema;
