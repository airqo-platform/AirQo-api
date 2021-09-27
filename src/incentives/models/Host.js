const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const { logObject, logElement, logText } = require("../utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const jsonify = require("../utils/jsonify");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("../utils/multitenancy");

const HostSchema = new Schema({
  first_name: {
    type: String,
    required: [true, "first_name is required!"],
    trim: true,
  },
  last_name: {
    type: String,
    required: [true, "last_name is required"],
    trim: true,
  },
  phone_number: {
    type: Number,
    required: [true, "phone_number is required"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "email is required"],
    trim: true,
  },
  site_id: {
    type: ObjectId,
    required: [true, "site_id is required"],
    trim: true,
  },
  device_id: {
    type: ObjectId,
    required: [true, "device_id is required"],
    trim: true,
  },
});

HostSchema.pre("save", function (next) {
  if (this.isModified("password")) {
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
  return next();
});

HostSchema.statics = {
  async register(args) {
    logObject("the args", args);
    try {
      return {
        success: true,
        data: this.create({
          ...args,
        }),
        message: "host created",
      };
    } catch (error) {
      return {
        error: { message: error.message },
        message: "Host model server error - register",
        success: false,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      let hosts = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      let data = jsonify(hosts);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the hosts",
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "no hosts exist",
          data,
        };
      }
      return {
        success: false,
        message: "unable to retrieve hosts",
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: "Host model server error - list",
        error: { message: error.message },
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
      let updatedHost = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      let data = jsonify(updatedHost);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the host",
          data,
        };
      } else {
        return {
          success: false,
          message: "host does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Host model server error - modify",
        error: { message: error.message },
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      let removedHost = await this.findOneAndRemove(filter, options).exec();
      let data = jsonify(removedHost);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the host",
          data,
        };
      } else {
        return {
          success: false,
          message: "host does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Host model server error - remove",
        error: { message: error.message },
      };
    }
  },
};

HostSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      first_name: this.first_name,
      last_name: this.last_name,
      site_id: this.site_id,
      device_id: this.device_id,
      phone_number: this.phone_number,
    };
  },
};

const HostModel = (tenant) => {
  return getModelByTenant(tenant, "host", HostSchema);
};

module.exports = HostModel;
