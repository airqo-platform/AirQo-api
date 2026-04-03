const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");

const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- sdg-population-weight-model`
);
const { getModelByTenant } = require("@config/database");

const weightEntrySchema = new Schema(
  {
    city_id: {
      type: String,
      required: [true, "city_id is required!"],
      trim: true,
    },
    pop_weight: {
      type: Number,
      required: [true, "pop_weight is required!"],
      min: [0, "pop_weight must be between 0 and 1"],
      max: [1, "pop_weight must be between 0 and 1"],
    },
    urban_fraction: {
      type: Number,
      min: [0, "urban_fraction must be between 0 and 1"],
      max: [1, "urban_fraction must be between 0 and 1"],
    },
  },
  { _id: false }
);

const sdgPopulationWeightSchema = new Schema(
  {
    methodology: {
      type: String,
      required: [true, "methodology is required!"],
      trim: true,
    },
    resolution_km: {
      type: Number,
      min: [0, "resolution_km must be a positive number"],
    },
    reference_year: {
      type: Number,
      required: [true, "reference_year is required!"],
    },
    sources: {
      type: [String],
      default: [],
    },
    weights: {
      type: [weightEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

sdgPopulationWeightSchema.index({ reference_year: 1 });

sdgPopulationWeightSchema.methods.toJSON = function () {
  const { methodology, resolution_km, reference_year, sources, weights } =
    this;
  return { methodology, resolution_km, reference_year, sources, weights };
};

sdgPopulationWeightSchema.statics.register = async function (args, next) {
  try {
    const created = await this.create({ ...args });
    if (!isEmpty(created)) {
      return {
        success: true,
        data: created._doc,
        message: "SDG population weight configuration created",
        status: httpStatus.CREATED,
      };
    }
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message:
          "Population weight config not created despite successful operation",
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

sdgPopulationWeightSchema.statics.list = async function (
  { filter = {}, limit = 100, skip = 0 } = {},
  next
) {
  try {
    const data = await this.aggregate()
      .match(filter)
      .sort({ reference_year: -1 })
      .skip(skip)
      .limit(limit)
      .allowDiskUse(true);

    return {
      success: true,
      message: "Successful Operation",
      data,
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

const SdgPopulationWeightModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const model = mongoose.model("sdg_population_weights");
    return model;
  } catch (error) {
    const model = getModelByTenant(
      dbTenant,
      "sdg_population_weights",
      sdgPopulationWeightSchema
    );
    return model;
  }
};

module.exports = SdgPopulationWeightModel;
