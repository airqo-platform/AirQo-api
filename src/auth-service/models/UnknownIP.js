const mongoose = require("mongoose").set("debug", true);
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- unknown-ip-model`);
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");

function getDay() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const UnknownIPSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      unique: true,
      required: [true, "ip is required!"],
    },
    emails: {
      type: [{ type: String }],
      default: [],
    },
    tokens: {
      type: [{ type: String }],
      default: [],
    },
    token_names: {
      type: [{ type: String }],
      default: [],
    },
    endpoints: {
      type: [{ type: String }],
      default: [],
    },
    ipCounts: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        day: {
          type: String,
          default: getDay(),
        },
        count: {
          type: Number,
          default: 1,
        },
      },
    ],
  },
  { timestamps: true }
);

UnknownIPSchema.pre("save", function (next) {
  return next();
});

UnknownIPSchema.pre("findOneAndUpdate", function () {
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

UnknownIPSchema.pre("update", function (next) {
  return next();
});

UnknownIPSchema.index({ ip: 1 }, { unique: true });

UnknownIPSchema.statics = {
  async register(args) {
    try {
      let modifiedArgs = args;
      const data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "IP created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message: "operation successful but IP NOT successfully created",
          status: httpStatus.ACCEPTED,
        };
      }
    } catch (err) {
      logObject("the error", err);

      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }

      logger.error(`Internal Server Error -- ${err.message}`);
      throw new HttpError(
        "input validation errors",
        httpStatus.CONFLICT,
        response
      );
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      logObject("filtering here", filter);
      const inclusionProjection = constants.IPS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.IPS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 300)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the ip details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No ips found, please crosscheck provided details",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = Object.assign({}, update);

      const updatedIP = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      if (!isEmpty(updatedIP)) {
        return {
          success: true,
          message: "successfully modified the IP",
          data: updatedIP._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedIP)) {
        return {
          success: false,
          message: "IP does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "IP does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 0,
          ip: 1,
        },
      };

      const removedIP = await this.findOneAndRemove(filter, options).exec();

      logObject("removedIP", removedIP);

      if (!isEmpty(removedIP)) {
        return {
          success: true,
          message: "successfully removed the IP",
          data: removedIP._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedIP)) {
        return {
          success: false,
          message: "IP does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "IP does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
};

UnknownIPSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      ip: this.ip,
      emails: this.emails,
      tokens: this.tokens,
      token_names: this.token_names,
      endpoints: this.endpoints,
      ipCounts: this.ipCounts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const UnknownIPModel = (tenant) => {
  try {
    let ips = mongoose.model("UnknownIPs");
    return ips;
  } catch (error) {
    let ips = getModelByTenant(tenant, "UnknownIP", UnknownIPSchema);
    return ips;
  }
};

module.exports = UnknownIPModel;
