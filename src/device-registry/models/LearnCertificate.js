const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- learn-certificate-model`
);

const learnCertificateSchema = new Schema(
  {
    user_id: {
      type: String,
      required: [true, "user_id is required"],
      trim: true,
    },
    course_id: {
      type: Schema.Types.ObjectId,
      ref: "learncourse",
      required: [true, "course_id is required"],
    },
    learner_name: {
      type: String,
      required: [true, "learner_name is required"],
      trim: true,
    },
    verification_code: {
      type: String,
      required: [true, "verification_code is required"],
      unique: true,
      trim: true,
    },
    share_url: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// One certificate per user per course
learnCertificateSchema.index({ user_id: 1, course_id: 1 }, { unique: true });
learnCertificateSchema.plugin(uniqueValidator, { message: `{VALUE} already taken!` });

learnCertificateSchema.statics = {
  async register(args, next) {
    try {
      const created = await this.create({ ...args });
      if (!isEmpty(created)) {
        return {
          success: true,
          data: created._doc,
          message: "certificate issued",
          status: httpStatus.CREATED,
        };
      }
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: "certificate not created despite successful operation",
        })
      );
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.keyPattern) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key]) => {
          response[key] = "duplicate value";
          response.message = "duplicate value";
        });
      } else if (!isEmpty(error.errors)) {
        status = httpStatus.BAD_REQUEST;
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response.message = value.message;
        });
      }
      next(new HttpError(message, status, response));
    }
  },

  async list({ filter = {}, skip = 0, limit = 100 } = {}, next) {
    try {
      const certs = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return {
        success: true,
        data: certs,
        message: "successfully retrieved certificates",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

const LearnCertificateModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  return getModelByTenant(dbTenant, "learncertificate", learnCertificateSchema);
};

module.exports = LearnCertificateModel;
