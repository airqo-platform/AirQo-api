const mongoose = require("mongoose");
const validator = require("validator");
const ObjectId = mongoose.Types.ObjectId;
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} = require("@utils/shared");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- candidate-model`);

const CandidateSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      required: [true, "email is required"],
      trim: true,
      validate: {
        validator(email) {
          return validator.isEmail(email);
        },
        message: "{VALUE} is not a valid email!",
      },
    },
    firstName: {
      type: String,
      required: [true, "firstName is required!"],
      trim: true,
    },
    network_id: {
      type: ObjectId,
      required: [true, "network_id is required!"],
      trim: true,
      ref: "network",
    },
    lastName: {
      type: String,
      required: [true, "lastName is required"],
      trim: true,
    },
    description: { type: String, required: [true, "description is required"] },
    long_organization: {
      type: String,
      required: [true, "long_organization is required"],
    },
    jobTitle: { type: String, required: [true, "jobTitle is required"] },
    category: { type: String, required: [true, "category is required"] },
    website: { type: String, required: [true, "website is required"] },
    country: { type: String, required: [true, "country is required"] },
    isDenied: {
      type: Boolean,
    },
    status: {
      type: String,
      default: "pending",
    },
  },
  { timestamps: true }
);

CandidateSchema.statics = {
  async register(args, next) {
    try {
      let newArgs = Object.assign({}, args);

      // Preserve complex network_id default assignment logic
      if (isEmpty(newArgs.network_id)) {
        if (isEmpty(constants.DEFAULT_NETWORK)) {
          logger.error(
            `Unable to determine the Network to which User will belong`
          );
          return {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "Contact support@airqo.net -- unable to determine the Network to which User will belong",
            },
          };
        }
        newArgs.network_id = constants.DEFAULT_NETWORK;
        logObject("newArgs.network_id", newArgs.network_id);
      }

      const data = await this.create({
        ...newArgs,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "candidate", {
          message: "candidate created",
        });
      } else {
        // Preserve specific error handling for empty data case
        logger.error(
          "Operation successful but candidate NOT successfully created"
        );
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Operation not successful, please try again or contact support",
          },
        };
      }
    } catch (error) {
      return createErrorResponse(error, "create", logger, "candidate");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.CANDIDATES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.CANDIDATES_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const data = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "email",
          foreignField: "email",
          as: "user",
        })
        .lookup({
          from: "networks",
          localField: "network_id",
          foreignField: "_id",
          as: "network",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);

      return createSuccessResponse("list", data, "candidate", {
        message: "successfully listed the candidates",
        emptyMessage: "no candidates exist",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "candidate");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const updatedCandidate = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedCandidate)) {
        return createSuccessResponse(
          "update",
          updatedCandidate._doc,
          "candidate"
        );
      } else {
        return createNotFoundResponse(
          "candidate",
          "update",
          "candidate does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "candidate");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };

      const removedCandidate = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedCandidate)) {
        return createSuccessResponse(
          "delete",
          removedCandidate._doc,
          "candidate"
        );
      } else {
        return createNotFoundResponse(
          "candidate",
          "delete",
          "candidate does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "candidate");
    }
  },
};

CandidateSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      description: this.description,
      category: this.category,
      long_organization: this.long_organization,
      jobTitle: this.jobTitle,
      website: this.website,
      network_id: this.network_id,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      country: this.country,
    };
  },
};

const CandidateModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let candidates = mongoose.model("candidates");
    return candidates;
  } catch (error) {
    let candidates = getModelByTenant(dbTenant, "candidate", CandidateSchema);
    return candidates;
  }
};

module.exports = CandidateModel;
