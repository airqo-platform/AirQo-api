const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blacklisted-ip-prefix-model`
);
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");

const BlacklistedIPPrefixSchema = new mongoose.Schema(
  {
    prefix: {
      type: String,
      unique: true,
      required: [true, "prefix is required!"],
    },
  },
  { timestamps: true }
);

BlacklistedIPPrefixSchema.pre("save", function (next) {
  return next();
});

BlacklistedIPPrefixSchema.pre("update", function (next) {
  return next();
});

BlacklistedIPPrefixSchema.index({ prefix: 1 }, { unique: true });

BlacklistedIPPrefixSchema.statics = {
  async register(args, next) {
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
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }
      next(
        new HttpError(
          "validation errors for some of the provided fields",
          httpStatus.CONFLICT,
          response
        )
      );
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.IP_PREFIX_INCLUSION_PROJECTION;
      const exclusionProjection = constants.IP_PREFIX_EXCLUSION_PROJECTION(
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
          message: "successfully retrieved the prefix details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No prefix found, please crosscheck provided details",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "IP does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
        projection: {
          _id: 0,
          prefix: 1,
        },
      };
      const removedIP = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedIP)) {
        return {
          success: true,
          message: "successfully removed the IP",
          data: removedIP._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedIP)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "IP does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

BlacklistedIPPrefixSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      prefix: this.prefix,
    };
  },
};

const BlacklistedIPPrefixModel = (tenant) => {
  try {
    let prefix = mongoose.model("BlacklistedIPPrefixes");
    return prefix;
  } catch (error) {
    let prefix = getModelByTenant(
      tenant,
      "BlacklistedIPPrefix",
      BlacklistedIPPrefixSchema
    );
    return prefix;
  }
};

module.exports = BlacklistedIPPrefixModel;
