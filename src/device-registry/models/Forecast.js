const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- forecast-model`);

const forecastValueSchema = new Schema({
  time: {
    type: Date,
    required: true,
  },
  forecast_created_at: {
    type: Date,
    required: true,
  },
  forecast_horizon: {
    type: Number,
    required: true,
  },
  device_id: {
    type: ObjectId,
    required: true,
  },
  site_id: {
    type: ObjectId,
    required: true,
  },
  pm2_5: {
    value: { type: Number, default: null },
    confidence_lower: { type: Number, default: null },
    confidence_upper: { type: Number, default: null },
  },
  pm10: {
    value: { type: Number, default: null },
    confidence_lower: { type: Number, default: null },
    confidence_upper: { type: Number, default: null },
  },
  model_version: {
    type: String,
    required: true,
  },
});

const forecastSchema = new Schema(
  {
    day: {
      type: String,
      required: true,
    },
    device_id: {
      type: ObjectId,
      required: true,
    },
    site_id: {
      type: ObjectId,
      required: true,
    },
    first: {
      type: Date,
      required: true,
    },
    last: {
      type: Date,
      required: true,
    },
    values: [forecastValueSchema],
  },
  {
    timestamps: true,
  }
);

forecastSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      day: this.day,
      device_id: this.device_id,
      site_id: this.site_id,
      first: this.first,
      last: this.last,
      values: this.values,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

forecastSchema.index({ device_id: 1 });
forecastSchema.index({ day: 1 });

forecastSchema.statics = {
  async register(args, next) {
    try {
      let createdForecast = await this.create(args);

      if (!isEmpty(createdForecast)) {
        let data = createdForecast._doc;
        data.__v = undefined;
        data.updatedAt = undefined;
        return {
          success: true,
          data,
          message: "Forecast created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdForecast)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Forecast not created despite successful operation" }
          )
        );
      }
    } catch (error) {
      logObject("the error", error);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      Object.entries(error.errors || {}).forEach(([key, value]) => {
        response.message = value.message;
        response[key] = value.message;
        return response;
      });

      next(new HttpError(message, status, response));
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const response = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the forecasts",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no forecasts exist, please crosscheck",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logObject("the error", error);
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(`🐛🐛 Internal Server Error -- ${stringifiedMessage}`);

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
      let options = { new: true, useFindAndModify: false, upsert: false };

      if (update._id) {
        delete update._id;
      }

      const updatedForecast = await this.findOneAndUpdate(
        filter,
        update,
        options
      );

      if (!isEmpty(updatedForecast)) {
        return {
          success: true,
          message: "successfully modified the forecast",
          data: updatedForecast._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedForecast)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            ...filter,
            message: "forecast does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(`🐛🐛 Internal Server Error -- ${stringifiedMessage}`);

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
          _id: 1,
          day: 1,
          device_id: 1,
          site_id: 1,
          first: 1,
          last: 1,
          values: 1,
        },
      };
      let removedForecast = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedForecast)) {
        return {
          success: true,
          message: "successfully removed the forecast",
          data: removedForecast._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedForecast)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            ...filter,
            message: "forecast does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(`🐛🐛 Internal Server Error -- ${stringifiedMessage}`);

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

const ForecastModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const forecasts = mongoose.model("forecasts");
    return forecasts;
  } catch (errors) {
    return getModelByTenant(dbTenant.toLowerCase(), "forecast", forecastSchema);
  }
};

module.exports = ForecastModel;
