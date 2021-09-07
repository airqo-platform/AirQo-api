const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { logElement, logText, logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const jsonify = require("../utils/jsonify");
const HTTPStatus = require("http-status");

const DefaultsSchema = new mongoose.Schema(
  {
    pollutant: {
      type: String,
      trim: true,
      required: [true, "pollutant is required!"],
    },
    frequency: {
      type: String,
      required: [true, "frequency is required!"],
    },
    startDate: {
      type: Date,
      required: [true, "startDate is required!"],
    },
    endDate: {
      type: Date,
      required: [true, "endDate is required!"],
    },
    chartType: {
      type: String,
      required: [true, "chartTyoe is required!"],
    },
    chartTitle: {
      type: String,
      required: [true, "chartTitle is required!"],
    },
    chartSubTitle: {
      type: String,
      required: [true, "chartSubTitle is required!"],
    },
    airqloud: {
      type: ObjectId,
    },
    user: {
      type: ObjectId,
      required: [true, "user is required"],
    },
    sites: [
      {
        type: ObjectId,
      },
    ],
    period: { type: {}, required: [true, "period is required!"] },
  },
  {
    timestamps: true,
  }
);

DefaultsSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

DefaultsSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      pollutant: this.pollutant,
      frequency: this.frequency,
      user: this.user,
      airqloud: this.airqloud,
      startDate: this.startDate,
      endDate: this.endDate,
      chartType: this.chartType,
      chartTitle: this.chartTitle,
      chartSubTitle: this.chartSubTitle,
      sites: this.sites,
      period: this.period,
      createdAt: this.createdAt,
    };
  },
};

DefaultsSchema.statics = {
  async register(args) {
    try {
      let body = args;
      if (body._id) {
        delete body._id;
      }
      let data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "default created",
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "default not created despite successful operation",
          status: HTTPStatus.CREATED,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      let response = {};
      logObject("the err", e);
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 20, filter = {} } = {}) {
    try {
      logObject("the filter in the defaults", filter);
      let defaults = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      let data = jsonify(defaults);
      logObject("the data for defaults", data);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the defaults",
          status: HTTPStatus.OK,
        };
      }
      if (isEmpty(data)) {
        return {
          success: true,
          message: "no defaults found for this search",
          data,
          status: HTTPStatus.NOT_FOUND,
        };
      }
      return {
        success: false,
        message: "unable to retrieve defaults",
        data,
        status: HTTPStatus.BAD_GATEWAY,
      };
    } catch (error) {
      return {
        success: false,
        message: "unable to list the defaults",
        errors: error.message,
        status: HTTPStatus.CONFLICT,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      if (update._id) {
        delete update._id;
      }
      let udpatedDefault = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      let data = jsonify(udpatedDefault);
      logObject("updatedDefault", data);

      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the default",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "the default does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      logObject("the error", err);
      let errors = {};
      let message = "";
      let status = "";
      if (err.code == 11000) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
      }
      return {
        success: false,
        message,
        errors,
        status,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          user: 1,
          chartTitle: 1,
          chartSubTitle: 1,
          airqloud: 1,
        },
      };
      let removedDefault = await this.findOneAndRemove(filter, options).exec();
      logElement("removedDefault", removedDefault);
      let data = jsonify(removedDefault);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the default",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "default does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        errors: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = DefaultsSchema;
