const mongoose = require("mongoose").set("debug", true);
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getTenantDB, getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- log-model`);

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const logSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    level: { type: String, required: true },
    message: { type: String, required: true },
    meta: {
      service: String,
      version: String,
      requestId: String,
      userId: String,
      username: String,
      token: String,
      email: String,
      timestamp: String,
      clientIp: String,
      hostName: String,
      endpoint: String,
      clientOriginalIp: String,
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        timestamp: 1,
        "meta.email": 1,
        "meta.service": 1,
        "meta.endpoint": 1,
      },
    ],
  }
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
          data: newLog._doc, // Preserve _doc usage
          message: "Log created",
          status: httpStatus.OK, // Add missing status
        };
      } else {
        return createEmptySuccessResponse(
          "log",
          "operation successful but Log NOT successfully created"
        );
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

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
        // Preserve complex duplicate handling for Log_name and Log_code
        const duplicate_record = args.Log_name ? args.Log_name : args.Log_code;
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] =
          "the Log_name and Log_code must be unique for every Log";
      } else {
        response = { message: err.message };
      }

      return {
        success: false,
        message,
        status,
        errors: response,
      };
    }
  },

  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const logs = await this.aggregate()
        .match(filter)
        .sort({ timestamp: -1 }) // Preserve timestamp sorting instead of createdAt
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 1000) // Preserve higher default limit
        .allowDiskUse(true);

      return createSuccessResponse("list", logs, "log", {
        message: "successfully listed the logs",
        emptyMessage: "logs not found for this operation",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "log");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = Object.assign({}, update);

      const updatedLog = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedLog)) {
        return createSuccessResponse("update", updatedLog._doc, "log");
      } else {
        return createNotFoundResponse("log", "update", "Log not found");
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "log");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: { _id: 1 }, // Preserve minimal projection
      };

      const removedLog = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedLog)) {
        return createSuccessResponse("delete", removedLog._doc, "log");
      } else {
        return createNotFoundResponse(
          "log",
          "delete",
          "Log does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "log");
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
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const logs = mongoose.model("logs");
    return logs;
  } catch (error) {
    const logs = getModelByTenant(dbTenant, "log", logSchema);
    return logs;
  }
};

const LogDB = (tenant) => {
  return getTenantDB(tenant, "log", logSchema);
};

module.exports = { LogModel, LogDB, logSchema };
