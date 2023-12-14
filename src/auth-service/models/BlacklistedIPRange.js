const mongoose = require("mongoose").set("debug", true);
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blacklist-ip-range-model`
);
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");

const BlacklistedIPRangeSchema = new mongoose.Schema(
  {
    range: {
      type: String,
      required: [true, "range is required!"],
    },
  },
  { timestamps: true }
);

BlacklistedIPRangeSchema.pre("save", function (next) {
  return next();
});

BlacklistedIPRangeSchema.pre("findOneAndUpdate", function () {
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

BlacklistedIPRangeSchema.pre("update", function (next) {
  return next();
});

BlacklistedIPRangeSchema.index({ range: 1 }, { unique: true });

BlacklistedIPRangeSchema.statics = {
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
          message: "IP Range created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message: "operation successful but IP Range NOT successfully created",
          status: httpStatus.ACCEPTED,
        };
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`Internal Server Error ${err.message}`);
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }

      throw new HttpError(
        "validation errors for some of the provided fields",
        httpStatus.CONFLICT,
        response
      );
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      logObject("filtering here", filter);
      const inclusionProjection = constants.IP_RANGES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.IP_RANGES_EXCLUSION_PROJECTION(
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
          message: "successfully retrieved the range details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No ips found, please crosscheck provided details",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
          message: "successfully modified the IP Range",
          data: updatedIP._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedIP)) {
        return {
          success: false,
          message: "IP Range does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "IP Range does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
          range: 1,
        },
      };

      const removedIP = await this.findOneAndRemove(filter, options).exec();

      logObject("removedIP", removedIP);

      if (!isEmpty(removedIP)) {
        return {
          success: true,
          message: "successfully removed the IP Range",
          data: removedIP._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedIP)) {
        return {
          success: false,
          message: "IP Range does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "IP Range does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
};

BlacklistedIPRangeSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      range: this.range,
    };
  },
};

const BlacklistedIPRangeModel = (tenant) => {
  try {
    let ips = mongoose.model("BlacklistedIPRanges");
    return ips;
  } catch (error) {
    let ips = getModelByTenant(
      tenant,
      "BlacklistedIPRange",
      BlacklistedIPRangeSchema
    );
    return ips;
  }
};

module.exports = BlacklistedIPRangeModel;
