const mongoose = require("mongoose").set("debug", true);
const { logObject, logElement, logText } = require("@utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
// const saltRounds = constants.SALT_ROUNDS;
// const bcrypt = require("bcrypt");

/**
 * belongs to a user
 * a User has many access tokens
 */

const toMilliseconds = (hrs, min, sec) =>
  (hrs * 60 * 60 + min * 60 + sec) * 1000;

const hrs = parseInt(constants.EMAIL_VERIFICATION_HOURS);
const min = parseInt(constants.EMAIL_VERIFICATION_MIN);
const sec = parseInt(constants.EMAIL_VERIFICATION_SEC);

const AccessTokenSchema = new mongoose.Schema(
  {
    user_id: {
      type: ObjectId,
      ref: "user",
      required: [true, "user is required!"],
    },
    client_id: {
      type: String,
      required: [true, "client_id is required!"],
    },
    permissions: [{ type: ObjectId, ref: "permission" }],
    scopes: [{ type: ObjectId, ref: "scope" }],
    network_id: {
      type: ObjectId,
      ref: "network",
    },
    name: { type: String },
    token: {
      type: String,
      unique: true,
      required: [true, "token is required!"],
    },
    last_used_at: { type: Date },
    last_ip_address: { type: Date },
    expires_in: { type: Number, default: hrs },
    expires: {
      type: Date,
      required: [true, "expiry date is required!"],
      default: Date.now() + toMilliseconds(hrs, min, sec),
    },
  },
  { timestamps: true }
);

AccessTokenSchema.pre("save", function (next) {
  // if (this.isModified("token")) {
  //   this.token = bcrypt.hashSync(this.token, saltRounds);
  // }
  return next();
});

AccessTokenSchema.pre("findOneAndUpdate", function () {
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

AccessTokenSchema.pre("update", function (next) {
  // if (this.isModified("token")) {
  //   this.token = bcrypt.hashSync(this.token, saltRounds);
  // }
  return next();
});

AccessTokenSchema.index({ token: 1 }, { unique: true });

AccessTokenSchema.statics = {
  async findToken(authorizationToken) {
    try {
      if (authorizationToken) {
        let accessToken;
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

        if (!accessToken) return { user: null, currentAccessToken: null };

        accessToken.last_used_at = new Date(Date.now());
        await accessToken.save();
        return {
          user: accessToken.owner,
          currentAccessToken: accessToken.token,
        };
      }
      return { user: null, currentAccessToken: null };
    } catch (error) {
      logObject("an error", error);
    }
  },
  async register(args) {
    try {
      data = await this.create({
        ...args,
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
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }
      return {
        error: response,
        errors: response,
        message: "validation errors for some of the provided fields",
        success: false,
        status: httpStatus.CONFLICT,
      };
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      logObject("filtering here", filter);
      /**
       * if the filter has a token in it
       * then just use hashcompare from here accordinglys
       * or just hash it the same way in order to make the comparisons
       */
      const inclusionProjection = constants.TOKENS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.TOKENS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : ""
      );

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "users",
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
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 300)
        .allowDiskUse(true);

      logObject("the response", response);
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
          message: "not found, please crosscheck provided details",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      delete modifiedUpdate.user_id;
      // if (modifiedUpdate.token) {
      //   modifiedUpdate.token = bcrypt.hashSync(
      //     modifiedUpdate.token,
      //     saltRounds
      //   );
      // }
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
        return {
          success: false,
          message: "Token does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Token does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        error: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 0,
          token: 1,
          network_id: 1,
          user_id: 1,
          expires_in: 1,
        },
      };

      let removedToken = await this.findOneAndRemove(filter, options).exec();

      logObject("removedToken", removedToken);

      if (!isEmpty(removedToken)) {
        return {
          success: true,
          message: "successfully removed the Token",
          data: removedToken._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedToken)) {
        return {
          success: false,
          message: "Token does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Token does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

AccessTokenSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      token: this.token,
      user_id: this.user_id,
      network_id: this.network_id,
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

module.exports = AccessTokenSchema;
