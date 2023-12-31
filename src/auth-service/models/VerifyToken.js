const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- token-model`);
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");

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

        if (!verifyToken) return { user: null, currentVerifyToken: null };

        verifyToken.last_used_at = new Date(Date.now());
        await verifyToken.save();
        return {
          user: verifyToken.owner,
          currentVerifyToken: verifyToken.token,
        };
      }
      return { user: null, currentVerifyToken: null };
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async register(args, next) {
    try {
      let modifiedArgs = args;
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

      data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Token created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message: "operation successful but Token NOT successfully created",
          status: httpStatus.ACCEPTED,
        };
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }

      logger.error(`Internal Server Error -- ${err.message}`);
      next(
        new HttpError("input validation errors", httpStatus.CONFLICT, response)
      );
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
        .limit(limit ? limit : 300)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the token details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No tokens found, please crosscheck provided details",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
        return {
          success: true,
          message: "successfully modified the Token",
          data: updatedToken._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedToken)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Token does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
          token: 1,
          name: 1,
          expires_in: 1,
        },
      };

      const removedToken = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedToken)) {
        return {
          success: true,
          message: "successfully removed the Token",
          data: removedToken._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedToken)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Token does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
  try {
    let tokens = mongoose.model("verify_tokens");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(tenant, "verify_token", VerifyTokenSchema);
    return tokens;
  }
};

module.exports = VerifyTokenModel;
