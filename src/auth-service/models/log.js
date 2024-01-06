const mongoose = require("mongoose").set("debug", true);
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getTenantDB, getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- log-model`);
const { HttpError } = require("@utils/errors");
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
        clientIp: String,
        hostName: String,
        endpoint: String,
        clientOriginalIp: String,
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
  async register(args, next) {
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

      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
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
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Log not found",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Log does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
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
