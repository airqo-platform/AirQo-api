const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { HttpError } = require("@utils/errors");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- unique-identifier-model`
);
const uniqueIdentifierCounterSchema = new Schema(
  {
    COUNT: {
      type: Number,
      trim: true,
      required: [true, "COUNT is required!"],
      unique: true,
    },
    NOTES: {
      type: String,
      trim: true,
    },
    NAME: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "NAME is required!"],
    },
  },
  {
    timestamps: true,
  }
);

uniqueIdentifierCounterSchema.pre("save", function(next) {
  return next();
});

uniqueIdentifierCounterSchema.pre("update", function(next) {
  return next();
});

uniqueIdentifierCounterSchema.index({ COUNT: 1 }, { unique: true });

uniqueIdentifierCounterSchema.plugin(uniqueValidator, {
  message: `{VALUE} must be unique!`,
});

uniqueIdentifierCounterSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      COUNT: this.COUNT,
      NOTES: this.NOTES,
      NAME: this.NAME,
    };
  },
};

uniqueIdentifierCounterSchema.statics = {
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      let options = { writeConcern: "majority" };
      const updatedCounter = await this.findOneAndUpdate(
        filter,
        update,
        options
      );
      if (!isEmpty(updatedCounter)) {
        const data = updatedCounter._doc;
        return {
          success: true,
          message: "successfully modified the counter document",
          data,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedCounter)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "can't locate the relevant counter document -- site_0",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
};

uniqueIdentifierCounterSchema.methods = {};

const UniqueIdentifierCounterModel = (tenant) => {
  try {
    const activities = mongoose.model("uniqueIdentifierCounters");
    return activities;
  } catch (errors) {
    return getModelByTenant(
      tenant.toLowerCase(),
      "uniqueIdentifierCounter",
      uniqueIdentifierCounterSchema
    );
  }
};

module.exports = UniqueIdentifierCounterModel;
