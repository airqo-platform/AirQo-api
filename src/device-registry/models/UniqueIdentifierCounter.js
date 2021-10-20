const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");

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
  async modify({ filter = {}, update = {} } = {}) {
    try {
      logObject("the filter", filter);
      logObject("the update", update);
      let options = { writeConcern: "majority" };
      let updatedSite = await this.findOneAndUpdate(filter, update, options);
      logObject("the data", updatedSite);
      if (!isEmpty(updatedSite)) {
        const data = updatedSite._doc;
        return {
          success: true,
          message: "successfully modified the counter document",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "counter does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: {
            message: "can't locate the relevant counter document -- site_0",
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Counter model server error - modify",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

uniqueIdentifierCounterSchema.methods = {};

module.exports = uniqueIdentifierCounterSchema;
