const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- unknown-ip-model`);
const { getModelByTenant } = require("@config/database");
const ObjectId = mongoose.ObjectId;
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

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
    client_ids: {
      type: [{ type: ObjectId }],
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

UnknownIPSchema.pre("update", function (next) {
  return next();
});

UnknownIPSchema.index({ ip: 1, "ipCounts.day": 1 }, { unique: true });

UnknownIPSchema.statics = {
  async register(args, next) {
    try {
      const modifiedArgs = args;
      const data = await this.create({
        ...modifiedArgs,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "unknown IP", {
          message: "IP created",
        });
      } else {
        return createEmptySuccessResponse(
          "unknown IP",
          "operation successful but IP NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

      // Handle specific duplicate key errors
      if (err.keyValue) {
        let response = {};
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
        return {
          success: false,
          message: "input validation errors", // Preserve specific error message
          status: httpStatus.CONFLICT,
          errors: response,
        };
      } else {
        return createErrorResponse(err, "create", logger, "unknown IP");
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
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
        .lookup({
          from: "clients",
          localField: "client_ids",
          foreignField: "_id",
          as: "clients",
        })
        .lookup({
          from: "users",
          localField: "clients.user_id",
          foreignField: "_id",
          as: "users",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 300) // Preserve higher default limit (300)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "unknown IP", {
        message: "successfully retrieved the ip details",
        emptyMessage: "No ips found, please crosscheck provided details",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "unknown IP");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = Object.assign({}, update);

      const updatedIP = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedIP)) {
        return createSuccessResponse("update", updatedIP._doc, "unknown IP", {
          message: "successfully modified the IP",
        });
      } else {
        return createNotFoundResponse(
          "unknown IP",
          "update",
          "IP does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "unknown IP");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          ip: 1, // Preserve ip field projection
        },
      };

      const removedIP = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedIP)) {
        return createSuccessResponse("delete", removedIP._doc, "unknown IP", {
          message: "successfully removed the IP",
        });
      } else {
        return createNotFoundResponse(
          "unknown IP",
          "delete",
          "IP does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "unknown IP");
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
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let ips = mongoose.model("UnknownIPs");
    return ips;
  } catch (error) {
    let ips = getModelByTenant(dbTenant, "UnknownIP", UnknownIPSchema);
    return ips;
  }
};

module.exports = UnknownIPModel;
