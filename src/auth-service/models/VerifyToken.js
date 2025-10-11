const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- token-model`);
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
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

const VerifyTokenSchema = new mongoose.Schema(
  {
    name: { type: String },
    token: {
      type: String,
      unique: true,
      required: [true, "token is required!"],
    },
    last_used_at: { type: Date },
    last_ip_address: { type: Date },
    expires_in: { type: Number },
    expires: {
      type: Date,
      required: [true, "expiry date is required!"],
    },
  },
  { timestamps: true }
);

VerifyTokenSchema.pre("save", function (next) {
  return next();
});

VerifyTokenSchema.pre("update", function (next) {
  return next();
});

VerifyTokenSchema.index({ token: 1 }, { unique: true });

VerifyTokenSchema.statics = {
  async findToken(authorizationToken, next) {
    try {
      if (authorizationToken) {
        let verifyToken;

        // Preserve complex token parsing logic (hash vs split token)
        if (!authorizationToken.includes("|")) {
          verifyToken = await this.findOne({
            where: { token: hash(authorizationToken) },
            include: "owner",
          });
        } else {
          const [id, kToken] = authorizationToken.split("|", 2);
          const instance = await this.findByPk(id, { include: "owner" });
          if (instance) {
            verifyToken = hash_compare(instance.token, hash(kToken))
              ? instance
              : null;
          }
        }

        if (!verifyToken) return createTokenResponse(null, null, "verify");

        // Preserve last_used_at update logic
        verifyToken.last_used_at = new Date(Date.now());
        await verifyToken.save();

        return createTokenResponse(
          verifyToken.owner,
          verifyToken.token,
          "verify"
        );
      }

      return createTokenResponse(null, null, "verify");
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
        user: null,
        currentVerifyToken: null,
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
        return createSuccessResponse("create", data, "verify token", {
          message: "Token created",
        });
      } else {
        return createEmptySuccessResponse(
          "verify token",
          "operation successful but Token NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

      let response = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;

      if (err.code === 11000 || err.code === 11001) {
        message = "input validation errors"; // Preserve specific error message
        status = httpStatus.CONFLICT;
        if (err.keyValue) {
          Object.entries(err.keyValue).forEach(([key, value]) => {
            return (response[key] = `the ${key} must be unique`);
          });
        }
      } else if (err.errors) {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
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
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 300) // Preserve higher default limit (300)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "verify token", {
        message: "successfully retrieved the token details",
        emptyMessage: "No tokens found, please crosscheck provided details",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "verify token");
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
          "verify token"
        );
      } else {
        return createNotFoundResponse(
          "verify token",
          "update",
          "Token does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "verify token");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          token: 1,
          name: 1,
          expires_in: 1, // Preserve token-specific projections
        },
      };

      const removedToken = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedToken)) {
        return createSuccessResponse(
          "delete",
          removedToken._doc,
          "verify token"
        );
      } else {
        return createNotFoundResponse(
          "verify token",
          "delete",
          "Token does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "verify token");
    }
  },
};

VerifyTokenSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      token: this.token,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      name: this.name,
      last_used_at: this.last_used_at,
      last_ip_address: this.last_ip_address,
      expires: this.expires,
    };
  },
};

const VerifyTokenModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let tokens = mongoose.model("verify_tokens");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(dbTenant, "verify_token", VerifyTokenSchema);
    return tokens;
  }
};

module.exports = VerifyTokenModel;
