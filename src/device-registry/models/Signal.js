const mongoose = require("mongoose");
const { Schema } = mongoose;
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const { logElement } = require("../utils/log");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- signal-model`);

const HealthTipsSchema = new Schema(
  {
    title: String,
    description: String,
    image: String,
  },
  { _id: false }
);

const SiteDetailsSchema = new Schema(
  {
    _id: Schema.Types.ObjectId,
    formatted_name: String,
    location_name: String,
    search_name: String,
    street: String,
    parish: String,
    village: String,
    sub_county: String,
    town: String,
    city: String,
    district: String,
    county: String,
    region: String,
    country: String,
    name: String,
    approximate_latitude: Number,
    approximate_longitude: Number,
    bearing_in_radians: Number,
    description: String,
    data_provider: String,
  },
  { _id: false }
);

const SignalsSchema = new Schema(
  {
    device: String,
    device_id: String,
    is_signal_primary: Boolean,
    health_tips: [HealthTipsSchema],
    site_id: String,
    time: Date,
    pm2_5: { value: Number },
    pm10: { value: Number },
    frequency: String,
    no2: { value: Number },
    siteDetails: SiteDetailsSchema,
    timeDifferenceHours: Number,
    aqi_color: String,
    aqi_category: String,
    aqi_color_name: String,
  },
  {
    timestamps: true,
    indexes: [
      {
        fields: { time: 1 },
        expireAfterSeconds: 60 * 60 * 24 * 30, // 1 month in seconds
      },
    ],
  }
);

SignalsSchema.pre("save", function(next) {
  next();
});

SignalsSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

SignalsSchema.index({ device_id: 1, time: 1 }, { unique: true });
SignalsSchema.index({ device: 1, time: 1 }, { unique: true });
SignalsSchema.index({ site_id: 1, time: 1 }, { unique: true });

SignalsSchema.methods = {
  toJSON() {
    return {
      device: this.device,
      device_id: this.device_id,
      is_signal_primary: this.is_signal_primary,
      health_tips: this.health_tips,
      site_id: this.site_id,
      time: this.time,
      pm2_5: this.pm2_5,
      pm10: this.pm10,
      frequency: this.frequency,
      no2: this.no2,
      siteDetails: this.siteDetails,
      timeDifferenceHours: this.timeDifferenceHours,
      aqi_color: this.aqi_color,
      aqi_category: this.aqi_category,
      aqi_color_name: this.aqi_color_name,
    };
  },
};

SignalsSchema.statics.register = async function(args, next) {
  try {
    const createdSignal = await this.create(args);

    if (!isEmpty(createdSignal)) {
      return {
        success: true,
        data: createdSignal._doc,
        message: "signal created",
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "signal not created despite successful operation",
          }
        )
      );
      return;
    }
  } catch (error) {
    logObject("error", error);
    let response = {
      message: "validation errors for some of the provided fields",
      success: false,
      status: httpStatus.CONFLICT,
      errors: { message: error.message },
    };

    if (!isEmpty(error.errors)) {
      response.errors = {};

      Object.entries(error.errors).forEach(([key, value]) => {
        response.errors.message = value.message;
        response.errors[value.path] = value.message;
      });
    } else {
      response.errors = { message: error.message };
    }
    next(new HttpError(response.message, response.status, response.errors));
    return;
  }
};
SignalsSchema.statics.list = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    logText("we are inside model's list....");
    const pipeline = this.aggregate()
      .match(filter)
      .sort({ createdAt: -1 })
      .skip(skip ? skip : 0)
      .limit(limit ? limit : 1000)
      .allowDiskUse(true);

    const data = await pipeline;
    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfull Operation",
        data,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message: "There are no records for this search",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};
SignalsSchema.statics.latest = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    let threeHoursAgo = new Date();
    threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

    const pipeline = this.aggregate()
      .match({
        time: {
          $gte: threeHoursAgo,
        },
      })
      .sort({ time: -1 })
      .group({
        _id: "$site_id",
        doc: { $first: "$$ROOT" },
      })
      .replaceRoot("$doc")
      .skip(skip)
      .limit(limit)
      .allowDiskUse(true);

    const data = await pipeline;
    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfull Operation",
        data,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message: "There are no records for this search",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};

const SignalModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const signals = mongoose.model("signals");
    return signals;
  } catch (error) {
    const signals = getModelByTenant(dbTenant, "signal", SignalsSchema);
    return signals;
  }
};

module.exports = SignalModel;
