// DivisionPopulation.js
// Division-level (county/subcounty) census population rollups, sourced from
// national statistics offices (e.g. UBOS).
//
// Distinct from ParishPopulation: UBOS publishes a division-level rollup
// table alongside the parish-level detail table, and the two can arrive on
// different timelines — a division's rollup total is often available and
// verifiable before every one of its parishes has been transcribed. This
// collection holds that rollup as its own authoritative record rather than
// deriving it by summing ParishPopulation, which would under-count for any
// division whose parish coverage is still partial (see
// ParishPopulation.totalsByDivision for that partial-coverage view).
//
// Lookup key: district + division + sex + year, uppercase for
// case-insensitive matching. POST is always an upsert.

const { Schema } = require("mongoose");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- division-population-model`
);

const divisionPopulationSchema = new Schema(
  {
    district: { type: String, trim: true, uppercase: true, required: true },
    division: { type: String, trim: true, uppercase: true, required: true },
    sex: { type: String, enum: ["Male", "Female"], required: true },
    population: { type: Number, required: true, min: 0 },
    year: { type: Number, required: true },

    // How many parishes this division comprises, per the source rollup —
    // lets callers compare against ParishPopulation.totalsByDivision's
    // parish_count to see how much parish-level detail is still missing.
    parish_count: { type: Number, min: 0, default: null },

    source: {
      type: String,
      trim: true,
      default: "UBOS — National Population and Housing Census",
    },
    dataset_id: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

divisionPopulationSchema.index(
  { district: 1, division: 1, sex: 1, year: 1 },
  { unique: true }
);

// ---------------------------------------------------------------------------
// Statics
// ---------------------------------------------------------------------------

divisionPopulationSchema.statics.list = async function (filter = {}) {
  try {
    const records = await this.find(filter)
      .sort({ district: 1, division: 1, sex: 1 })
      .lean();
    return {
      success: true,
      data: records,
      message: "Division population records retrieved successfully",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `Error listing division population records: ${error.message}`
    );
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

divisionPopulationSchema.statics.register = async function (data) {
  try {
    const district = (data.district || "").trim().toUpperCase();
    const division = (data.division || "").trim().toUpperCase();
    const sex = data.sex;
    const year = data.year;

    const payload = {
      district,
      division,
      sex,
      year,
      population: data.population,
      ...(data.parish_count != null ? { parish_count: data.parish_count } : {}),
      ...(data.source != null ? { source: data.source } : {}),
      ...(data.dataset_id != null ? { dataset_id: data.dataset_id } : {}),
    };

    const raw = await this.findOneAndUpdate(
      { district, division, sex, year },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, rawResult: true }
    );
    const isNew = !raw.lastErrorObject.updatedExisting;

    return {
      success: true,
      data: raw.value,
      message: isNew
        ? "Division population record created"
        : "Division population record updated",
      status: isNew ? httpStatus.CREATED : httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error saving division population record: ${error.message}`);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return {
        success: false,
        message: "Invalid division population data",
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
 * Sums population by sex for a district/year, plus each division's total —
 * the basis for computing a within-city population share per division.
 */
divisionPopulationSchema.statics.cityTotal = async function (
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
          _id: "$division",
          population: { $sum: "$population" },
          parish_count: { $first: "$parish_count" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const divisions = data.map((d) => ({
      division: d._id,
      population: d.population,
      parish_count: d.parish_count,
    }));
    const total = divisions.reduce((sum, d) => sum + d.population, 0);

    return {
      success: true,
      data: { divisions, total },
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error aggregating city total: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const DivisionPopulationModel = (tenant) => {
  try {
    return getModelByTenant(
      tenant,
      "division_population",
      divisionPopulationSchema
    );
  } catch (error) {
    logger.error(
      `Error getting DivisionPopulation model for tenant ${tenant}: ${error.message}`
    );
    throw error;
  }
};

module.exports = DivisionPopulationModel;
