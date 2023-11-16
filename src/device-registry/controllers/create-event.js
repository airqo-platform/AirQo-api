const httpStatus = require("http-status");
const constants = require("@config/constants");
const { logObject, logText, logElement } = require("@utils/log");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-event-controller`
);
const errors = require("@utils/errors");
const { validationResult } = require("express-validator");
const isEmpty = require("is-empty");
const createEventUtil = require("@utils/create-event");
const AirQloudModel = require("@models/Airqloud");
const SiteModel = require("@models/Site");
const CohortModel = require("@models/Cohort");
const GridModel = require("@models/Grid");
const distanceUtil = require("@utils/distance");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const generateFilter = require("@utils/generate-filter");

const getSitesFromAirQloud = async ({ tenant = "airqo", airqloud_id } = {}) => {
  try {
    const airQloud = await AirQloudModel(tenant)
      .findById(airqloud_id)
      .lean();
    logObject("airQloud", airQloud);

    if (!airQloud) {
      return {
        success: false,
        message: "Bad Request Error",
        status: httpStatus.BAD_REQUEST,
        errors: { message: "No distinct AirQloud found in this search" },
      };
    }

    const sites = airQloud.sites || [];

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

    // Join the siteIds into a comma-separated string
    const commaSeparatedIds = siteIds.join(",");

    return {
      success: true,
      message: "Successfully retrieved the sites for this AirQloud",
      data: commaSeparatedIds || [],
      status: httpStatus.OK,
    };
  } catch (error) {
    logObject("error", error);
    logger.error(`internal server error -- ${JSON.stringify(error)}`);
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
    logger.error(`internal server error -- ${JSON.stringify(error)}`);
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
        const distanceSquaredA = distanceUtil.getDistanceSquared(
          latitude,
          longitude,
          a.latitude,
          a.longitude
        );
        const distanceSquaredB = distanceUtil.getDistanceSquared(
          latitude,
          longitude,
          b.latitude,
          b.longitude
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
    logger.error(`internal server error -- ${JSON.stringify(error)}`);
    return {
      success: false,
      message: "Internal Server Error",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
  }
};
const processGridIds = async (grid_ids, request) => {
  const gridIdArray = Array.isArray(grid_ids) ? grid_ids : grid_ids.split(",");
  logObject("gridIdArray", gridIdArray);
  // Use Promise.all to concurrently process each grid_id
  const siteIdPromises = gridIdArray.map(async (grid_id) => {
    if (!isEmpty(grid_id)) {
      logObject("grid_id under processGridIds", grid_id);
      const responseFromGetSitesOfGrid = await getSitesFromGrid({ grid_id });

      logObject("responseFromGetSitesOfGrid", responseFromGetSitesOfGrid);

      if (responseFromGetSitesOfGrid.success === false) {
        return responseFromGetSitesOfGrid;
      } else if (isEmpty(responseFromGetSitesOfGrid.data)) {
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
      const randomSite =
        arrayOfSites[Math.floor(Math.random() * arrayOfSites.length)];
      logObject("randomSite", randomSite);
      return randomSite;
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
      `Bad Request Error --- ${JSON.stringify(invalidSiteIdResults)}`
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
    : cohort_ids.split(",");

  // Use Promise.all to concurrently process each cohort_id
  const deviceIdsPromises = cohortIdArray.map(async (cohort_id) => {
    if (!isEmpty(cohort_id)) {
      const responseFromGetDevicesOfCohort = await getDevicesFromCohort({
        cohort_id,
      });

      if (responseFromGetDevicesOfCohort.success === false) {
        return responseFromGetDevicesOfCohort;
      } else if (isEmpty(responseFromGetDevicesOfCohort.data)) {
        return {
          success: false,
          message: `The provided Cohort ID ${cohort_id} does not have any associated Device IDs`,
        };
      }
      const arrayOfDevices = responseFromGetDevicesOfCohort.data.split(",");
      const randomDevice =
        responseFromGetDevicesOfCohort.data[
          Math.floor(Math.random() * arrayOfDevices.length)
        ];
      return randomDevice;
    }
  });

  // Wait for all promises to resolve
  const deviceIdsResults = await Promise.all(deviceIdsPromises);

  const invalidDeviceIdResults = deviceIdsResults.filter(
    (result) => result.success === false
  );

  if (!isEmpty(invalidDeviceIdResults)) {
    logger.error(
      `Bad Request Errors --- ${JSON.stringify(invalidDeviceIdResults)}`
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

const createEvent = {
  addValues: async (req, res) => {
    try {
      logText("adding values...");
      const { tenant } = req.query;
      const measurements = req.body;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let response = await createEventUtil.insert(tenant, measurements);

      if (!response.success) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "finished the operation with some errors",
          errors: response.errors,
        });
      } else {
        return res.status(httpStatus.OK).json({
          success: true,
          message: "successfully added all the events",
        });
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "server side error , create events - controller",
        errors: { message: e.message },
      });
    }
  },
  listFromBigQuery: async (req, res) => {
    try {
      const { query } = req;
      const { format } = query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const responseFromListFromBigQuery = await createEventUtil.getMeasurementsFromBigQuery(
        req
      );
      if (responseFromListFromBigQuery.success === true) {
        const status = responseFromListFromBigQuery.status
          ? responseFromListFromBigQuery.status
          : httpStatus.OK;
        if (format && format === "csv") {
          return res
            .status(status)
            .set({
              "Content-Type": "text/csv",
              "Content-Disposition": `attachment; filename="airqo-data-export.csv"`,
            })
            .type("text/csv")
            .send(responseFromListFromBigQuery.data);
        }
        return res.status(status).json({
          success: true,
          measurements: responseFromListFromBigQuery.data,
          message: "successfully retrieved the measurements",
        });
      } else if (responseFromListFromBigQuery.success === false) {
        const status = responseFromListFromBigQuery.status
          ? responseFromListFromBigQuery.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListFromBigQuery.message,
          errors: responseFromListFromBigQuery.errors
            ? responseFromListFromBigQuery.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  latestFromBigQuery: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const result = await createEventUtil.latestFromBigQuery(request);

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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      logText("we are listing events...");
      const { site_id, device_id, site, device } = {
        ...req.params,
        ...req.query,
      };

      let request = Object.assign({}, req);

      if (isEmpty(req.query.tenant)) {
        request.query.tenant = "airqo";
      }

      if (!isEmpty(site_id) || !isEmpty(site)) {
        request.query.recent = "no";
        request.query.metadata = "site_id";
      }

      if (!isEmpty(device_id) || !isEmpty(device)) {
        request.query.recent = "no";
        request.query.metadata = "device_id";
      }

      request.query.brief = "yes";

      const result = await createEventUtil.list(request);
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
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error!",
        errors: { message: error.message },
      });
    }
  },
  listForMap: async (req, res) => {
    try {
      logText("we are listing events for the AirQo Map...");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
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

      const result = await createEventUtil.list(request);

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
      logger.error(`Internal Server Error -- ${error.message}`);
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error!",
        errors: { message: error.message },
      });
    }
  },
  listEventsForAllDevices: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.recent = "no";
      request.query.brief = "yes";
      request.query.metadata = "device";
      request.query.tenant = tenant;

      const result = await createEventUtil.list(request);

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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listRecent: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
      if (isEmpty(req.query.tenant)) {
        request.query.tenant = "airqo";
      }
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

        const result = await createEventUtil.list(request);

        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          const measurementsForDeployedDevices = result.data[0].data.filter(
            (obj) => {
              if (obj.siteDetails === null) {
                return false; // Exclude if siteDetails is null
              }

              const { pm2_5 } = obj;
              if (pm2_5 && pm2_5.value === null) {
                logger.error(
                  `A deployed Device is returning null values for pm2_5 -- the device_name is ${
                    obj.device ? obj.device : ""
                  } -- the timestamp is ${
                    obj.time ? obj.time : ""
                  } -- the frequency is ${
                    obj.frequency ? obj.frequency : ""
                  } -- the site_name is ${
                    obj.siteDetails ? obj.siteDetails.name : ""
                  }`
                );
                return false; // Exclude if either value is null
              }

              return true; // Include for other cases
            }
          );

          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: measurementsForDeployedDevices,
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
            message: `Unable to process measurements for the provided location IDs`,
          },
          message: "Internal Server Error",
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listHistorical: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
      if (isEmpty(req.query.tenant)) {
        request.query.tenant = "airqo";
      }
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
        const result = await createEventUtil.list(request);

        logObject("the result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          const measurementsForDeployedDevices = result.data[0].data.filter(
            (obj) => {
              if (obj.siteDetails === null) {
                return false; // Exclude if siteDetails is null
              }

              const { pm2_5 } = obj;
              if (pm2_5 && pm2_5.value === null) {
                logger.error(
                  `A deployed Device is returning null values for pm2_5 -- the device_name is ${
                    obj.device ? obj.device : ""
                  } -- the timestamp is ${
                    obj.time ? obj.time : ""
                  } -- the frequency is ${
                    obj.frequency ? obj.frequency : ""
                  } -- the site_name is ${
                    obj.siteDetails ? obj.siteDetails.name : ""
                  }`
                );
                return false; // Exclude if either value is null
              }

              return true; // Include for other cases
            }
          );

          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: measurementsForDeployedDevices,
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
            message: `Unable to process measurements for the provided location IDs`,
          },
          message: "Internal Server Error",
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listRunningDevices: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);

      request.query.tenant = tenant;
      request.query.running = "yes";

      const result = await createEventUtil.list(request);

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
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listGood: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.index = "good";
      request.query.tenant = tenant;
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request);

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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listModerate: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.index = "moderate";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request);

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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listU4sg: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.index = "u4sg";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request);

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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listUnhealthy: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.index = "unhealthy";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request);
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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listVeryUnhealthy: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.index = "very_unhealthy";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request);
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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listHazardous: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.index = "hazardous";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtil.list(request);
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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  transform: async (req, res) => {
    try {
      const { tenant } = req.query;
      let request = Object.assign({}, req);

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;

      const responseFromTransformEvents = await createEventUtil.transformManyEvents(
        request
      );

      if (responseFromTransformEvents.success === true) {
        const status = responseFromTransformEvents.status
          ? responseFromTransformEvents.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromTransformEvents.message,
          transformedEvents: responseFromTransformEvents.data,
        });
      } else if (responseFromTransformEvents.success === false) {
        const status = responseFromTransformEvents.status
          ? responseFromTransformEvents.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromTransformEvents.message,
          errors: responseFromTransformEvents.errors
            ? responseFromTransformEvents.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      let request = Object.assign({}, req);

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;
      const responseFromCreateEvents = await createEventUtil.create(request);
      logObject("responseFromCreateEvents util", responseFromCreateEvents);
      if (responseFromCreateEvents.success === true) {
        const status = responseFromCreateEvents.status
          ? responseFromCreateEvents.status
          : httpStatus.OK;
        return res
          .status(status)
          .json({ success: true, message: responseFromCreateEvents.message });
      } else if (responseFromCreateEvents.success === false) {
        const status = responseFromCreateEvents.status
          ? responseFromCreateEvents.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateEvents.message,
          errors: responseFromCreateEvents.errors
            ? responseFromCreateEvents.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  transmitMultipleSensorValues: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { device_number, chid, tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.device_number = device_number || chid;

      const responseFromTransmitMultipleSensorValues = await createEventUtil.transmitMultipleSensorValues(
        request
      );

      if (responseFromTransmitMultipleSensorValues.success === true) {
        const status = responseFromTransmitMultipleSensorValues.status
          ? responseFromTransmitMultipleSensorValues.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromTransmitMultipleSensorValues.message,
          response: responseFromTransmitMultipleSensorValues.data,
        });
      } else {
        const status = responseFromTransmitMultipleSensorValues.status
          ? responseFromTransmitMultipleSensorValues.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromTransmitMultipleSensorValues.message,
          errors: responseFromTransmitMultipleSensorValues.errors
            ? responseFromTransmitMultipleSensorValues.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  bulkTransmitMultipleSensorValues: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { device_number, chid, tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.device_number = device_number || chid;

      const responseFromBulkTransmitMultipleSensorValues = await createEventUtil.bulkTransmitMultipleSensorValues(
        request
      );

      if (responseFromBulkTransmitMultipleSensorValues.success === true) {
        const status = responseFromBulkTransmitMultipleSensorValues.status
          ? responseFromBulkTransmitMultipleSensorValues.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromBulkTransmitMultipleSensorValues.message,
        });
      } else {
        const status = responseFromBulkTransmitMultipleSensorValues.status
          ? responseFromBulkTransmitMultipleSensorValues.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromBulkTransmitMultipleSensorValues.message,
          errors: responseFromBulkTransmitMultipleSensorValues.errors
            ? responseFromBulkTransmitMultipleSensorValues.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  transmitValues: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromTransmitValues = await createEventUtil.transmitValues(
        request
      );

      if (responseFromTransmitValues.success === true) {
        const status = responseFromTransmitValues.status
          ? responseFromTransmitValues.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromTransmitValues.message,
          response: responseFromTransmitValues.data,
        });
      } else {
        const status = responseFromTransmitValues.status
          ? responseFromTransmitValues.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromTransmitValues.message,
          errors: responseFromTransmitValues.errors
            ? responseFromTransmitValues.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  deleteValuesOnPlatform: async (req, res) => {
    try {
      logText("the delete values operation starts....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(res, "bad request errors", nestedErrors);
      }
      const { body } = req;
      let request = {};
      request.query = { ...req.query, body };

      if (responseFromClearValuesOnPlatform.success === false) {
        const status = responseFromClearValuesOnPlatform.status
          ? responseFromClearValuesOnPlatform.status
          : httpStatus.BAD_GATEWAY;
        return res.status(status).json({
          success: false,
          message: responseFromClearValuesOnPlatform.message,
          errors: responseFromClearValuesOnPlatform.error
            ? responseFromClearValuesOnPlatform.error
            : { message: "" },
        });
      } else if (responseFromClearValuesOnPlatform.success === true) {
        const status = responseFromClearValuesOnPlatform.status
          ? responseFromClearValuesOnPlatform.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromClearValuesOnPlatform.message,
          data: responseFromClearValuesOnPlatform.data,
        });
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },
  addEvents: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      let responseFromAddEventsUtil = await createEventUtil.addEvents(request);

      logObject("responseFromAddEventsUtil", responseFromAddEventsUtil);

      if (responseFromAddEventsUtil.success === false) {
        const status = responseFromAddEventsUtil.status
          ? responseFromAddEventsUtil.status
          : httpStatus.FORBIDDEN;
        return res.status(status).json({
          success: false,
          message: "finished the operation with some errors",
          errors: responseFromAddEventsUtil.error
            ? responseFromAddEventsUtil.error
            : { message: "" },
        });
      } else if (responseFromAddEventsUtil.success === true) {
        const status = responseFromAddEventsUtil.status
          ? responseFromAddEventsUtil.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully added all the events",
          stored_events: responseFromAddEventsUtil.data,
        });
      }
    } catch (e) {
      logger.error(`addValue -- ${e.message}`);
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        message: "internal server error",
        errors: { message: e.message },
      });
    }
  },
  listByAirQloud: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { airqloud_id } = req.params;
      let { tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.external = "no";
      request.query.tenant = tenant;
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const responseFromGetSitesOfAirQloud = await getSitesFromAirQloud({
        airqloud_id,
      });

      logObject(
        "responseFromGetSitesOfAirQloud",
        responseFromGetSitesOfAirQloud
      );

      if (responseFromGetSitesOfAirQloud.success === false) {
        const status = responseFromGetSitesOfAirQloud.status
          ? responseFromGetSitesOfAirQloud.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json(responseFromGetSitesOfAirQloud);
      } else if (responseFromGetSitesOfAirQloud.success === true) {
        if (isEmpty(responseFromGetSitesOfAirQloud.data)) {
          const status = responseFromGetSitesOfAirQloud.status
            ? responseFromGetSitesOfAirQloud.status
            : httpStatus.OK;
          return res.status(status).json(responseFromGetSitesOfAirQloud);
        }
        request.query.site_id = responseFromGetSitesOfAirQloud.data;
      }

      const result = await createEventUtil.list(request);

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
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listByGrid: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { grid_id } = req.params;
      let { tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.external = "no";
      request.query.tenant = tenant;
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const responseFromGetSitesOfGrid = await getSitesFromGrid({
        grid_id,
      });

      logObject("responseFromGetSitesOfGrid", responseFromGetSitesOfGrid);

      if (responseFromGetSitesOfGrid.success === false) {
        const status = responseFromGetSitesOfGrid.status
          ? responseFromGetSitesOfGrid.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json(responseFromGetSitesOfGrid);
      } else if (responseFromGetSitesOfGrid.success === true) {
        if (isEmpty(responseFromGetSitesOfGrid.data)) {
          const status = responseFromGetSitesOfGrid.status
            ? responseFromGetSitesOfGrid.status
            : httpStatus.OK;
          return res.status(status).json(responseFromGetSitesOfGrid);
        }
        request.query.site_id = responseFromGetSitesOfGrid.data;
      }

      const result = await createEventUtil.list(request);

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
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listByCohort: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }

      let { cohort_id } = req.params;
      let { tenant } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.external = "no";
      request.query.tenant = tenant;
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const responseFromGetDevicesOfCohort = await getDevicesFromCohort({
        cohort_id,
      });

      logObject(
        "responseFromGetDevicesOfCohort",
        responseFromGetDevicesOfCohort
      );

      if (responseFromGetDevicesOfCohort.success === false) {
        const status = responseFromGetDevicesOfCohort.status
          ? responseFromGetDevicesOfCohort.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json(responseFromGetDevicesOfCohort);
      } else if (responseFromGetDevicesOfCohort.success === true) {
        if (isEmpty(responseFromGetDevicesOfCohort.data)) {
          const status = responseFromGetDevicesOfCohort.status
            ? responseFromGetDevicesOfCohort.status
            : httpStatus.OK;
          return res.status(status).json({
            success: true,
            message: `The provided Cohort ID ${cohort_id} does not have any associated Device IDs`,
          });
        }
        request.query.device_id = responseFromGetDevicesOfCohort.data;
      }

      const result = await createEventUtil.list(request);

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
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listByLatLong: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { latitude, longitude } = req.params;

      let { tenant, radius } = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      logObject("lati", latitude);
      logObject("longi", longitude);
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.metadata = "site_id";
      request.query.brief = "yes";
      request.query.recent = "yes";

      const responseFromGetSitesFromLatitudeAndLongitude = await getSitesFromLatitudeAndLongitude(
        { latitude, longitude, tenant, radius }
      );
      logObject(
        "responseFromGetSitesFromLatitudeAndLongitude",
        responseFromGetSitesFromLatitudeAndLongitude
      );
      if (responseFromGetSitesFromLatitudeAndLongitude.success === false) {
        const status = responseFromGetSitesFromLatitudeAndLongitude.status
          ? responseFromGetSitesFromLatitudeAndLongitude.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res
          .status(status)
          .json(responseFromGetSitesFromLatitudeAndLongitude);
      } else if (
        responseFromGetSitesFromLatitudeAndLongitude.success === true
      ) {
        const status = responseFromGetSitesFromLatitudeAndLongitude.status
          ? responseFromGetSitesFromLatitudeAndLongitude.status
          : httpStatus.OK;
        if (isEmpty(responseFromGetSitesFromLatitudeAndLongitude.data)) {
          res.status(status).json(responseFromGetSitesFromLatitudeAndLongitude);
        } else {
          request.query.site_id =
            responseFromGetSitesFromLatitudeAndLongitude.data;

          const result = await createEventUtil.list(request);

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
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createEvent;
