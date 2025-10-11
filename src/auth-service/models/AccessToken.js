const mongoose = require("mongoose");

const ObjectId = mongoose.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- token-model`);
const { logObject } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const moment = require("moment-timezone");

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
  createTokenResponse,
} = require("@utils/shared");

const toMilliseconds = (hrs, min, sec) => {
  return (hrs * 60 * 60 + min * 60 + sec) * 1000;
};

const emailVerificationHours = parseInt(constants.EMAIL_VERIFICATION_HOURS);
const emailVerificationMins = parseInt(constants.EMAIL_VERIFICATION_MIN);
const emailVerificationSeconds = parseInt(constants.EMAIL_VERIFICATION_SEC);

const AccessTokenSchema = new mongoose.Schema(
  {
    client_id: {
      type: ObjectId,
      ref: "client",
      unique: true,
      required: [true, "client_id is required!"],
    },
    permissions: [{ type: ObjectId, ref: "permission" }],
    scopes: [{ type: ObjectId, ref: "scope" }],
    name: { type: String, required: [true, "name is required!"] },
    token: {
      type: String,
      unique: true,
      required: [true, "token is required!"],
    },
    last_used_at: { type: Date },
    last_ip_address: { type: String },
    expires_in: { type: Number },
    expires: {
      type: Date,
      required: [true, "expiry date is required!"],
    },
    expiredEmailSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

AccessTokenSchema.pre("save", function (next) {
  return next();
});

AccessTokenSchema.pre("update", function (next) {
  return next();
});

AccessTokenSchema.index({ token: 1 }, { unique: true });
AccessTokenSchema.index({ client_id: 1 }, { unique: true });

AccessTokenSchema.statics = {
  async findToken(authorizationToken, next) {
    try {
      if (authorizationToken) {
        let accessToken;

        // Preserve complex token parsing logic (hash vs split token)
        if (!authorizationToken.includes("|")) {
          accessToken = await this.findOne({
            where: { token: hash(authorizationToken) },
            include: "owner",
          });
        } else {
          const [id, kToken] = authorizationToken.split("|", 2);
          const instance = await this.findByPk(id, { include: "owner" });
          if (instance) {
            accessToken = hash_compare(instance.token, hash(kToken))
              ? instance
              : null;
          }
        }

        if (!accessToken) return createTokenResponse(null, null, "access");

        // Preserve last_used_at update logic
        accessToken.last_used_at = new Date(Date.now());
        await accessToken.save();

        return createTokenResponse(
          accessToken.owner,
          accessToken.token,
          "access"
        );
      }

      return createTokenResponse(null, null, "access");
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
        user: null,
        currentAccessToken: null,
      };
    }
  },

  async register(args, next) {
    try {
      let modifiedArgs = args;

      // Preserve complex expiration logic based on category
      if (isEmpty(modifiedArgs.expires)) {
        if (modifiedArgs.category && modifiedArgs.category === "api") {
          modifiedArgs.expires =
            Date.now() +
            toMilliseconds(
              5110, // hours in 7 months
              0,
              0
            );
        } else {
          modifiedArgs.expires =
            Date.now() +
            toMilliseconds(
              emailVerificationHours,
              emailVerificationMins,
              emailVerificationSeconds
            );
        }
      }

      const data = await this.create({
        // Fixed: was undeclared variable
        ...modifiedArgs,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "access token", {
          message: "Token created",
        });
      } else {
        return createEmptySuccessResponse(
          "access token",
          "operation successful but Token NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err); // Preserve custom logging
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);

      // Handle specific duplicate key errors
      if (err.keyValue) {
        let response = {};
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.CONFLICT,
          errors: response,
        };
      } else {
        return createErrorResponse(err, "create", logger, "access token");
      }
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      logObject("filtering here", filter);
      const inclusionProjection = constants.TOKENS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.TOKENS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "clients",
          localField: "client_id",
          foreignField: "_id",
          as: "client",
        })
        .lookup({
          from: "permissions",
          localField: "permissions",
          foreignField: "_id",
          as: "permissions",
        })
        .lookup({
          from: "scopes",
          localField: "scopes",
          foreignField: "_id",
          as: "scopes",
        })
        .lookup({
          from: "users",
          localField: "client.user_id",
          foreignField: "_id",
          as: "user",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 300) // Preserve higher default limit (300)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "access token", {
        message: "successfully retrieved the token details",
        emptyMessage: "No tokens found, please crosscheck provided details",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "access token");
    }
  },

  async getExpiredTokens({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.TOKENS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.TOKENS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      // Preserve timezone-aware date handling
      const currentDate = moment().tz(moment.tz.guess()).toDate();

      const response = await this.aggregate()
        .match({
          expires: { $lt: currentDate },
          ...filter,
        })
        .lookup({
          from: "clients",
          localField: "client_id",
          foreignField: "_id",
          as: "client",
        })
        .lookup({
          from: "users",
          localField: "client.user_id",
          foreignField: "_id",
          as: "user",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "expired access token", {
        message: "Successfully retrieved expired tokens",
        emptyMessage: "No expired tokens found",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "expired access token");
    }
  },

  async getExpiringTokens({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.TOKENS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.TOKENS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      // Preserve timezone-aware date calculations
      const currentDate = moment().tz(moment.tz.guess()).toDate();
      const oneMonthFromNow = moment(currentDate).add(1, "month").toDate();

      const response = await this.aggregate()
        .match({
          expires: { $gt: currentDate, $lt: oneMonthFromNow },
          ...filter,
        })
        .lookup({
          from: "clients",
          localField: "client_id",
          foreignField: "_id",
          as: "client",
        })
        .lookup({
          from: "users",
          localField: "client.user_id",
          foreignField: "_id",
          as: "user",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "expiring access token", {
        message: "Successfully retrieved tokens expiring within the next month",
        emptyMessage: "No tokens found expiring within the next month",
      });
    } catch (error) {
      return createErrorResponse(
        error,
        "list",
        logger,
        "expiring access token"
      );
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);

      // Preserve immutable field deletion logic
      if (!isEmpty(modifiedUpdate.user_id)) {
        delete modifiedUpdate.user_id;
      }
      if (!isEmpty(modifiedUpdate.client_id)) {
        delete modifiedUpdate.client_id;
      }

      const updatedToken = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedToken)) {
        return createSuccessResponse(
          "update",
          updatedToken._doc,
          "access token"
        );
      } else {
        return createNotFoundResponse(
          "access token",
          "update",
          "Token does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "access token");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          token: 1,
          network_id: 1,
          user_id: 1,
          expires_in: 1, // Preserve access token specific projections
        },
      };

      const removedToken = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedToken)) {
        return createSuccessResponse(
          "delete",
          removedToken._doc,
          "access token"
        );
      } else {
        logger.error("Token does not exist, please crosscheck"); // Preserve custom logging
        return createNotFoundResponse(
          "access token",
          "delete",
          "Token does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "access token");
    }
  },
};

AccessTokenSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      token: this.token,
      client_id: this.client_id,
      permissions: this.permissions,
      scopes: this.scopes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      name: this.name,
      last_used_at: this.last_used_at,
      last_ip_address: this.last_ip_address,
      expires: this.expires,
    };
  },
};

const AccessTokenModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let tokens = mongoose.model("access_tokens");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(dbTenant, "access_token", AccessTokenSchema);
    return tokens;
  }
};

module.exports = AccessTokenModel;
