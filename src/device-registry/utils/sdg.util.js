const SdgCityModel = require("@models/SdgCity");
const SdgPopulationWeightModel = require("@models/SdgPopulationWeight");
const SiteModel = require("@models/Site");
const GridModel = require("@models/Grid");
const { HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- sdg-util`);
const XLSX = require("@e965/xlsx");

// ---------------------------------------------------------------------------
// Expected flat template columns (case-insensitive header matching):
//   city_id | name | country | population | pop_weight | year |
//   monitoring_since (opt) | grids (opt, pipe-separated)
// ---------------------------------------------------------------------------

function normaliseHeader(h) {
  return String(h).trim().toLowerCase().replace(/\s+/g, "_");
}

function parseSpreadsheetBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // sheet_to_json with header:1 gives raw arrays; header:"A" gives column-letter keys.
  // Using defval:"" so empty cells are empty strings, not undefined.
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows;
}

function validateAndMapRow(raw, rowIndex, fallbackCountry, fallbackYear) {
  const row = {};
  for (const [k, v] of Object.entries(raw)) {
    row[normaliseHeader(k)] = v;
  }

  const errors = [];

  // Required fields
  const city_id = String(row.city_id || "").trim();
  if (!city_id) errors.push("city_id is required");

  const name = String(row.name || "").trim();
  if (!name) errors.push("name is required");

  const country = String(row.country || fallbackCountry || "").trim().toUpperCase();
  if (!country || country.length !== 2) errors.push("country must be a 2-letter ISO code");

  const population = parseInt(String(row.population || "").replace(/[,\s]/g, ""), 10);
  if (isNaN(population) || population < 0) errors.push("population must be a non-negative integer");

  const pop_weight = parseFloat(String(row.pop_weight || "").replace(/,/g, "."));
  if (isNaN(pop_weight) || pop_weight < 0 || pop_weight > 1) errors.push("pop_weight must be a number between 0 and 1");

  const year = parseInt(String(row.year || fallbackYear || "").trim(), 10);
  if (isNaN(year) || year < 1900 || year > 2100) errors.push("year must be a valid 4-digit year");

  if (errors.length > 0) {
    return { valid: false, errors, rowIndex };
  }

  const mapped = { city_id, name, country, population, pop_weight, year };

  const monitoringSince = String(row.monitoring_since || "").trim();
  if (monitoringSince && monitoringSince.toLowerCase() !== "n/a") {
    const d = new Date(monitoringSince);
    if (!isNaN(d.getTime())) mapped.monitoring_since = d;
  }

  const gridsRaw = String(row.grids || "").trim();
  if (gridsRaw && gridsRaw.toLowerCase() !== "n/a") {
    mapped.grids = gridsRaw.split("|").map((g) => g.trim()).filter(Boolean);
  }

  return { valid: true, data: mapped };
}

const sdg = {
  /***************  City / Grid Metadata  ***************/

  createCity: async (request, next) => {
    try {
      const { tenant } = request.query;
      const {
        city_id,
        name,
        country,
        population,
        pop_weight,
        grids,
        grid_id,
        monitoring_since,
        year,
      } = request.body;

      const args = {
        city_id,
        name,
        country,
        population,
        pop_weight,
        year,
      };

      if (!isEmpty(grids)) args.grids = grids;
      if (!isEmpty(grid_id)) args.grid_id = grid_id;
      if (!isEmpty(monitoring_since)) args.monitoring_since = monitoring_since;

      const response = await SdgCityModel(tenant).register(args, next);
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  listCities: async (request, next) => {
    try {
      const { tenant } = request.query;
      const {
        country,
        year,
        limit = 100,
        skip = 0,
      } = request.query;

      const filter = {};
      if (!isEmpty(country)) filter.country = country.toUpperCase();
      if (!isEmpty(year)) filter.year = parseInt(year, 10);

      const response = await SdgCityModel(tenant).list(
        { filter, limit: parseInt(limit, 10), skip: parseInt(skip, 10) },
        next
      );

      if (!response || !response.success) return response;

      return {
        success: true,
        message: response.message,
        status: httpStatus.OK,
        data: response.data.map((city) => ({
          city_id: city.city_id,
          name: city.name,
          country: city.country,
          population: city.population,
          pop_weight: city.pop_weight,
          grids: city.grids || [],
          monitoring_since: city.monitoring_since,
        })),
        meta: {
          total: response.total || response.data.length,
          page: Math.floor(parseInt(skip, 10) / parseInt(limit, 10)) + 1,
          limit: parseInt(limit, 10),
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  listCitySites: async (request, next) => {
    try {
      const { tenant, limit = 100, skip = 0 } = request.query;
      const { city_id } = request.params;

      // Look up the city to get its grid reference
      const city = await SdgCityModel(tenant).findByCityId(city_id, next);
      if (!city) {
        next(
          new HttpError(
            `City with id '${city_id}' not found`,
            httpStatus.NOT_FOUND,
            { message: `No city found for city_id: ${city_id}` }
          )
        );
        return;
      }

      // Build the site filter — Site.grids stores ObjectIds, so we always
      // resolve to ObjectIds before querying.
      let siteFilter = { status: "active" };
      if (city.grid_id) {
        siteFilter.grids = city.grid_id;
      } else if (!isEmpty(city.grids)) {
        // city.grids is [String] (names/codes); resolve to ObjectIds via Grid
        const gridDocs = await GridModel(tenant)
          .find({
            $or: [
              { name: { $in: city.grids } },
              { grid_codes: { $in: city.grids } },
            ],
          })
          .select("_id")
          .lean();
        const gridIds = gridDocs.map((g) => g._id);
        if (isEmpty(gridIds)) {
          return {
            success: true,
            message: "No matching grids found for this city",
            data: [],
            status: httpStatus.OK,
          };
        }
        siteFilter.grids = { $in: gridIds };
      } else {
        return {
          success: true,
          message: "No grids configured for this city",
          data: [],
          status: httpStatus.OK,
        };
      }

      const sites = await SiteModel(tenant)
        .find(siteFilter)
        .select(
          "_id site_id latitude longitude approximate_latitude approximate_longitude status"
        )
        .skip(parseInt(skip, 10))
        .limit(parseInt(limit, 10))
        .lean();

      const formatted = sites.map((site) => ({
        site_id: site.site_id || site._id,
        coordinates: {
          latitude:
            site.approximate_latitude != null
              ? site.approximate_latitude
              : site.latitude,
          longitude:
            site.approximate_longitude != null
              ? site.approximate_longitude
              : site.longitude,
        },
        status: site.status || "active",
        pollutants: ["pm2.5", "pm10"],
      }));

      return {
        success: true,
        message: "Successful Operation",
        data: formatted,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /***************  Spreadsheet Upload  ***************/

  uploadCities: async (request, next) => {
    try {
      const { tenant } = request.query;
      const fallbackCountry = request.query.country;
      const fallbackYear = request.query.year;

      if (!request.file) {
        next(
          new HttpError("No file uploaded", httpStatus.BAD_REQUEST, {
            message: "A .csv or .xlsx file is required",
          })
        );
        return;
      }

      const rows = parseSpreadsheetBuffer(request.file.buffer);

      if (isEmpty(rows)) {
        return {
          success: false,
          message: "The uploaded file contains no data rows",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Empty spreadsheet" },
        };
      }

      const created = [];
      const failed = [];

      for (let i = 0; i < rows.length; i++) {
        const result = validateAndMapRow(
          rows[i],
          i + 2, // 1-based row number accounting for header row
          fallbackCountry,
          fallbackYear
        );

        if (!result.valid) {
          failed.push({ row: result.rowIndex, errors: result.errors });
          continue;
        }

        const saveResult = await SdgCityModel(tenant).register(
          result.data,
          next
        );

        if (saveResult && saveResult.success) {
          created.push(saveResult.data.city_id);
        } else if (saveResult) {
          failed.push({
            row: i + 2,
            city_id: result.data.city_id,
            errors: saveResult.errors || { message: saveResult.message },
          });
        }
      }

      const allFailed = created.length === 0 && failed.length > 0;

      return {
        success: !allFailed,
        message: allFailed
          ? "All rows failed validation or could not be saved"
          : `${created.length} city record(s) created${failed.length > 0 ? `, ${failed.length} row(s) skipped` : ""}`,
        status: allFailed ? httpStatus.BAD_REQUEST : httpStatus.OK,
        data: { created_count: created.length, created, failed },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /***************  Population Weight Configuration  ***************/

  listPopulationWeights: async (request, next) => {
    try {
      const { tenant, year, limit = 100, skip = 0 } = request.query;

      const filter = {};
      if (!isEmpty(year)) filter.reference_year = parseInt(year, 10);

      const response = await SdgPopulationWeightModel(tenant).list(
        { filter, limit: parseInt(limit, 10), skip: parseInt(skip, 10) },
        next
      );

      if (!response || !response.success) return response;

      // If a single config entry exists, return the latest as a flat response
      // matching the spec structure
      if (response.data.length > 0) {
        const latest = response.data[0];
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: {
            methodology: latest.methodology,
            resolution_km: latest.resolution_km,
            reference_year: latest.reference_year,
            sources: latest.sources || [],
            weights: latest.weights || [],
          },
        };
      }

      return {
        success: true,
        message: "No population weight configuration found",
        data: {},
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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

module.exports = sdg;
