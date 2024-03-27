const httpStatus = require("http-status");
const constants = require("@config/constants");
const { logObject, logText, logElement } = require("@utils/log");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-event-controller`
);
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const createEventUtil = require("@utils/create-event");
const AirQloudModel = require("@models/Airqloud");
const SiteModel = require("@models/Site");
const CohortModel = require("@models/Cohort");
const GridModel = require("@models/Grid");
const distanceUtil = require("@utils/distance");
const generateFilter = require("@utils/generate-filter");
function handleResponse({
  result,
  key = "data",
  errorKey = "errors",
  res,
} = {}) {
  if (!result) {
    return;
  }

  const isSuccess = result.success;
  const defaultStatus = isSuccess
    ? httpStatus.OK
    : httpStatus.INTERNAL_SERVER_ERROR;

  const defaultMessage = isSuccess
    ? "Operation Successful"
    : "Internal Server Error";

  const status = result.status !== undefined ? result.status : defaultStatus;
  const message =
    result.message !== undefined ? result.message : defaultMessage;
  const data = result.data !== undefined ? result.data : [];
  const errors = isSuccess
    ? undefined
    : result.errors !== undefined
    ? result.errors
    : { message: "Internal Server Error" };

  return res.status(status).json({ message, [key]: data, [errorKey]: errors });
}
const getSitesFromAirQloud = async ({ tenant = "airqo", airqloud_id } = {}) => {
  try {
    const airQloud = await AirQloudModel(tenant)
      .findById(airqloud_id)
      .lean();
    logObject("airQloud", airQloud);

    if (!airQloud) {
      logger.error(
        `🙅🏼🙅🏼 Bad Request Error, no distinct AirQloud found for ${airqloud_id.toString()} `
      );
      return {
        success: false,
        message: "Bad Request Error",
        status: httpStatus.BAD_REQUEST,
        errors: { message: "c" },
      };
    }

    const sites = airQloud.sites || [];
    logObject("sites from the AirQloud", sites);

    if (sites.length === 0) {
      return {
        success: true,
        message:
          "Unable to find any sites associated with the provided AirQloud ID",
        data: [],
        status: httpStatus.OK,
      };
    }

    const siteIds = sites.map((site) => site._id.toString()); // Convert ObjectId to string
    logObject("siteIds", siteIds);
    // Join the siteIds into a comma-separated string
    const commaSeparatedIds = siteIds.join(",");
    logObject("commaSeparatedIds", commaSeparatedIds);

    return {
      success: true,
      message: "Successfully retrieved the sites for this AirQloud",
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
    const request = {
      query: {
        cohort_id,
      },
    };
    const filter = generateFilter.cohorts(request);

    const responseFromListCohort = await CohortModel(tenant).list({ filter });
    logObject("responseFromListCohort.data[0]", responseFromListCohort.data[0]);
    const cohortDetails = responseFromListCohort.data[0];

    if (responseFromListCohort.data.length > 1 || isEmpty(cohortDetails)) {
      return {
        success: false,
        message: "Bad Request Error",
        errors: { message: "No distinct Cohort found in this search" },
        status: httpStatus.BAD_REQUEST,
      };
    }
    const assignedDevices = cohortDetails.devices || [];
    const deviceIds = assignedDevices.map((device) => device._id.toString());

    const commaSeparatedIds = deviceIds.join(",");
    logObject("commaSeparatedIds", commaSeparatedIds);

    return {
      success: true,
      message: "Successfully retrieved device IDs from cohort",
      data: commaSeparatedIds,
      status: httpStatus.OK,
    };
  } catch (error) {
    // Handle any unexpected errors
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
const getSitesFromLatitudeAndLongitude = async ({
  tenant = "airqo",
  latitude,
  longitude,
  radius = constants.DEFAULT_NEAREST_SITE_RADIUS,
  limit = 2, // Limit the result to the nearest 2 sites
} = {}) => {
  try {
    const responseFromListSites = await SiteModel(tenant).list();

    if (responseFromListSites.success === true) {
      let message = "successfully retrieved the nearest sites";
      const sites = responseFromListSites.data;

      // Calculate the squared radius for faster distance comparison
      const squaredRadius = radius * radius;

      // Sort sites by distance from provided coordinates
      sites.sort((a, b) => {
        lat1, lon1, lat2, lon2;
        const distanceSquaredA = distanceUtil.getDistanceSquared(
          {
            lat1: latitude,
            lon1: longitude,
            lat2: a.latitude,
            lon2: a.longitude,
          },
          next
        );
        const distanceSquaredB = distanceUtil.getDistanceSquared(
          {
            lat1: latitude,
            lon1: longitude,
            lat2: b.latitude,
            lon2: b.longitude,
          },
          next
        );
        return distanceSquaredA - distanceSquaredB;
      });

      // Extract the nearest 2 sites or fewer if there are fewer sites
      const nearestSites = sites.slice(0, limit);

      if (nearestSites.length === 0) {
        message = `No Site is within a ${constants.DEFAULT_NEAREST_SITE_RADIUS} KM radius to the provided coordinates`;
      }

      // Convert the array of site IDs to a comma-separated string
      const commaSeparatedIds = nearestSites
        .map((site) => site._id.toString())
        .join(",");

      return {
        success: true,
        data: commaSeparatedIds,
        message,
        status: httpStatus.OK,
      };
    } else if (responseFromListSites.success === false) {
      return responseFromListSites;
    }
  } catch (error) {
    logger.error(`🐛🐛 internal server error -- ${JSON.stringify(error)}`);
    return {
      success: false,
      message: "Internal Server Error",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
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
      // const randomSite =
      //   arrayOfSites[Math.floor(Math.random() * arrayOfSites.length)];
      // logObject("randomSite", randomSite);
      // return randomSite;
    }
  });

  // Wait for all promises to resolve
  const siteIdResults = await Promise.all(siteIdPromises);
  logObject("siteIdResults", siteIdResults);

  const invalidSiteIdResults = siteIdResults.filter(
    (result) => result.success === false
  );

  if (!isEmpty(invalidSiteIdResults)) {
    logger.error(
      `🙅🏼🙅🏼 Bad Request Error --- ${JSON.stringify(invalidSiteIdResults)}`
    );
  }
  logObject("invalidSiteIdResults", invalidSiteIdResults);

  const validSiteIdResults = siteIdResults.filter(
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
      // const randomDevice =
      //   responseFromGetDevicesOfCohort.data[
      //     Math.floor(Math.random() * arrayOfDevices.length)
      //   ];
      // return randomDevice;
    }
  });

  // Wait for all promises to resolve
  const deviceIdsResults = await Promise.all(deviceIdsPromises);

  const invalidDeviceIdResults = deviceIdsResults.filter(
    (result) => result.success === false
  );

  if (!isEmpty(invalidDeviceIdResults)) {
    logger.error(
      `🙅🏼🙅🏼 Bad Request Errors --- ${JSON.stringify(invalidDeviceIdResults)}`
    );
  }

  // Filter out undefined or null values
  const validDeviceIdResults = deviceIdsResults.filter(
    (result) => !(result.success === false)
  );

  if (isEmpty(invalidDeviceIdResults) && validDeviceIdResults.length > 0) {
    request.query.device_id = validDeviceIdResults.join(",");
  }
};
const processAirQloudIds = async (airqloud_ids, request) => {
  logObject("airqloud_ids", airqloud_ids);
  const airqloudIdArray = Array.isArray(airqloud_ids)
    ? airqloud_ids
    : airqloud_ids.toString().split(",");
  logObject("airqloudIdArray", airqloudIdArray);

  // Use Promise.all to concurrently process each airqloud_id
  const siteIdPromises = airqloudIdArray.map(async (airqloud_id) => {
    if (!isEmpty(airqloud_id)) {
      logObject("airqloud_id under processAirQloudIds", airqloud_id);
      const responseFromGetSitesOfAirQloud = await getSitesFromAirQloud({
        airqloud_id,
      });

      logObject(
        "responseFromGetSitesOfAirQloud",
        responseFromGetSitesOfAirQloud
      );

      if (responseFromGetSitesOfAirQloud.success === false) {
        logger.error(
          `🐛🐛 Internal Server Error --- ${JSON.stringify(
            responseFromGetSitesOfAirQloud
          )}`
        );
        return responseFromGetSitesOfAirQloud;
      } else if (isEmpty(responseFromGetSitesOfAirQloud.data)) {
        logger.error(
          `🐛🐛 The provided AirQloud ID ${airqloud_id} does not have any associated Site IDs`
        );
        return {
          success: false,
          message: `The provided AirQloud ID ${airqloud_id} does not have any associated Site IDs`,
        };
      }

      // Randomly pick one site from the list
      logObject(
        "responseFromGetSitesOfAirQloud.data",
        responseFromGetSitesOfAirQloud.data
      );

      logObject(
        "responseFromGetSitesOfAirQloud.data.split",
        responseFromGetSitesOfAirQloud.data.split(",")
      );

      const arrayOfSites = responseFromGetSitesOfAirQloud.data.split(",");
      return arrayOfSites;
      // const randomSite =
      //   arrayOfSites[Math.floor(Math.random() * arrayOfSites.length)];
      // logObject("randomSite", randomSite);
      // return randomSite;
    }
  });

  // Wait for all promises to resolve
  const siteIdResults = await Promise.all(siteIdPromises);
  logObject("siteIdResults", siteIdResults);

  const invalidSiteIdResults = siteIdResults.filter(
    (result) => result.success === false
  );

  if (!isEmpty(invalidSiteIdResults)) {
    logger.error(
      `🙅🏼🙅🏼 Bad Request Error --- ${JSON.stringify(invalidSiteIdResults)}`
    );
  }
  logObject("invalidSiteIdResults", invalidSiteIdResults);

  const validSiteIdResults = siteIdResults.filter(
    (result) => !(result.success === false)
  );

  logObject("validSiteIdResults", validSiteIdResults);

  if (isEmpty(invalidSiteIdResults) && validSiteIdResults.length > 0) {
    logObject("validSiteIdResults.join(,)", validSiteIdResults.join(","));
    request.query.site_id = validSiteIdResults.join(",");
  }
};

const createEvent = {
  addValues: async (req, res, next) => {
    try {
      logText("adding values...");
      const { tenant } = req.query;
      const measurements = req.body;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      let result = await createEventUtil.insert(tenant, measurements, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (!result.success) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "finished the operation with some errors",
          errors: result.errors,
        });
      } else {
        return res.status(httpStatus.OK).json({
          success: true,
          message: "successfully added all the events",
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
  listFromBigQuery: async (req, res, next) => {
    try {
      const { query } = req;
      const { format } = query;

      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createEventUtil.getMeasurementsFromBigQuery(
        req,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        if (format && format === "csv") {
          return res
            .status(status)
            .set({
              "Content-Type": "text/csv",
              "Content-Disposition": `attachment; filename="airqo-data-export.csv"`,
            })
            .type("text/csv")
            .send(result.data);
        }
        return res.status(status).json({
          success: true,
          measurements: result.data,
          message: "successfully retrieved the measurements",
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Error" },
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
  latestFromBigQuery: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createEventUtil.latestFromBigQuery(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
        });
      } else if (result.success === false) {
        logElement("we have gotten some challenges", result);
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          errors: result.errors ? result.errors : { message: "" },
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
  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      logText("we are listing events...");
      const { site_id, device_id, site, device } = {
        ...req.params,
        ...req.query,
      };

      if (!isEmpty(site_id) || !isEmpty(site)) {
        request.query.recent = "no";
        request.query.metadata = "site_id";
      }

      if (!isEmpty(device_id) || !isEmpty(device)) {
        request.query.recent = "no";
        request.query.metadata = "device_id";
      }

      request.query.brief = "yes";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("the result for listing events", result);
      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
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
  signalsForMap: async (req, res, next) => {
    try {
      logText("the signals for the AirQo Map...");
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

      const result = await createEventUtil.signal(request, next);

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
  listForMap: async (req, res, next) => {
    try {
      logText("we are listing events for the AirQo Map...");
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

      const result = await createEventUtil.view(request, next);

      // logObject("result", result);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
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
  listEventsForAllDevices: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.recent = "no";
      request.query.brief = "yes";
      request.query.metadata = "device";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("the result for listing events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          errors: result.errors ? result.errors : { message: "" },
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
  listRecent: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.recent = "yes";
      request.query.metadata = "site_id";
      request.query.brief = "yes";
      const { cohort_id, grid_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (cohort_id) {
        await processCohortIds(cohort_id, request);
        if (isEmpty(request.query.device_id)) {
          locationErrors++;
        }
      } else if (grid_id) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        logObject("the request.query we are sending", request.query);

        const result = await createEventUtil.list(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;

          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : { message: "" };
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided measurement IDs`,
          },
          message: "Internal Server Error",
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
  listHistorical: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.recent = "no";
      request.query.metadata = "site_id";
      request.query.brief = "yes";
      const { cohort_id, grid_id } = { ...req.query, ...req.params };
      let locationErrors = 0;
      if (cohort_id) {
        await processCohortIds(cohort_id, request);
        if (isEmpty(request.query.device_id)) {
          locationErrors++;
        }
      } else if (grid_id) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        const result = await createEventUtil.list(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors ? result.errors : { message: "" };
          res.status(status).json({
            success: false,
            errors,
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided measurement IDs`,
          },
          message: "Internal Server Error",
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
  listRunningDevices: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.running = "yes";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("the result for listing events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        const devices = result.data[0].data || [];
        const meta = result.data[0].meta;
        if (devices && Array.isArray(devices)) {
          devices.forEach((device) => {
            delete device.aqi_color;
            delete device.aqi_category;
            delete device.aqi_color_name;
          });
        }

        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: "successfully returned the active and running devices",
          meta,
          devices,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors ? result.errors : { message: "" };
        res.status(status).json({
          success: false,
          errors,
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
  listGood: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.index = "good";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("the result for listing events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors ? result.errors : { message: "" };
        res.status(status).json({
          success: false,
          errors,
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
  listModerate: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.index = "moderate";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("the result for listing events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors ? result.errors : { message: "" };
        res.status(status).json({
          success: false,
          errors,
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
  listU4sg: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.index = "u4sg";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("the result for listing events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors ? result.errors : { message: "" };
        res.status(status).json({
          success: false,
          errors,
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
  listUnhealthy: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.index = "unhealthy";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("the result for listing events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors ? result.errors : { message: "" };
        res.status(status).json({
          success: false,
          errors,
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
  listVeryUnhealthy: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.index = "very_unhealthy";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("the result for listing events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors ? result.errors : { message: "" };
        res.status(status).json({
          success: false,
          errors,
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
  listHazardous: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.index = "hazardous";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("the result for listing events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors ? result.errors : { message: "" };
        res.status(status).json({
          success: false,
          errors,
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
  transform: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createEventUtil.transformManyEvents(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          message: result.message,
          transformedEvents: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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
  create: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      const result = await createEventUtil.create(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("result util", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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
  transmitMultipleSensorValues: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { device_number, chid } = req.query;

      request.query.device_number = device_number || chid;

      const result = await createEventUtil.transmitMultipleSensorValues(
        request,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          result: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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
  bulkTransmitMultipleSensorValues: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { device_number, chid } = req.query;
      request.query.device_number = device_number || chid;

      const result = await createEventUtil.bulkTransmitMultipleSensorValues(
        request,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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
  transmitValues: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createEventUtil.transmitValues(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          result: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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
  deleteValuesOnPlatform: async (req, res, next) => {
    try {
      logText("the delete values operation starts....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createEventUtil.clearEventsOnPlatform(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.error ? result.error : { message: "" },
        });
      } else if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
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
  addEvents: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createEventUtil.addEvents(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: "finished the operation with some errors",
          errors: result.error ? result.error : { message: "" },
        });
      } else if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully added all the events",
          stored_events: result.data,
          errors: result.error ? result.error : { message: "" },
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
  listByAirQloud: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.metadata = "site_id";
      request.query.brief = "yes";
      request.query.recent = "yes";

      const { airqloud_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (airqloud_id) {
        await processAirQloudIds(airqloud_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        const result = await createEventUtil.list(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("the result for listing events", result);

        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            errors: result.errors ? result.errors : { message: "" },
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided AirQloud IDs ${airqloud_id}`,
          },
          message: "Internal Server Error",
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
  listByAirQloudHistorical: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.metadata = "site_id";
      request.query.brief = "yes";
      request.query.recent = "no";

      const { airqloud_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (airqloud_id) {
        await processAirQloudIds(airqloud_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        const result = await createEventUtil.list(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }
        logObject("the result for listing events", result);

        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            errors: result.errors ? result.errors : { message: "" },
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided AirQloud IDs ${airqloud_id}`,
          },
          message: "Internal Server Error",
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
  listByGridHistorical: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.metadata = "site_id";
      request.query.brief = "yes";
      request.query.recent = "no";

      const { grid_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (grid_id) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        logObject("the request.query we are sending", request.query);
        const result = await createEventUtil.list(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("the result for listing events", result);

        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            errors: result.errors ? result.errors : { message: "" },
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided Grid IDs ${grid_id}`,
          },
          message: "Internal Server Error",
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
  listByGrid: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.metadata = "site_id";
      request.query.brief = "yes";
      request.query.recent = "yes";
      const { grid_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (grid_id) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        logObject("the request.query we are sending", request.query);
        const result = await createEventUtil.list(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("the result for listing events", result);

        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            errors: result.errors ? result.errors : { message: "" },
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided Grid IDs ${grid_id}`,
          },
          message: "Internal Server Error",
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
  listByCohort: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.metadata = "device_id";
      request.query.brief = "yes";
      request.query.recent = "yes";
      const { cohort_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (cohort_id) {
        await processCohortIds(cohort_id, request);
        if (isEmpty(request.query.device_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        logObject("the request.query we are sending", request.query);

        const result = await createEventUtil.list(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("the result for listing events", result);

        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            errors: result.errors ? result.errors : { message: "" },
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided Cohort IDs ${cohort_id}`,
          },
          message: "Internal Server Error",
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
  listByCohortHistorical: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.metadata = "device_id";
      request.query.brief = "yes";
      request.query.recent = "no";
      const { cohort_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (cohort_id) {
        await processCohortIds(cohort_id, request);
        if (isEmpty(request.query.device_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        logObject("the request.query we are sending", request.query);

        const result = await createEventUtil.list(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("the result for listing events", result);

        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            errors: result.errors ? result.errors : { message: "" },
            message: result.message,
          });
        }
      } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided Cohort IDs ${cohort_id}`,
          },
          message: "Internal Server Error",
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
  listByLatLong: async (req, res, next) => {
    try {
      let { latitude, longitude } = req.params;
      let { tenant, radius } = req.query;

      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.metadata = "site_id";
      request.query.brief = "yes";
      request.query.recent = "yes";

      const result = await getSitesFromLatitudeAndLongitude({
        latitude,
        longitude,
        tenant,
        radius,
      });

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("result", result);
      if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json(result);
      } else if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        if (isEmpty(result.data)) {
          res.status(status).json(result);
        } else {
          request.query.site_id = result.data;

          const result = await createEventUtil.list(request, next);

          logObject("the result for listing events", result);

          if (result.success === true) {
            const status = result.status ? result.status : httpStatus.OK;
            res.status(status).json({
              success: true,
              isCache: result.isCache,
              message: result.message,
              meta: result.data[0].meta,
              measurements: result.data[0].data,
            });
          } else if (result.success === false) {
            const status = result.status
              ? result.status
              : httpStatus.INTERNAL_SERVER_ERROR;
            res.status(status).json({
              success: false,
              errors: result.errors ? result.errors : { message: "" },
              message: result.message,
            });
          }
        }
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

module.exports = createEvent;
