const mongoose = require("mongoose").set("debug", true);
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getTenantDB, getModelByTenant } = require("@config/database");

const logSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    level: { type: String, required: true },
    message: { type: String, required: true },
    meta: {
      type: {
        service: String,
        version: String,
        requestId: String,
        userId: String,
        username: String,
        email: String,
        timestamp: String,
        // clientIp: String,
        // hostName: String,
      },
      default: {},
    },
  },
  { timestamps: true }
);

logSchema.pre("save", function (next) {
  return next();
});

logSchema.pre("update", function (next) {
  return next();
});

logSchema.statics = {
  async register(args) {
    try {
      const newLog = await this.create({
        ...args,
      });
      if (!isEmpty(newLog)) {
        return {
          success: true,
          data: newLog._doc,
          message: "Log created",
        };
      } else if (isEmpty(newLog)) {
        return {
          success: true,
          data: [],
          message: "operation successful but Log NOT successfully created",
        };
      }
    } catch (err) {
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else if (err.code === 11000) {
        const duplicate_record = args.Log_name ? args.Log_name : args.Log_code;
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] =
          "the Log_name and Log_code must be unique for every Log";
      }

      return {
        error: response,
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },

  async list({ skip = 0, limit = 1000, filter = {} } = {}) {
    try {
      const logs = await this.aggregate()
        .match(filter)
        .sort({ timestamp: -1 })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 1000)
        .allowDiskUse(true);

      if (!isEmpty(logs)) {
        return {
          success: true,
          data: logs,
          message: "successfully listed the logs",
          status: httpStatus.OK,
        };
      } else if (isEmpty(logs)) {
        return {
          success: true,
          message: "logs not found for this operation",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Errors",
        error: error.message,
        errors: { message: error.message },
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);

      const updatedLog = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedLog)) {
        return {
          success: true,
          message: "successfully modified the Log",
          data: updatedLog._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedLog)) {
        return {
          success: false,
          message: "Log not found",
          errors: { message: "bad request" },
          status: httpStatus.BAD_REQUEST,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server errors",
        error: error.message,
        errors: { message: "internal server errors" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 1 },
      };
      const removedLog = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedLog)) {
        return {
          success: true,
          message: "successfully removed the Log",
          data: removedLog._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedLog)) {
        return {
          success: false,
          message: "Log does not exist, please crosscheck",
          data: [],
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Log does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server errors",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

logSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      meta: this.meta,
      timestamp: this.timestamp,
      level: this.level,
      message: this.message,
    };
  },
};

const LogModel = (tenant) => {
  try {
    const logs = mongoose.model("logs");
    return logs;
  } catch (error) {
    const logs = getModelByTenant(tenant, "log", logSchema);
    return logs;
  }
};

const LogDB = (tenant) => {
  return getTenantDB(tenant, "log", logSchema);
};

module.exports = { LogModel, LogDB, logSchema };
