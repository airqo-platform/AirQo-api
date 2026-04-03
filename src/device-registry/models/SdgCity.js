const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- sdg-city-model`
);
const { getModelByTenant } = require("@config/database");

const sdgCitySchema = new Schema(
  {
    city_id: {
      type: String,
      required: [true, "city_id is required!"],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "name is required!"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "country is required!"],
      trim: true,
      uppercase: true,
      maxlength: [2, "country must be a 2-letter ISO 3166-1 alpha-2 code"],
      minlength: [2, "country must be a 2-letter ISO 3166-1 alpha-2 code"],
    },
    population: {
      type: Number,
      required: [true, "population is required!"],
      min: [0, "population must be a non-negative number"],
    },
    pop_weight: {
      type: Number,
      required: [true, "pop_weight is required!"],
      min: [0, "pop_weight must be between 0 and 1"],
      max: [1, "pop_weight must be between 0 and 1"],
    },
    grids: {
      type: [String],
      default: [],
    },
    grid_id: {
      type: ObjectId,
      ref: "grids",
      default: null,
    },
    monitoring_since: {
      type: Date,
      default: null,
    },
    year: {
      type: Number,
      required: [true, "year is required!"],
    },
  },
  { timestamps: true }
);

sdgCitySchema.index({ country: 1, year: 1 });
sdgCitySchema.index({ grid_id: 1 });

sdgCitySchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

sdgCitySchema.methods.toJSON = function () {
  const {
    _id,
    city_id,
    name,
    country,
    population,
    pop_weight,
    grids,
    grid_id,
    monitoring_since,
    year,
    createdAt,
    updatedAt,
  } = this;
  return {
    _id,
    city_id,
    name,
    country,
    population,
    pop_weight,
    grids,
    grid_id,
    monitoring_since,
    year,
    createdAt,
    updatedAt,
  };
};

sdgCitySchema.statics.register = async function (args, next) {
  try {
    const created = await this.create({ ...args });
    if (!isEmpty(created)) {
      return {
        success: true,
        data: created._doc,
        message: "SDG city created",
        status: httpStatus.CREATED,
      };
    }
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: "SDG city not created despite successful operation",
      })
    );
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
        response.errors[key] = value.message;
      });
    }
    return response;
  }
};

sdgCitySchema.statics.list = async function (
  { filter = {}, limit = 100, skip = 0 } = {},
  next
) {
  try {
    const data = await this.aggregate()
      .match(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .allowDiskUse(true);

    const total = await this.countDocuments(filter);

    return {
      success: true,
      message: "Successful Operation",
      data,
      total,
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
};

sdgCitySchema.statics.findById = async function (city_id, next) {
  try {
    const city = await this.findOne({ city_id });
    return city;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const SdgCityModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const sdgCities = mongoose.model("sdg_cities");
    return sdgCities;
  } catch (error) {
    const sdgCities = getModelByTenant(dbTenant, "sdg_cities", sdgCitySchema);
    return sdgCities;
  }
};

module.exports = SdgCityModel;
