const mongoose = require("mongoose").set("debug", true);
const { logObject, logElement, logText } = require("../utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const httpStatus = require("http-status");

/**
 * belongs to a user
 * a User has many access tokens
 */

const AccessTokenSchema = new mongoose.Schema(
  {
    user_id: {
      type: ObjectId,
      ref: "user",
      required: [true, "user is required!"],
    },
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
    expires_in: { type: Number },
    expires: { type: Date, required: [true, "expiry date is required!"] },
  },
  { timestamps: true }
);

AccessTokenSchema.pre("save", function (next) {
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
      if (data) {
        return {
          success: true,
          data,
          message: "Token created",
        };
      }
      return {
        success: true,
        data,
        message: "operation successful but Token NOT successfully created",
      };
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }
      return {
        error: response,
        message,
        success: false,
        status,
      };
    }
  },

  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      logObject("filtering here", filter);

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "users",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          user_id: 1,
          name: 1,
          token: 1,
          network_id: 1,
          last_used_at: 1,
          expires: 1,
          last_ip_address: 1,
          user: { $arrayElemAt: ["$users", 0] },
        })
        .project({
          "user._id": 0,
          "user.notifications": 0,
          "user.verified": 0,
          "user.networks": 0,
          "user.groups": 0,
          "user.roles": 0,
          "user.permissions": 0,
          "user.locationCount": 0,
          "user.userName": 0,
          "user.password": 0,
          "user.long_organization": 0,
          "user.privilege": 0,
          "user.duration": 0,
          "user.createdAt": 0,
          "user.updatedAt": 0,
          "user.__v": 0,
          "user.resetPasswordExpires": 0,
          "user.resetPasswordToken": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      logObject("the response", response);
      if (!isEmpty(response)) {
        let data = response;
        return {
          success: true,
          message: "successfully retrieved the token details",
          data,
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "token/s do not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      /**
       * We could delete the userID from here
       * Should the user ID be deleted?
       */
      delete modifiedUpdate.user_id;
      let updatedToken = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      if (!isEmpty(updatedToken)) {
        let data = updatedToken._doc;
        return {
          success: true,
          message: "successfully modified the Token",
          data,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedToken)) {
        return {
          success: true,
          message: "Token does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server error",
        error: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "internal server error" },
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
        let data = removedToken._doc;
        return {
          success: true,
          message: "successfully removed the Token",
          data,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedToken)) {
        return {
          success: true,
          message: "Token does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      } else {
        return {
          success: false,
          message: "no response from deletion operation",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Token model server error - remove",
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
