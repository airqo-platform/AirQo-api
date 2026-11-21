// ParishPopulation.js
// Parish-level census population, sourced from national statistics offices
// (e.g. UBOS — Uganda's National Population and Housing Census).
//
// Distinct from CityPopulationRegistry (crowd-sourced, city-level estimates)
// and SdgCity/SdgPopulationWeight (city-level, gridded/modelled weights).
// Records here are authoritative census counts at the finest administrative
// unit UBOS publishes (parish) and are the raw material for eventually
// re-deriving SdgCity.pop_weight from real counts instead of a WorldPop/GPWv4
// raster — that re-derivation needs a site-to-parish spatial join and is not
// done here.
//
// Lookup key: district + division + parish + sex + year, all stored
// uppercase for case-insensitive matching against source spreadsheets.
// POST is always an upsert so re-running an ingestion script is safe.

const { Schema } = require("mongoose");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- parish-population-model`
);

const parishPopulationSchema = new Schema(
  {
    district: { type: String, trim: true, uppercase: true, required: true },
    // UBOS flattens county/subcounty/division into one level for cities
    // like Kampala, where they're the same value — stored as division.
    division: { type: String, trim: true, uppercase: true, required: true },
    parish: { type: String, trim: true, uppercase: true, required: true },
    sex: { type: String, enum: ["Male", "Female"], required: true },
    population: { type: Number, required: true, min: 0 },

    // Census/reference year the count applies to.
    year: { type: Number, required: true },

    // Attribution for auditability under UN SDG reporting standards.
    source: {
      type: String,
      trim: true,
      default: "UBOS — National Population and Housing Census",
    },
    dataset_id: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

parishPopulationSchema.index(
  { district: 1, division: 1, parish: 1, sex: 1, year: 1 },
  { unique: true }
);

// ---------------------------------------------------------------------------
// Statics
// ---------------------------------------------------------------------------

parishPopulationSchema.statics.list = async function (filter = {}) {
  try {
    const records = await this.find(filter)
      .sort({ district: 1, division: 1, parish: 1, sex: 1 })
      .lean();
    return {
      success: true,
      data: records,
      message: "Parish population records retrieved successfully",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error listing parish population records: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

/**
 * Upsert by district + division + parish + sex + year.
 */
parishPopulationSchema.statics.register = async function (data) {
  try {
    const district = (data.district || "").trim().toUpperCase();
    const division = (data.division || "").trim().toUpperCase();
    const parish = (data.parish || "").trim().toUpperCase();
    const sex = data.sex;
    const year = data.year;

    const payload = {
      district,
      division,
      parish,
      sex,
      year,
      population: data.population,
      ...(data.source != null ? { source: data.source } : {}),
      ...(data.dataset_id != null ? { dataset_id: data.dataset_id } : {}),
    };

    const raw = await this.findOneAndUpdate(
      { district, division, parish, sex, year },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, rawResult: true }
    );
    const isNew = !raw.lastErrorObject.updatedExisting;

    return {
      success: true,
      data: raw.value,
      message: isNew
        ? "Parish population record created"
        : "Parish population record updated",
      status: isNew ? httpStatus.CREATED : httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error saving parish population record: ${error.message}`);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return {
        success: false,
        message: "Invalid parish population data",
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

/**
 * Sums population by division for a district/year — used to cross-check
 * ingested parish rows against a source's published division-level totals.
 */
parishPopulationSchema.statics.totalsByDivision = async function (
  { district, year } = {}
) {
  try {
    const match = {};
    if (district) match.district = String(district).trim().toUpperCase();
    if (year != null) match.year = year;

    const data = await this.aggregate([
      { $match: match },
      {
        $group: {
          _id: { division: "$division", sex: "$sex" },
          population: { $sum: "$population" },
          parish_count: { $addToSet: "$parish" },
        },
      },
      {
        $group: {
          _id: "$_id.division",
          bySex: {
            $push: { sex: "$_id.sex", population: "$population" },
          },
          parishes: { $first: "$parish_count" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      success: true,
      data: data.map((d) => ({
        division: d._id,
        parish_count: (d.parishes || []).length,
        by_sex: d.bySex,
        total: d.bySex.reduce((sum, s) => sum + s.population, 0),
      })),
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error aggregating division totals: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const ParishPopulationModel = (tenant) => {
  try {
    return getModelByTenant(tenant, "parish_population", parishPopulationSchema);
  } catch (error) {
    logger.error(
      `Error getting ParishPopulation model for tenant ${tenant}: ${error.message}`
    );
    throw error;
  }
};

module.exports = ParishPopulationModel;
