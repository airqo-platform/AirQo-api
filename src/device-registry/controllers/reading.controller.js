const httpStatus = require("http-status");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- event-controller`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const createEventUtil = require("@utils/event.util");
const AirQloudModel = require("@models/Airqloud");
const SiteModel = require("@models/Site");
const CohortModel = require("@models/Cohort");
const GridModel = require("@models/Grid");
const { distance, generateFilter } = require("@utils/common");

const getSitesFromGrid = async ({ tenant = "airqo", grid_id } = {}) => {
  try {
    const request = {
      query: {
        grid_id,
      },
    };

    const filter = generateFilter.grids(request);
    const reseponseFromListGrid = await GridModel(tenant).list({ filter });

    const gridDetails = reseponseFromListGrid.data[0];

    if (reseponseFromListGrid.data.length > 1 || isEmpty(gridDetails)) {
      return {
        success: false,
        message: "Bad Request Error",
        status: httpStatus.BAD_REQUEST,
        errors: { message: "No distinct Grid found in this search" },
      };
    }

    const sites = gridDetails.sites || [];

    if (sites.length === 0) {
      return {
        success: true,
        message:
          "Unable to find any sites associated with the provided Grid ID",
        data: [],
        status: httpStatus.OK,
      };
    }

    const siteIds = sites.map((site) => site._id.toString()); // Convert ObjectId to string

    // Join the siteIds into a comma-separated string
    const commaSeparatedIds = siteIds.join(",");

    return {
      success: true,
      message: "Successfully retrieved the sites for this Grid",
      data: commaSeparatedIds,
      status: httpStatus.OK,
    };
  } catch (error) {
    logObject("error", error);
    logger.error(`🐛🐛 internal server error -- ${JSON.stringify(error)}`);
    return {
      success: false,
      message: "Internal Server Error",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
  }
};
const getDevicesFromCohort = async ({ tenant = "airqo", cohort_id } = {}) => {
  try {
    const responseFromGetDevicesOfCohort = await createEventUtil.getDevicesFromCohort(
      { cohort_id, tenant }
    );
    return responseFromGetDevicesOfCohort;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    return { success: false, message: "Internal Server Error" };
  }
};

const processGridIds = async (grid_ids, request) => {
  const gridIdArray = Array.isArray(grid_ids)
    ? grid_ids
    : grid_ids.toString().split(",");
  logObject("gridIdArray", gridIdArray);
  // Use Promise.all to concurrently process each grid_id
  const siteIdPromises = gridIdArray.map(async (grid_id) => {
    if (!isEmpty(grid_id)) {
      logObject("grid_id under processGridIds", grid_id);
      const responseFromGetSitesOfGrid = await getSitesFromGrid({ grid_id });

      logObject("responseFromGetSitesOfGrid", responseFromGetSitesOfGrid);

      if (responseFromGetSitesOfGrid.success === false) {
        logger.error(
          `🐛🐛 Internal Server Error --- ${JSON.stringify(
            responseFromGetSitesOfGrid
          )}`
        );
        return responseFromGetSitesOfGrid;
      } else if (isEmpty(responseFromGetSitesOfGrid.data)) {
        logger.error(
          `🐛🐛 The provided Grid ID ${grid_id} does not have any associated Site IDs`
        );
        return {
          success: false,
          message: `The provided Grid ID ${grid_id} does not have any associated Site IDs`,
        };
      }
      // Randomly pick one site from the list
      logObject(
        "responseFromGetSitesOfGrid.data",
        responseFromGetSitesOfGrid.data
      );

      logObject(
        "responseFromGetSitesOfGrid.data.split",
        responseFromGetSitesOfGrid.data.split(",")
      );

      const arrayOfSites = responseFromGetSitesOfGrid.data.split(",");
      return arrayOfSites;
    }
  });

  // Wait for all promises to resolve
  const siteIdResults = await Promise.all(siteIdPromises);
  const resolvedSiteIds = siteIdResults.filter(Boolean);
  logObject("siteIdResults", resolvedSiteIds);

  const invalidSiteIdResults = resolvedSiteIds.filter(
    (result) => result.success === false
  );

  if (!isEmpty(invalidSiteIdResults)) {
    logger.error(
      `🙅🏼🙅🏼 Bad Request Error --- ${JSON.stringify(invalidSiteIdResults)}`
    );
  }
  logObject("invalidSiteIdResults", invalidSiteIdResults);

  const validSiteIdResults = resolvedSiteIds.filter(
    (result) => !(result.success === false)
  );

  logObject("validSiteIdResults", validSiteIdResults);

  if (isEmpty(invalidSiteIdResults) && validSiteIdResults.length > 0) {
    request.query.site_id = validSiteIdResults.join(",");
  }
};
const processCohortIds = async (cohort_ids, request) => {
  logObject("cohort_ids", cohort_ids);
  const cohortIdArray = Array.isArray(cohort_ids)
    ? cohort_ids
    : cohort_ids.toString().split(",");

  // Use Promise.all to concurrently process each cohort_id
  const deviceIdsPromises = cohortIdArray.map(async (cohort_id) => {
    if (!isEmpty(cohort_id)) {
      const responseFromGetDevicesOfCohort = await getDevicesFromCohort({
        cohort_id,
      });

      logObject(
        "responseFromGetDevicesOfCohort",
        responseFromGetDevicesOfCohort
      );

      if (responseFromGetDevicesOfCohort.success === false) {
        logger.error(
          `🐛🐛 Internal Server Error --- ${JSON.stringify(
            responseFromGetDevicesOfCohort
          )}`
        );
        return responseFromGetDevicesOfCohort;
      } else if (isEmpty(responseFromGetDevicesOfCohort.data)) {
        logger.error(
          `🐛🐛 The provided Cohort ID ${cohort_id} does not have any associated Device IDs`
        );
        return {
          success: false,
          message: `The provided Cohort ID ${cohort_id} does not have any associated Device IDs`,
        };
      }
      const arrayOfDevices = responseFromGetDevicesOfCohort.data.split(",");
      return arrayOfDevices;
    }
  });

  // Wait for all promises to resolve
  const deviceIdsResults = await Promise.all(deviceIdsPromises);

  const resolvedDeviceIds = deviceIdsResults.filter(Boolean);
  const invalidDeviceIdResults = resolvedDeviceIds.filter(
    (result) => result.success === false
  );

  if (!isEmpty(invalidDeviceIdResults)) {
    logger.error(
      `🙅🏼🙅🏼 Bad Request Errors --- ${JSON.stringify(invalidDeviceIdResults)}`
    );
  }

  // Filter out undefined or null values
  const validDeviceIdResults = resolvedDeviceIds.filter(
    (result) => !(result.success === false)
  );

  // join the array of arrays into a single array
  const flattened = [].concat(...validDeviceIdResults);

  if (isEmpty(invalidDeviceIdResults) && validDeviceIdResults.length > 0) {
    request.query.device_id = validDeviceIdResults.join(",");
  }
};

const createReading = {
  fetchAndStoreData: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = {
        ...req,
        query: {
          ...req.query,
          tenant: isEmpty(req.query.tenant) ? "airqo" : req.query.tenant,
          recent: "yes",
          metadata: "site_id",
          active: "yes",
          brief: "yes",
        },
      };

      const result = await createEventUtil.fetchAndStoreData(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("the result for inserting readings", result);
      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        res.status(status).json({
          success: true,
          message: result.message,
        });
      } else {
        const errorStatus = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(errorStatus).json({
          success: false,
          errors: result.errors || { message: "" },
          message: result.message,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getBestAirQuality: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = {
        ...req,
        query: {
          ...req.query,
          tenant: isEmpty(req.query.tenant) ? "airqo" : req.query.tenant,
        },
      };

      delete request.query.internal;

      const result = await createEventUtil.getBestAirQuality(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        res.status(status).json({
          success: true,
          message: result.message,
          measurements: result.data,
        });
      } else {
        const errorStatus = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(errorStatus).json({
          success: false,
          errors: result.errors || { message: "" },
          message: result.message,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  readingsForMap: async (req, res, next) => {
    try {
      logText("the readings for the AirQo Map...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = {
        ...req,
        query: {
          ...req.query,
          tenant: isEmpty(req.query.tenant) ? "airqo" : req.query.tenant,
        },
      };

      const result = await createEventUtil.read(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        res.status(status).json({
          success: true,
          message: result.message,
          measurements: result.data,
        });
      } else {
        const errorStatus = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(errorStatus).json({
          success: false,
          errors: result.errors || { message: "" },
          message: result.message,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  recentReadings: async (req, res, next) => {
    try {
      logText("the recent readings with Filter capabilities...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = {
        ...req,
        query: {
          ...req.query,
          tenant: isEmpty(req.query.tenant) ? "airqo" : req.query.tenant,
        },
      };

      delete request.query.internal;

      const result = await createEventUtil.readRecentWithFilter(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        res.status(status).json({
          success: true,
          message: result.message,
          measurements: result.data,
        });
      } else {
        const errorStatus = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(errorStatus).json({
          success: false,
          errors: result.errors || { message: "" },
          message: result.message,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listReadingAverages: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = {
        ...req,
        query: {
          ...req.query,
          tenant: isEmpty(req.query.tenant) ? "airqo" : req.query.tenant,
          averages: "readings",
        },
      };

      delete request.query.internal;

      const result = await createEventUtil.listReadingAverages(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        res.status(status).json({
          success: true,
          message: result.message,
          measurements: result.data,
        });
      } else {
        const errorStatus = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(errorStatus).json({
          success: false,
          errors: result.errors || { message: "" },
          message: result.message,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getWorstReadingForSites: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      // Security: Prevent public requests from setting internal flag
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { site_id, grid_id } = { ...req.query, ...req.params };
      let locationErrors = 0;

      let siteIds = [];
      if (Array.isArray(site_id)) {
        siteIds = site_id.map(String);
      } else if (site_id) {
        siteIds = [String(site_id)];
      }

      if (isEmpty(siteIds) && !isEmpty(grid_id)) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        } else {
          siteIds = request.query.site_id.split(",");
        }
      }

      if (locationErrors === 0) {
        const result = await createEventUtil.getWorstReadingForSites({
          siteIds,
          next,
        });

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        if (result.success === true) {
          const status = result.status || httpStatus.OK;
          res.status(status).json({
            success: true,
            message: result.message,
            data: result.data,
          });
        } else {
          const errorStatus = result.status || httpStatus.INTERNAL_SERVER_ERROR;
          res.status(errorStatus).json({
            success: false,
            errors: result.errors || { message: "" },
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided site IDs`,
          },
          message: "Bad Request Error",
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getWorstReadingForDevices: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      // Security: Prevent public requests from setting internal flag
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { device_id, cohort_id } = { ...req.query, ...req.params };
      let locationErrors = 0;

      let deviceIds = [];
      if (Array.isArray(device_id)) {
        deviceIds = device_id.map(String);
      } else if (device_id) {
        deviceIds = [String(device_id)];
      }

      if (isEmpty(deviceIds) && !isEmpty(cohort_id)) {
        await processCohortIds(cohort_id, request);
        if (isEmpty(request.query.device_id)) {
          locationErrors++;
        } else {
          deviceIds = request.query.device_id.split(",");
        }
      }
      logObject("deviceIds", deviceIds);
      if (locationErrors === 0) {
        const result = await createEventUtil.getWorstReadingForDevices({
          deviceIds,
          next,
        });

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        if (result.success === true) {
          const status = result.status || httpStatus.OK;
          res.status(status).json({
            success: true,
            message: result.message,
            data: result.data,
          });
        } else {
          const errorStatus = result.status || httpStatus.INTERNAL_SERVER_ERROR;
          res.status(errorStatus).json({
            success: false,
            errors: result.errors || { message: "" },
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided device IDs`,
          },
          message: "Bad Request Error",
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getNearestReadings: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      // Security: Prevent public requests from setting internal flag
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createEventUtil.getNearestReadings(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          measurements: result.data,
          fromNearestCity: result.fromNearestCity || false,
          nearestCityInfo: result.nearestCityInfo || null,
        });
      } else {
        const errorStatus = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(errorStatus).json({
          success: false,
          errors: result.errors || { message: "" },
          message: result.message,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = createReading;
