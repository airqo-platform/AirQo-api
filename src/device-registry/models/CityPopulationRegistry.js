// CityPopulationRegistry.js
// Crowd-sourced city population data for the Network Coverage page.
//
// Distinct from SdgCity (which requires a Grid document and is populated
// from authoritative SDG pipelines). Records here are user-submitted
// estimates — useful until SdgCity is seeded for a given city. When both
// sources have data for the same city, SdgCity takes priority.
//
// Lookup key: city + country, both stored lowercase for case-insensitive
// matching. The unique index prevents duplicate submissions for the same
// city-country pair — POST is always an upsert.

const { Schema } = require("mongoose");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- city-population-registry-model`
);

const cityPopulationRegistrySchema = new Schema(
  {
    // Stored lowercase so lookups are case-insensitive without collations.
    city: { type: String, trim: true, lowercase: true, required: true },
    country: { type: String, trim: true, lowercase: true, required: true },

    // Optional display name preserving original casing (e.g. "Addis Ababa")
    displayCity: { type: String, trim: true, default: "" },
    displayCountry: { type: String, trim: true, default: "" },

    iso2: { type: String, trim: true, uppercase: true, default: "" },
    population: { type: Number, required: true, min: 1 },

    // Year the estimate applies to — useful when data is updated over time.
    year: {
      type: Number,
      default: () => new Date().getFullYear(),
    },

    // Free-text attribution: "WorldPop 2023", "UN 2022", "Wikipedia", etc.
    source: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

// One record per city-country combination.
cityPopulationRegistrySchema.index({ city: 1, country: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// Statics
// ---------------------------------------------------------------------------

cityPopulationRegistrySchema.statics.list = async function (filter = {}) {
  try {
    const records = await this.find(filter)
      .sort({ country: 1, city: 1 })
      .lean();
    return {
      success: true,
      data: records,
      message: "City population records retrieved successfully",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error listing city population records: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

/**
 * Upsert by city + country. displayCity and displayCountry capture the
 * original casing from the submission for rendering purposes.
 */
cityPopulationRegistrySchema.statics.register = async function (data) {
  try {
    const city = (data.city || "").trim().toLowerCase();
    const country = (data.country || "").trim().toLowerCase();
    const payload = {
      ...data,
      city,
      country,
      displayCity: data.city ? data.city.trim() : "",
      displayCountry: data.country ? data.country.trim() : "",
    };

    const raw = await this.findOneAndUpdate(
      { city, country },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, rawResult: true }
    );
    const isNew = !raw.lastErrorObject.updatedExisting;

    return {
      success: true,
      data: raw.value,
      message: isNew
        ? "City population record created"
        : "City population record updated",
      status: isNew ? httpStatus.CREATED : httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error saving city population record: ${error.message}`);

    if (error.code === 11000) {
      return {
        success: false,
        message: "A population record for this city already exists",
        errors: { message: error.message },
        status: httpStatus.CONFLICT,
      };
    }
    if (error.name === "ValidationError" || error.name === "CastError") {
      return {
        success: false,
        message: "Invalid city population data",
        errors: { message: error.message },
        status: httpStatus.BAD_REQUEST,
      };
    }
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

cityPopulationRegistrySchema.statics.removeById = async function (cityId) {
  try {
    const deleted = await this.findByIdAndDelete(cityId);
    if (!deleted) {
      return {
        success: false,
        message: "City population record not found",
        errors: { message: `No record with id ${cityId}` },
        status: httpStatus.NOT_FOUND,
      };
    }
    return {
      success: true,
      message: "City population record deleted",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `Error deleting city population record: ${error.message}`
    );
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const CityPopulationRegistryModel = (tenant) => {
  try {
    return getModelByTenant(
      tenant,
      "city_population_registry",
      cityPopulationRegistrySchema
    );
  } catch (error) {
    logger.error(
      `Error getting CityPopulationRegistry model for tenant ` +
        `${tenant}: ${error.message}`
    );
    throw error;
  }
};

module.exports = CityPopulationRegistryModel;
