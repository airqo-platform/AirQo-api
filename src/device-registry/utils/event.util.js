const EventModel = require("@models/Event");
const ReadingModel = require("@models/Reading");
const SignalModel = require("@models/Signal");
const DeviceModel = require("@models/Device");
const AirQloudModel = require("@models/Airqloud");
const GridModel = require("@models/Grid");
const CohortModel = require("@models/Cohort");
const SiteModel = require("@models/Site");
const { intelligentFetch } = require("@utils/readings/fetch.util");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  logTextWithTimestamp,
} = require("@utils/shared");
const constants = require("@config/constants");
const {
  generateFilter,
  generateDateFormatWithoutHrs,
  addMonthsToProvideDateTime,
  formatDate,
  translate,
  stringify,
  ActivityLogger,
} = require("@utils/common");
const isEmpty = require("is-empty");
const cryptoJS = require("crypto-js");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- event-util`);
const { transform } = require("node-json-transform");
const Dot = require("dot-object");
const cleanDeep = require("clean-deep");
const redis = require("@config/redis");
const axios = require("axios");
const { BigQuery } = require("@google-cloud/bigquery");
const bigquery = new BigQuery();
const { Parser } = require("json2csv");
const httpStatus = require("http-status");
const {
  redisGetAsync,
  redisSetAsync,
  redisExpireAsync,
} = require("@config/redis");
const asyncRetry = require("async-retry");
const CACHE_TIMEOUT_PERIOD = constants.CACHE_TIMEOUT_PERIOD || 10000;
let lastRedisWarning = 0;
const REDIS_WARNING_THROTTLE = 30 * 60 * 1000; // 30 minutes throttle (30 minutes * 60 seconds * 1000 milliseconds)

// Helper function for throttled Redis warnings
const logRedisWarning = (operation) => {
  const now = Date.now();
  if (now - lastRedisWarning > REDIS_WARNING_THROTTLE) {
    logger.warn(`Redis connection not available, skipping cache ${operation}`);
    lastRedisWarning = now;
  }
};

/**
 * Determines if a request is for historical measurements that should be optimized
 * @param {Object} request - The request object
 * @returns {Boolean} - True if this is a historical measurement request
 */
const isHistoricalMeasurement = (request) => {
  const { query, params } = request;
  const { startTime, endTime, historical, optimize, recent } = {
    ...query,
    ...params,
  };

  // Check if explicitly marked as historical
  if (historical === "yes" || optimize === "yes") {
    return true;
  }

  // Check if recent is explicitly set to "no"
  if (recent === "no") {
    return true;
  }

  // Check if the time range is more than 7 days old
  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // If the entire time range is older than 7 days, consider it historical
    if (end < sevenDaysAgo) {
      return true;
    }
  }

  return false;
};

const listDevices = async (request, next) => {
  try {
    const { tenant, limit, skip } = request.query;
    logObject("the request for the filter", request);
    const filter = generateFilter.devices(request, next);
    const responseFromListDevice = await DeviceModel(tenant).list(
      {
        filter,
        limit,
        skip,
      },
      next
    );
    if (responseFromListDevice.success === false) {
      let errors = responseFromListDevice.errors
        ? responseFromListDevice.errors
        : { message: "" };
      try {
        let errorsString = errors ? stringify(errors) : "";
        logger.error(
          `responseFromListDevice was not a success -- ${responseFromListDevice.message} -- ${errorsString}`
        );
      } catch (error) {
        logger.error(`internal server error -- ${error.message}`);
      }
      return responseFromListDevice;
    } else if (responseFromListDevice.success === true) {
      let data = responseFromListDevice.data;
      // logger.info(`responseFromListDevice was a success -- ${data}`);
      return responseFromListDevice;
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
const decryptKey = async (encryptedKey, next) => {
  try {
    let bytes = cryptoJS.AES.decrypt(
      encryptedKey,
      constants.KEY_ENCRYPTION_KEY
    );
    let originalText = bytes.toString(cryptoJS.enc.Utf8);
    let isKeyUnknown = isEmpty(originalText);
    if (isKeyUnknown) {
      return {
        success: true,
        status: httpStatus.NOT_FOUND,
        message: "the provided encrypted key is not recognizable",
      };
    } else {
      return {
        success: true,
        message: "successfully decrypted the text",
        data: originalText,
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
async function transformOneReading(
  { data = {}, map = {}, context = {} } = {},
  next
) {
  try {
    const transformedEvent = transform(data, map, context);

    const validValues = transformedEvent.values.filter((value) => {
      let isValid = true;
      for (const key in map.item) {
        // Use the provided map for consistency
        if (typeof value[key] === "number" && value[key] <= 0) {
          isValid = false;
          break;
        }
      }
      return isValid;
    });

    if (validValues.length === 0) {
      return {
        success: false,
        message: "All values zero or less; discarding.",
      };
    }
    transformedEvent.values = validValues;
    if (transformedEvent.values.length < transformedEvent.nValues) {
      transformedEvent.nValues = validValues.length;
    }
    return {
      success: true,
      message: "successfully transformed the provided event",
      data: transformedEvent,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
}
async function transformManyReadings(request, next) {
  try {
    const { body } = request;
    let promises = body.map(async (event) => {
      const data = event;
      const map = constants.EVENT_MAPPINGS;
      const responseFromTransformEvent = await transformOneReading(
        {
          data,
          map,
        },
        next
      );
      if (responseFromTransformEvent.success === true) {
        logger.info(`Transformed event: ${JSON.stringify(event)}`);
        return responseFromTransformEvent;
      } else if (responseFromTransformEvent.success === false) {
        let errors = responseFromTransformEvent.errors
          ? responseFromTransformEvent.errors
          : { message: "" };
        logger.error(`Failed to transform event -- ${stringify(errors)}`);
        return responseFromTransformEvent;
      }
    });

    return Promise.allSettled(promises).then((results) => {
      let transforms = [];
      let errors = [];
      for (let i = 0; i < results.length; i++) {
        let result = results[i];
        if (result.status === "fulfilled") {
          if (result.value.success) {
            transforms.push(result.value.data);
          } else {
            errors.push(result.value); // Collect errors about discarded events if needed
          }
        } else if (result.status === "rejected") {
          let error = result.reason.errors
            ? result.reason.errors
            : { message: "" };
          errors.push(error);
        }
      }
      return buildResponse(errors, transforms);
    });
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
}
function buildResponse(errors, transforms) {
  if (errors.length > 0) {
    return {
      success: false,
      errors,
      message: "Some operational errors occurred while transforming",
      data: transforms,
      status: httpStatus.BAD_REQUEST,
    };
  } else if (errors.length === 0) {
    return {
      success: true,
      errors,
      message: "Transformation completed successfully",
      data: transforms,
      status: httpStatus.OK,
    };
  }
}
function determineResponse(nAdded, eventsAdded, eventsRejected, errors) {
  if (errors.length > 0 && nAdded === 0) {
    return {
      success: false,
      status: httpStatus.CONFLICT,
      message: "All operations failed with conflicts",
      errors,
      eventsAdded,
      eventsRejected,
    };
  } else if (errors.length > 0 && nAdded > 0) {
    return {
      success: true,
      status: httpStatus.OK,
      message: "Finished the operation with some conflicts",
      errors,
      eventsAdded,
      eventsRejected,
    };
  } else if (errors.length === 0 && nAdded > 0) {
    return {
      success: true,
      status: httpStatus.OK,
      message: "Successfully added all the events",
      eventsAdded,
      eventsRejected,
    };
  }
}
async function processEvent(event, next) {
  try {
    logObject("event", event);
    let value = event;
    let dot = new Dot(".");
    let options = event.options;
    let filter = cleanDeep(event.filter);
    let update = event.update;
    dot.delete(["filter", "update", "options"], value);

    const validValues = event.values.filter((valItem) => {
      let isValid = true;
      for (const key in constants.EVENT_MAPPINGS.item) {
        if (typeof valItem[key] === "number" && valItem[key] <= 0) {
          isValid = false;
          break;
        }
      }
      return isValid;
    });

    if (validValues.length === 0) {
      logger.warn(
        `Discarding event with all zero/negative values: ${JSON.stringify(
          value
        )}`
      );

      // Log the rejected event
      await ActivityLogger.logActivity({
        operation_type: "INSERT",
        entity_type: "EVENT",
        status: "FAILURE",
        records_attempted: event.values ? event.values.length : 1,
        records_successful: 0,
        records_failed: event.values ? event.values.length : 1,
        tenant: event.tenant || "airqo",
        source_function: "processEvent",
        error_details: "All values zero or negative, discarded",
        error_code: "INVALID_VALUES",
        entity_id: event.device_id,
        metadata: {
          device: event.device,
          site_id: event.site_id,
          original_values_count: event.values ? event.values.length : 0,
        },
      });

      return { added: false };
    }

    value.values = validValues;
    update["$push"] = { values: { $each: value.values } };
    update["$inc"] = { nValues: validValues.length };

    const addedEvents = await EventModel(event.tenant).updateOne(
      filter,
      update,
      options
    );

    if (addedEvents) {
      // Log successful insertion
      await ActivityLogger.logActivity({
        operation_type: "INSERT",
        entity_type: "EVENT",
        status: "SUCCESS",
        records_attempted: event.values ? event.values.length : 1,
        records_successful: validValues.length,
        records_failed: event.values
          ? event.values.length - validValues.length
          : 0,
        tenant: event.tenant || "airqo",
        source_function: "processEvent",
        entity_id: event.device_id,
        metadata: {
          device: event.device,
          site_id: event.site_id,
          valid_values_count: validValues.length,
          original_values_count: event.values ? event.values.length : 0,
        },
      });

      return {
        added: true,
        error: null,
      };
    } else {
      let errMsg = {
        message: "Unable to add the events",
        record: {
          ...(event.device ? { device: event.device } : {}),
          ...(event.frequency ? { frequency: event.frequency } : {}),
          ...(event.time ? { time: event.time } : {}),
          ...(event.device_id ? { device_id: event.device_id } : {}),
          ...(event.site_id ? { site_id: event.site_id } : {}),
        },
      };

      // Log failed insertion
      await ActivityLogger.logActivity({
        operation_type: "INSERT",
        entity_type: "EVENT",
        status: "FAILURE",
        records_attempted: validValues.length,
        records_successful: 0,
        records_failed: validValues.length,
        tenant: event.tenant || "airqo",
        source_function: "processEvent",
        error_details: errMsg.message,
        error_code: "INSERT_FAILED",
        entity_id: event.device_id,
        metadata: {
          device: event.device,
          site_id: event.site_id,
        },
      });

      return {
        added: false,
        error: errMsg,
      };
    }
  } catch (e) {
    let errMsg = {
      message: "System conflict detected, most likely a duplicate record",
      more: e.message,
      record: {
        ...(event.device ? { device: event.device } : {}),
        ...(event.frequency ? { frequency: event.frequency } : {}),
        ...(event.time ? { time: event.time } : {}),
        ...(event.device_id ? { device_id: event.device_id } : {}),
        ...(event.site_id ? { site_id: event.site_id } : {}),
      },
    };

    // Log the exception
    await ActivityLogger.logActivity({
      operation_type: "INSERT",
      entity_type: "EVENT",
      status: "FAILURE",
      records_attempted: event.values ? event.values.length : 1,
      records_successful: 0,
      records_failed: event.values ? event.values.length : 1,
      tenant: event.tenant || "airqo",
      source_function: "processEvent",
      error_details: errMsg.message,
      error_code: e.code || e.name || "EXCEPTION",
      entity_id: event.device_id,
      metadata: {
        device: event.device,
        site_id: event.site_id,
        exception_details: e.message,
      },
    });

    return {
      added: false,
      error: errMsg,
    };
  }
}
async function processEvents(events, next) {
  let nAdded = 0;
  let eventsAdded = [];
  let eventsRejected = [];
  let errors = [];

  for (const event of events) {
    try {
      let processedEvent = await processEvent(event, next);
      if (processedEvent.added) {
        nAdded += 1;
        eventsAdded.push(event);
      } else {
        eventsRejected.push(event);
        errors.push(processedEvent.error);
      }
    } catch (e) {
      eventsRejected.push(event);
      let errMsg = {
        message: "System conflict detected, most likely a duplicate record",
        more: e.message,
        record: {
          ...(event.device ? { device: event.device } : {}),
          ...(event.frequency ? { frequency: event.frequency } : {}),
          ...(event.time ? { time: event.time } : {}),
          ...(event.device_id ? { device_id: event.device_id } : {}),
          ...(event.site_id ? { site_id: event.site_id } : {}),
        },
      };
      errors.push(errMsg);
    }
  }

  return determineResponse(nAdded, eventsAdded, eventsRejected, errors);
}
class AirQualityService {
  constructor(tenant) {
    this.EventModel = EventModel(tenant);
  }

  async getAirQualityData(request, next, version = "v1") {
    const { language, site_id } = { ...request.query, ...request.params };
    const isHistorical = isHistoricalMeasurement(request);

    let responseFromListEvents;

    try {
      // Try to get from cache first
      const cacheResult = await this.tryGetCache(request, next);
      if (cacheResult.success) {
        return cacheResult.data;
      }

      const versionedFunctions = {
        v2: this.EventModel.v2_getAirQualityAverages,
        v3: this.EventModel.v3_getAirQualityAverages,
      };

      const defaultFunction = this.EventModel.getAirQualityAverages;
      const getAveragesFunction =
        versionedFunctions[version] || defaultFunction;

      // Pass the historical flag to the model method
      responseFromListEvents = await getAveragesFunction.call(
        this.EventModel,
        site_id,
        next,
        { isHistorical }
      );

      // Handle translation only for current measurements or v1
      if (!isHistorical && version === "v1") {
        await this.translateHealthTips(responseFromListEvents, language, next);
      }

      // Set cache if successful
      if (responseFromListEvents.success) {
        await this.trySetCache(responseFromListEvents.data, request, next);

        return {
          success: true,
          message: isEmpty(responseFromListEvents.data)
            ? "no measurements for this search"
            : responseFromListEvents.message,
          data: responseFromListEvents.data,
          status: responseFromListEvents.status || "",
          isCache: false,
        };
      }

      logger.error(
        `Unable to retrieve events --- ${JSON.stringify(
          responseFromListEvents.errors
        )}`
      );
      return {
        success: false,
        message: responseFromListEvents.message,
        errors: responseFromListEvents.errors || { message: "" },
        status: responseFromListEvents.status || "",
        isCache: false,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  }

  async translateHealthTips(response, language, next) {
    if (
      language !== undefined &&
      !isEmpty(response) &&
      response.success === true &&
      !isEmpty(response.data)
    ) {
      const data = response.data;
      for (const event of data) {
        const translatedHealthTips = await translate.translateTips(
          { healthTips: event.health_tips, targetLanguage: language },
          next
        );
        if (translatedHealthTips.success === true) {
          event.health_tips = translatedHealthTips.data;
        }
      }
    }
  }

  async tryGetCache(request, next) {
    try {
      return await Promise.race([
        createEvent.getCache(request, next),
        this.getCacheTimeout(),
      ]);
    } catch (error) {
      logger.error(`🐛🐛 Cache Get Error -- ${JSON.stringify(error)}`);
      return { success: false };
    }
  }

  async trySetCache(data, request, next) {
    try {
      const result = await Promise.race([
        createEvent.setCache(data, request, next),
        this.getCacheTimeout(),
      ]);

      if (!result.success) {
        logger.error(
          `🐛🐛 Cache Set Error -- ${JSON.stringify(
            result.errors || "Unknown error"
          )}`
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Cache Set Error -- ${JSON.stringify(error)}`);
    }
  }

  getCacheTimeout() {
    return new Promise((resolve) =>
      setTimeout(resolve, 60000, {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Cache timeout" },
      })
    );
  }
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
        errors: { message: "AirQloud not found" },
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

    const siteIds = sites.map((site) => site._id.toString());
    logObject("siteIds", siteIds);
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
    const responseFromListGrid = await GridModel(tenant).list({ filter });

    const gridDetails = responseFromListGrid.data[0];

    if (responseFromListGrid.data.length > 1 || isEmpty(gridDetails)) {
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

    const siteIds = sites.map((site) => site._id.toString());
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
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
const processGridIds = async (grid_ids, request) => {
  const gridIdArray = Array.isArray(grid_ids)
    ? grid_ids
    : grid_ids.toString().split(",");
  logObject("gridIdArray", gridIdArray);

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

  const deviceIdsResults = await Promise.all(deviceIdsPromises);

  const invalidDeviceIdResults = deviceIdsResults.filter(
    (result) => result.success === false
  );

  if (!isEmpty(invalidDeviceIdResults)) {
    logger.error(
      `🙅🏼🙅🏼 Bad Request Errors --- ${JSON.stringify(invalidDeviceIdResults)}`
    );
  }

  const validDeviceIdResults = deviceIdsResults.filter(
    (result) => !(result.success === false)
  );

  const flattened = [].concat(...validDeviceIdResults);

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
    }
  });

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

const isEventTimestampValid = (
  timestamp,
  maxAgeMs = constants.MAX_EVENT_AGE_MS
) => {
  try {
    if (!timestamp) {
      return { valid: false, reason: "Missing timestamp" };
    }

    const eventTime = new Date(timestamp);
    if (Number.isNaN(eventTime.getTime())) {
      return { valid: false, reason: "Invalid timestamp format" };
    }
    const now = new Date();
    const ageMs = now - eventTime;

    // Check if timestamp is in the future (with 5 minute tolerance for clock skew)
    const futureToleranceMs = 5 * 60 * 1000;
    if (ageMs < -futureToleranceMs) {
      const futureOffsetHours = (Math.abs(ageMs) / (1000 * 60 * 60)).toFixed(2);
      return {
        valid: false,
        reason: `Timestamp is ${futureOffsetHours} hours in the future`,
        futureOffsetHours: parseFloat(futureOffsetHours),
      };
    }

    // Check if timestamp is too old
    if (ageMs > maxAgeMs) {
      const ageHours = (ageMs / (1000 * 60 * 60)).toFixed(2);
      const maxAgeHours = (maxAgeMs / (1000 * 60 * 60)).toFixed(2);
      return {
        valid: false,
        reason: `Timestamp is ${ageHours} hours old (max allowed: ${maxAgeHours} hours)`,
        ageHours: parseFloat(ageHours),
        maxAgeHours: parseFloat(maxAgeHours),
      };
    }

    // Valid timestamp
    const ageHours = (ageMs / (1000 * 60 * 60)).toFixed(2);
    return {
      valid: true,
      ageHours: parseFloat(ageHours),
    };
  } catch (error) {
    return {
      valid: false,
      reason: `Invalid timestamp format: ${error.message}`,
    };
  }
};

const filterMeasurementsByTimestamp = async (measurements, next) => {
  try {
    if (!Array.isArray(measurements) || measurements.length === 0) {
      return {
        success: true,
        data: {
          valid: [],
          rejected: [],
          stats: {
            total: 0,
            accepted: 0,
            rejected: 0,
            rejectionReasons: {},
          },
        },
      };
    }

    const valid = [];
    const rejected = [];
    const rejectionReasons = {};

    for (const measurement of measurements) {
      const timestamp = measurement.time;
      const validation = isEventTimestampValid(timestamp);

      if (validation.valid) {
        valid.push(measurement);
      } else {
        rejected.push({
          measurement: {
            time: timestamp,
            device: measurement.device || measurement.device_id,
            site_id: measurement.site_id,
          },
          reason: validation.reason,
          ageHours: validation.ageHours,
        });

        // Track rejection reasons
        const reason = validation.reason;
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;

        // Log rejected measurement
        if (rejected.length <= constants.MAX_REJECTED_LOGS) {
          // Only log first 10 to avoid spam
          logger.warn(
            `Rejected measurement: timestamp ${timestamp}, ` +
              `age ${validation.ageHours}h, reason: ${validation.reason}`
          );
        }
      }
    }

    // Log summary if there were rejections
    if (rejected.length > 0) {
      logger.info(
        `Timestamp filtering: ${valid.length} accepted, ${rejected.length} rejected ` +
          `(${((rejected.length / measurements.length) * 100).toFixed(
            1
          )}% rejection rate)`
      );
      logObject("Rejection reasons summary", rejectionReasons);
    }

    return {
      success: true,
      data: {
        valid,
        rejected,
        stats: {
          total: measurements.length,
          accepted: valid.length,
          rejected: rejected.length,
          rejectionReasons,
        },
      },
    };
  } catch (error) {
    logger.error(`Error filtering measurements by timestamp: ${error.message}`);
    // On error, return all measurements to maintain backward compatibility
    return {
      success: false,
      message: "Timestamp filtering failed, proceeding with all measurements",
      data: {
        valid: measurements,
        rejected: [],
        stats: {
          total: measurements.length,
          accepted: measurements.length,
          rejected: 0,
          rejectionReasons: { filtering_error: 1 },
        },
      },
    };
  }
};

const createEvent = {
  processGridIds,
  processCohortIds,
  processAirQloudIds,
  getMeasurementsFromBigQuery: async (req, next) => {
    try {
      const { query } = req;
      const {
        frequency,
        device,
        device_name,
        device_id,
        device_lat_long,
        site_id,
        airqloud_id,
        airqloud_name,
        device_number,
        startTime,
        endTime,
        tenant,
        limit,
        skip,
        site,
        format,
        access_code,
      } = query;

      const responseFromGetDeviceDetails = await listDevices(req, next);
      let deviceDetails = {};

      if (responseFromGetDeviceDetails.success === true) {
        if (
          !isEmpty(responseFromGetDeviceDetails.data) &&
          Array.isArray(responseFromGetDeviceDetails.data) &&
          responseFromGetDeviceDetails.data.length === 1
        ) {
          deviceDetails = responseFromGetDeviceDetails.data[0];
        } else {
          // logger.info(`unable to retrieve details for ONE device`);
        }
      } else if (responseFromGetDeviceDetails.success === false) {
        try {
          logger.error(
            `unable to retrieve device details --- ${stringify(
              responseFromGetDeviceDetails.errors
            )}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
      }

      if (!isEmpty(deviceDetails) && deviceDetails.visibility === false) {
        if (isEmpty(access_code) || deviceDetails.access_code !== access_code) {
          // next(
          //   new HttpError(
          //     "Unauthorized",
          //     httpStatus.UNAUTHORIZED,
          //     { message: "not authorized" }
          //   )
          // );
        }
      }

      const currentDate = formatDate(new Date());

      const twoMonthsBack = formatDate(
        addMonthsToProvideDateTime(currentDate, -2)
      );

      const start = startTime ? startTime : twoMonthsBack;

      const end = endTime ? endTime : currentDate;

      let table = `${constants.DATAWAREHOUSE_AVERAGED_DATA}.hourly_device_measurements`;
      let averaged_fields =
        "site_id, device_id, device_number, timestamp, " +
        "pm2_5_raw_value, pm2_5_calibrated_value, hdop, pm10_raw_value," +
        "pm10_calibrated_value, no2_raw_value, no2_calibrated_value, pm1_raw_value," +
        "pm1_calibrated_value, device_temperature, device_humidity, wind_speed," +
        "humidity, temperature,";
      let raw_fields = "";
      let mobile = false;

      if (!isEmpty(deviceDetails) && deviceDetails.category === "bam") {
        table = `${constants.DATAWAREHOUSE_AVERAGED_DATA}.hourly_bam_device_measurements`;
        averaged_fields =
          "site_id, device_id, device_number, timestamp," +
          "pm10, pm2_5, no2, pm1, latitude, longitude";
        raw_fields = "";
        mobile = false;
      }

      if (frequency === "raw") {
        if (!isEmpty(deviceDetails) && deviceDetails.category === "bam") {
          raw_fields =
            "realtime_conc, hourly_conc," +
            "short_time_conc , air_flow , wind_speed ," +
            "wind_direction , temperature , humidity," +
            "barometric_pressure , filter_temperature ," +
            "filter_humidity, status, timestamp, device_id," +
            "device_number,site_id, latitude, longitude";
          averaged_fields = "";
          table = `${constants.DATAWAREHOUSE_RAW_DATA}.bam_device_measurements`;
        } else {
          table = `${constants.DATAWAREHOUSE_RAW_DATA}.device_measurements`;
          averaged_fields = "";
          raw_fields =
            "site_id, name, device_id, device_number, timestamp," +
            "pm2_5, pm10, s1_pm2_5, s2_pm2_5, s1_pm10, s2_pm10, no2," +
            "pm1, s1_pm1, s2_pm1, pressure, s1_pressure, s2_pressure, temperature," +
            "humidity, voc, s1_voc, s2_voc, wind_speed, satellites, hdop," +
            "device_temperature, device_humidity, battery,";
          mobile = false;
        }
      }

      if (tenant === "urban_better") {
        table = `${constants.DATAWAREHOUSE_RAW_DATA}.mobile_device_measurements`;
        mobile = true;
        raw_fields =
          "tenant, timestamp, device_number, device_id, latitude, longitude," +
          "horizontal_accuracy, pm2_5_raw_value, pm1_raw_value, pm10_raw_value," +
          "no2_raw_value, voc_raw_value, pm1_pi_value, pm2_5_pi_value, pm10_pi_value," +
          "voc_pi_value, no2_pi_value, gps_device_timestamp, timestamp_abs_diff";
        averaged_fields = "";
      }
      // \`${constants.DATAWAREHOUSE_METADATA}.sites\`.altitude AS altitude ,
      const queryStatement = `SELECT ${averaged_fields} ${raw_fields}  \`${
        constants.DATAWAREHOUSE_METADATA
      }.sites\`.latitude AS latitude,
        \`${constants.DATAWAREHOUSE_METADATA}.sites\`.longitude AS longitude, 
        \`${constants.DATAWAREHOUSE_METADATA}.sites\`.tenant AS tenant ,
      
        FROM \`${table}\` 
        JOIN \`${constants.DATAWAREHOUSE_METADATA}.sites\` 
        ON \`${
          constants.DATAWAREHOUSE_METADATA
        }.sites\`.id = \`${table}\`.site_id 
        WHERE timestamp 
       >= "${start ? start : twoMonthsBack}" AND timestamp <= "${
        end ? end : currentDate
      }" 
      ${site ? `AND site_id="${site}"` : ""}
      ${device ? `AND device="${device}"` : ""}
      ${device_number ? `AND device_number=${device_number}` : ""}
      ${device_name ? `AND device_name="${device_name}"` : ""}
      ${device_id ? `AND device_id="${device_id}"` : ""}
      ${site_id ? `AND site_id="${site_id}"` : ""}
      ${airqloud_id ? `AND airqloud_id="${airqloud_id}"` : ""}
      ${airqloud_name ? `AND airqloud_name="${airqloud_name}"` : ""}
      ${device_lat_long ? `AND device_lat_long="${device_lat_long}"` : ""}
      ${
        tenant
          ? `AND \`${constants.DATAWAREHOUSE_METADATA}.sites\`.tenant="${tenant}"`
          : ""
      }
      ORDER BY timestamp
      DESC LIMIT ${limit ? limit : constants.DEFAULT_EVENTS_LIMIT} OFFSET ${
        skip ? skip : constants.DEFAULT_EVENTS_SKIP
      }`;

      const queryStatementMobile = `SELECT ${averaged_fields} ${raw_fields}
      FROM \`${table}\` 
      WHERE timestamp 
      >= "${start ? start : twoMonthsBack}" AND timestamp <= "${
        end ? end : currentDate
      }" 
      ${site ? `AND site_id="${site}"` : ""}
      ${device ? `AND device="${device}"` : ""}
      ${device_number ? `AND device_number=${device_number}` : ""}
      ${device_name ? `AND device_name="${device_name}"` : ""}
      ${device_id ? `AND device_id="${device_id}"` : ""}
      ${site_id ? `AND site_id="${site_id}"` : ""}
      ${airqloud_id ? `AND airqloud_id="${airqloud_id}"` : ""}
      ${airqloud_name ? `AND airqloud_name="${airqloud_name}"` : ""}
      ${device_lat_long ? `AND device_lat_long="${device_lat_long}"` : ""}
     ${tenant ? `AND tenant="${tenant}"` : ""}
     ORDER BY timestamp
     DESC LIMIT ${limit ? limit : constants.DEFAULT_EVENTS_LIMIT} OFFSET ${
        skip ? skip : constants.DEFAULT_EVENTS_SKIP
      }
     `;

      const queryStatementReference = `SELECT ${averaged_fields} ${raw_fields}
      FROM \`${table}\` 
      WHERE timestamp 
     >= "${start ? start : twoMonthsBack}" AND timestamp <= "${
        end ? end : currentDate
      }" 
    ${site ? `AND site_id="${site}"` : ""}
    ${device ? `AND device="${device}"` : ""}
    ${device_number ? `AND device_number=${device_number}` : ""}
    ${device_name ? `AND device_name="${device_name}"` : ""}
    ${device_id ? `AND device_id="${device_id}"` : ""}
    ${site_id ? `AND site_id="${site_id}"` : ""}
    ${airqloud_id ? `AND airqloud_id="${airqloud_id}"` : ""}
    ${airqloud_name ? `AND airqloud_name="${airqloud_name}"` : ""}
    ${device_lat_long ? `AND device_lat_long="${device_lat_long}"` : ""}
    ${tenant ? `AND tenant="${tenant}"` : ""}
    ORDER BY timestamp
    DESC LIMIT ${limit ? limit : constants.DEFAULT_EVENTS_LIMIT} OFFSET ${
        skip ? skip : constants.DEFAULT_EVENTS_SKIP
      }`;

      let bqQuery = "";

      if (mobile === true) {
        bqQuery = queryStatementMobile;
      } else if (
        (!isEmpty(deviceDetails) &&
          deviceDetails.category !== "bam" &&
          mobile === false) ||
        (isEmpty(deviceDetails) && mobile === false)
      ) {
        bqQuery = queryStatement;
      } else if (
        !isEmpty(deviceDetails) &&
        deviceDetails.category === "bam" &&
        mobile === false
      ) {
        bqQuery = queryStatementReference;
      }
      // logObject("bqQuery", bqQuery);
      const options = {
        query: bqQuery,
        location: constants.BIG_QUERY_LOCATION,
      };

      const [job] = await bigquery.createQueryJob(options);

      const [rows] = await job.getQueryResults();

      const sanitizedMeasurements = rows.map((item) => {
        return {
          ...item,
          timestamp: item.timestamp ? item.timestamp.value : "",
          gps_device_timestamp:
            item.gps_device_timestamp && item.gps_device_timestamp.value
              ? item.gps_device_timestamp.value
              : "",
        };
      });

      let data = cleanDeep(sanitizedMeasurements);

      if (format && format === "csv") {
        try {
          const parser = new Parser();
          const csv = parser.parse(sanitizedMeasurements);
          data = csv;
        } catch (error) {
          logger.error(`internal server error --- ${error.message}`);
        }
      }
      return {
        success: true,
        data,
        message: "successfully retrieved the measurements",
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  latestFromBigQuery: async (req, next) => {
    try {
      const { query } = req;
      const {
        frequency,
        device,
        name,
        startTime,
        endTime,
        tenant,
        limit,
        skip,
        site,
      } = query;

      const currentDate = generateDateFormatWithoutHrs(new Date());

      const twoMonthsBack = generateDateFormatWithoutHrs(
        addMonthsToProvideDateTime(currentDate, -2)
      );

      const start = generateDateFormatWithoutHrs(
        startTime ? startTime : twoMonthsBack
      );
      const end = generateDateFormatWithoutHrs(endTime ? endTime : currentDate);

      let table = `${constants.DATAWAREHOUSE_AVERAGED_DATA}.hourly_device_measurements`;
      let pm2_5 = "";
      let pm10 = "";

      if (frequency === "raw") {
        table = `${constants.DATAWAREHOUSE_RAW_DATA}.device_measurements`;
        pm2_5 = "";
        pm10 = "";
      }

      const queryStatement = `SELECT site_id, name, device, \`${
        constants.DATAWAREHOUSE_METADATA
      }.sites\`.latitude AS latitude,
        \`${
          constants.DATAWAREHOUSE_METADATA
        }.sites\`.longitude AS longitude, timestamp, pm2_5, pm10, pm2_5_raw_value, pm2_5_calibrated_value, pm10_raw_value, pm10_calibrated_value,
        \`${constants.DATAWAREHOUSE_METADATA}.sites\`.tenant AS tenant 
        FROM \`${table}\` 
        JOIN \`${constants.DATAWAREHOUSE_METADATA}.sites\` 
        ON \`${
          constants.DATAWAREHOUSE_METADATA
        }.sites\`.id = \`${table}\`.site_id 
        WHERE timestamp  
       >= "${start ? start : twoMonthsBack}" AND timestamp <= "${
        end ? end : currentDate
      }" 
      ${site ? `AND site_id="${site}"` : ""}
      ${device ? `AND device="${device}"` : ""}
      ${
        tenant
          ? `AND \`${constants.DATAWAREHOUSE_METADATA}.sites\`.tenant="${tenant}"`
          : ""
      }
       LIMIT ${limit ? limit : constants.DEFAULT_EVENTS_LIMIT}`;

      const options = {
        query: queryStatement,
        location: constants.BIG_QUERY_LOCATION,
      };

      const [job] = await bigquery.createQueryJob(options);

      const [rows] = await job.getQueryResults();

      return {
        success: true,
        data: rows,
        message: "successfully retrieved the measurements",
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (request, next) => {
    try {
      let missingDataMessage = "";
      const { query } = request;
      let { limit, skip, recent } = query;
      const isHistorical = isHistoricalMeasurement(request);

      limit = Number(limit);
      skip = Number(skip);

      if (Number.isNaN(limit) || limit < 0) {
        limit = 30;
      }

      if (Number.isNaN(skip) || skip < 0) {
        skip = 0;
      }

      const { tenant } = query;
      let page = parseInt(query.page);
      const language = request.query.language;

      logText(
        isHistorical
          ? "Using optimized historical data query"
          : "Using standard data query with intelligent routing"
      );

      const filter = generateFilter.events(request, next);
      filter.isHistorical = isHistorical;

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      if (page) {
        skip = parseInt((page - 1) * limit);
      }

      // **PASS LIMIT AND SKIP EXPLICITLY**
      const responseFromListEvents = await intelligentFetch(
        tenant,
        filter,
        limit,
        skip,
        page
      );

      if (!responseFromListEvents) {
        logger.error(
          "Failed to retrieve data from intelligent routing system: intelligentFetch returned null or undefined."
        );
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Error retrieving events from the database",
            }
          )
        );
      }

      // Translation logic (unchanged)
      if (
        !isHistorical &&
        language !== undefined &&
        !isEmpty(responseFromListEvents) &&
        responseFromListEvents.success === true &&
        !isEmpty(responseFromListEvents.data[0].data)
      ) {
        const data = responseFromListEvents.data[0].data;
        for (const event of data) {
          const translatedHealthTips = await translate.translateTips(
            { healthTips: event.health_tips, targetLanguage: language },
            next
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      if (responseFromListEvents.success === true) {
        const data = responseFromListEvents.data;
        data[0].data = !isEmpty(missingDataMessage) ? [] : data[0].data;

        logText("Setting cache...");

        try {
          await createEvent.handleCacheOperation("set", data, request, next);
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache operation completed.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data[0].data)
            ? "no measurements for this search"
            : responseFromListEvents.message,
          data,
          status: responseFromListEvents.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(
            responseFromListEvents.errors
          )}`
        );

        return {
          success: false,
          message: responseFromListEvents.message,
          errors: responseFromListEvents.errors || { message: "" },
          status: responseFromListEvents.status || "",
          isCache: false,
        };
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
    }
  },
  listFromReadings: async (request, next) => {
    try {
      let missingDataMessage = "";
      const { query } = request;
      let { limit, skip, tenant, language } = query;

      limit = Number(limit) || 30;
      skip = Number(skip) || 0;
      let page = parseInt(query.page);

      if (page) {
        skip = parseInt((page - 1) * limit);
      }

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result from readings");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      // Generate filter for Readings collection
      const filter = generateFilter.readings(request, next);

      // Use ReadingModel for optimized queries
      const responseFromListReadings = await ReadingModel(tenant).listRecent(
        {
          filter,
          skip,
          limit,
          page,
        },
        next
      );

      if (!responseFromListReadings) {
        logger.error(`🐛🐛 ReadingModel.listRecent returned null/undefined`);
        return {
          success: false,
          message: "Database model returned null response",
          errors: { message: "Model method returned null/undefined" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }

      // Handle language translation if needed
      if (
        language !== undefined &&
        responseFromListReadings.success === true &&
        !isEmpty(responseFromListReadings.data)
      ) {
        const data = responseFromListReadings.data;
        for (const event of data) {
          try {
            const translatedHealthTips = await translate.translateTips(
              { healthTips: event.health_tips, targetLanguage: language },
              next
            );
            if (translatedHealthTips.success === true) {
              event.health_tips = translatedHealthTips.data;
            }
          } catch (translationError) {
            logger.warn(`Translation failed: ${translationError.message}`);
          }
        }
      }

      if (responseFromListReadings.success === true) {
        const data = responseFromListReadings.data;

        try {
          await createEvent.handleCacheOperation(
            "set",
            responseFromListReadings,
            request,
            next
          );
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : responseFromListReadings.message,
          data,
          status: responseFromListReadings.status || httpStatus.OK,
          isCache: false,
          source: "readings",
        };
      } else {
        logger.error(
          `Unable to retrieve readings --- ${stringify(
            responseFromListReadings.errors
          )}`
        );

        return {
          success: false,
          message: responseFromListReadings.message,
          errors: responseFromListReadings.errors || {
            message: "Database operation failed",
          },
          status:
            responseFromListReadings.status || httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in listFromReadings: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  listAveragesV1: async (request, next) => {
    try {
      let missingDataMessage = "";
      const { language, site_id, tenant } = {
        ...request.query,
        ...request.params,
      };

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const responseFromListEvents = await EventModel(
        tenant
      ).getAirQualityAverages(site_id, next);

      if (
        language !== undefined &&
        !isEmpty(responseFromListEvents) &&
        responseFromListEvents.success === true &&
        !isEmpty(responseFromListEvents.data)
      ) {
        const data = responseFromListEvents.data;
        for (const event of data) {
          const translatedHealthTips = await translate.translateTips(
            { healthTips: event.health_tips, targetLanguage: language },
            next
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      if (responseFromListEvents.success === true) {
        const data = !isEmpty(missingDataMessage)
          ? []
          : responseFromListEvents.data;

        logText("Setting cache...");

        try {
          await createEvent.handleCacheOperation("set", data, request, next);
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache set.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : responseFromListEvents.message,
          data,
          status: responseFromListEvents.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(
            responseFromListEvents.errors
          )}`
        );

        return {
          success: false,
          message: responseFromListEvents.message,
          errors: responseFromListEvents.errors || { message: "" },
          status: responseFromListEvents.status || "",
          isCache: false,
        };
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
    }
  },

  listAverages: async (request, next) => {
    const service = new AirQualityService(request.query.tenant);
    return service.getAirQualityData(request, next);
  },

  listAveragesV2: async (request, next) => {
    const service = new AirQualityService(request.query.tenant);
    return service.getAirQualityData(request, next, "v2");
  },
  listAveragesV3: async (request, next) => {
    const service = new AirQualityService(request.query.tenant);
    return service.getAirQualityData(request, next, "v3");
  },
  view: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language, recent, limit, skip },
      } = request;

      const actualLimit = Number(limit) || 1000;
      const actualSkip = Number(skip) || 0;

      const filter = generateFilter.events(request, next);

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached view result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const viewEventsResponse = await intelligentFetch(
        tenant,
        filter,
        actualLimit,
        actualSkip
      );

      if (
        language !== undefined &&
        !isEmpty(viewEventsResponse) &&
        viewEventsResponse.success === true &&
        !isEmpty(viewEventsResponse.data[0].data)
      ) {
        const data = viewEventsResponse.data[0].data;
        for (const event of data) {
          const translatedHealthTips = await translate.translateTips(
            { healthTips: event.health_tips, targetLanguage: language },
            next
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      if (viewEventsResponse.success === true) {
        const data = viewEventsResponse.data;
        data[0].data = !isEmpty(missingDataMessage) ? [] : data[0].data;

        logText("Setting cache...");

        try {
          await createEvent.handleCacheOperation("set", data, request, next);
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache operation completed.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data[0].data)
            ? "no measurements for this search"
            : viewEventsResponse.message,
          data,
          status: viewEventsResponse.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(
            viewEventsResponse.errors
          )}`
        );

        return {
          success: false,
          message: viewEventsResponse.message,
          errors: viewEventsResponse.errors || { message: "" },
          status: viewEventsResponse.status || "",
          isCache: false,
        };
      }
    } catch (error) {
      logObject("error", error);
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
  viewFromReadings: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language },
      } = request;
      const filter = generateFilter.readings(request, next);

      // Try cache first
      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached view result from readings");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const viewReadingsResponse = await ReadingModel(tenant).viewRecent(
        filter,
        next
      );

      // Handle language translation
      if (
        language !== undefined &&
        viewReadingsResponse.success === true &&
        !isEmpty(viewReadingsResponse.data[0].data)
      ) {
        const data = viewReadingsResponse.data[0].data;
        for (const event of data) {
          try {
            const translatedHealthTips = await translate.translateTips(
              { healthTips: event.health_tips, targetLanguage: language },
              next
            );
            if (translatedHealthTips.success === true) {
              event.health_tips = translatedHealthTips.data;
            }
          } catch (translationError) {
            logger.warn(`Translation failed: ${translationError.message}`);
          }
        }
      }

      if (viewReadingsResponse.success === true) {
        const data = viewReadingsResponse.data;

        // Set cache
        try {
          await createEvent.handleCacheOperation(
            "set",
            viewReadingsResponse,
            request,
            next
          );
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data[0].data)
            ? "no measurements for this search"
            : viewReadingsResponse.message,
          data,
          status: viewReadingsResponse.status || httpStatus.OK,
          isCache: false,
          source: "readings",
        };
      } else {
        logger.error(
          `Unable to retrieve readings view --- ${stringify(
            viewReadingsResponse.errors
          )}`
        );

        return {
          success: false,
          message: viewReadingsResponse.message,
          errors: viewReadingsResponse.errors || {
            message: "Database operation failed",
          },
          status:
            viewReadingsResponse.status || httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in viewFromReadings: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  fetchAndStoreData: async (request, next) => {
    try {
      const filter = generateFilter.fetch(request);
      // Fetch the data
      const viewEventsResponse = await EventModel("airqo").fetch(filter);
      logText("we are running running the data insertion script");

      if (viewEventsResponse.success === true) {
        const data = viewEventsResponse.data[0].data;
        if (!data) {
          logText(`🐛🐛 Didn't find any Events to insert into Readings`);
          logger.error(`🐛🐛 Didn't find any Events to insert into Readings`);
          return {
            success: true,
            message: `🐛🐛 Didn't find any Events to insert into Readings`,
            status: httpStatus.OK,
          };
        }
        // Prepare the data for batch insertion
        const batchSize = 50; // Adjust this value based on your requirements
        const batches = [];
        for (let i = 0; i < data.length; i += batchSize) {
          batches.push(data.slice(i, i + batchSize));
        }

        // Insert each batch in the 'readings' collection with retry logic
        for (const batch of batches) {
          for (const doc of batch) {
            await asyncRetry(
              async (bail) => {
                try {
                  // logObject("document", doc);
                  const res = await ReadingModel("airqo").updateOne(doc, doc, {
                    upsert: true,
                  });
                  logObject("res", res);
                  // logObject("Number of documents updated", res.modifiedCount);
                } catch (error) {
                  if (error.name === "MongoError" && error.code !== 11000) {
                    logger.error(
                      `🐛🐛 MongoError -- fetchAndStoreDataIntoReadingsModel -- ${stringify(
                        error
                      )}`
                    );
                    throw error; // Retry the operation
                  } else if (error.code === 11000) {
                    // Ignore duplicate key errors
                    console.warn(
                      `Duplicate key error for document: ${stringify(doc)}`
                    );
                  }
                }
              },
              {
                retries: 5, // Number of retry attempts
                minTimeout: 1000, // Initial delay between retries (in milliseconds)
                factor: 2, // Exponential factor for increasing delay between retries
              }
            );
          }
        }
        return {
          success: true,
          message: `All data inserted successfully`,
          status: httpStatus.OK,
        };
      } else {
        logObject(
          `🐛🐛 Unable to retrieve Events to insert into Readings`,
          viewEventsResponse
        );

        logger.error(
          `🐛🐛 Unable to retrieve Events to insert into Readings -- ${stringify(
            viewEventsResponse
          )}`
        );
        return {
          success: true,
          message: `🐛🐛 Unable to retrieve Events to insert into Readings`,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logObject("error", error);
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
  read: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language, limit, skip },
      } = request;

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const readingsResponse = await ReadingModel(tenant).recent(
        {
          filter: {},
          skip: skip || 0,
          limit: limit || 1000,
        },
        next
      );

      // **STEP 3: Handle language translation (UNCHANGED - preserving existing functionality)**
      if (
        language !== undefined &&
        !isEmpty(readingsResponse) &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        const data = readingsResponse.data;
        for (const event of data) {
          if (event.health_tips) {
            try {
              const translatedHealthTips = await translate.translateTips(
                { healthTips: event.health_tips, targetLanguage: language },
                next
              );
              if (translatedHealthTips.success === true) {
                event.health_tips = translatedHealthTips.data;
              }
            } catch (translationError) {
              logger.warn(`Translation failed: ${translationError.message}`);
              // Continue without translation rather than failing
            }
          }
        }
      }

      if (readingsResponse.success === true) {
        const data = readingsResponse.data;

        logText("Setting cache...");

        try {
          await createEvent.handleCacheOperation("set", data, request, next);
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache set completed.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : readingsResponse.message,
          data,
          status: readingsResponse.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve readings --- ${stringify(
            readingsResponse.errors
          )}`
        );

        return {
          success: false,
          message: readingsResponse.message,
          errors: readingsResponse.errors || { message: "" },
          status: readingsResponse.status || "",
          isCache: false,
        };
      }
    } catch (error) {
      logObject("error", error);
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
  readRecentWithFilter: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language, limit, skip },
      } = request;
      const filter = generateFilter.telemetry(request);

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      // Proceed with database query
      const readingsResponse = await ReadingModel(tenant).recent({
        filter,
        skip,
        limit,
      });

      if (!readingsResponse) {
        logger.error(
          `🐛🐛 ReadingModel.recent returned null/undefined for tenant: ${tenant}`
        );
        return {
          success: false,
          message: "Database model returned null response",
          errors: {
            message: "Model method returned null/undefined",
            tenant: tenant,
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }

      // Handle language translation if needed
      if (
        language !== undefined &&
        !isEmpty(readingsResponse) &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        const data = readingsResponse.data;
        for (const event of data) {
          try {
            const translatedHealthTips = await translate.translateTips(
              { healthTips: event.health_tips, targetLanguage: language },
              next
            );
            if (translatedHealthTips.success === true) {
              event.health_tips = translatedHealthTips.data;
            }
          } catch (translationError) {
            logger.warn(`Translation failed: ${translationError.message}`);
            // Continue without translation rather than failing
          }
        }
      }

      if (readingsResponse.success === true) {
        const data = readingsResponse.data;

        // Attempt to set cache but don't let failure affect the response
        logText("Attempting to set cache...");
        try {
          await createEvent.handleCacheOperation("set", data, request, next);
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache operation completed (success or failure ignored).");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : readingsResponse.message,
          data,
          status: readingsResponse.status || httpStatus.OK,
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(readingsResponse.errors)}`
        );

        return {
          success: false,
          message: readingsResponse.message,
          errors: readingsResponse.errors || {
            message: "Database operation failed",
          },
          status: readingsResponse.status || httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }
    } catch (error) {
      logObject("error", error);
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
      const siteIds = req.body.siteIds;

      const result = await ReadingModel("airqo").getWorstPm2_5Reading({
        siteIds,
        next,
      });

      if (result.success) {
        res.status(result.status).json(result);
      } else {
        // Handle errors based on result.message and result.errors
        next(result);
      }
    } catch (error) {
      // Handle unexpected errors
      next(error);
    }
  },
  getWorstReadingForDevices: async ({ deviceIds = [], next } = {}) => {
    try {
      if (isEmpty(deviceIds) || !Array.isArray(deviceIds)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "deviceIds array is required",
          })
        );
        return;
      }
      if (deviceIds.length === 0) {
        return {
          success: true,
          message: "No device_ids were provided",
          data: [],
          status: httpStatus.OK,
        };
      }

      // Validate deviceIds type
      if (!deviceIds.every((id) => typeof id === "string")) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "deviceIds must be an array of strings",
          })
        );
        return;
      }

      const formattedDeviceIds = deviceIds.map((id) => id.toString());
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const pipeline = ReadingModel("airqo")
        .aggregate([
          {
            $match: {
              device_id: { $in: formattedDeviceIds },
              time: { $gte: threeDaysAgo },
              "pm2_5.value": { $exists: true }, // Ensure pm2_5.value exists
            },
          },
          {
            $sort: { "pm2_5.value": -1, time: -1 }, // Sort by pm2_5 descending, then by time
          },
          {
            $limit: 1, // Take only the worst reading
          },
          {
            $project: {
              _id: 0, // Exclude the MongoDB-generated _id
              device_id: 1,
              time: 1,
              pm2_5: 1,
              device: 1,
              siteDetails: 1,
            },
          },
        ])
        .allowDiskUse(true);

      const worstReading = await pipeline.exec();

      if (!isEmpty(worstReading)) {
        return {
          success: true,
          message: "Successfully retrieved the worst pm2_5 reading.",
          data: worstReading[0],
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message:
            "No pm2_5 readings found for the specified device_ids in the last three days.",
          data: {},
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  listReadingAverages: async (request, next) => {
    try {
      let missingDataMessage = "";
      const { tenant, language, site_id } = {
        ...request.query,
        ...request.params,
      };

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const readingsResponse = await ReadingModel(
        tenant
      ).getAirQualityAnalytics(site_id, next);

      if (
        language !== undefined &&
        !isEmpty(readingsResponse) &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        const data = readingsResponse.data;
        for (const event of data) {
          const translatedHealthTips = await translate.translateTips(
            { healthTips: event.health_tips, targetLanguage: language },
            next
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      if (readingsResponse.success === true) {
        const data = readingsResponse.data;

        logText("Setting cache...");

        try {
          await createEvent.handleCacheOperation("set", data, request, next);
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache set.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : readingsResponse.message,
          data,
          status: readingsResponse.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(readingsResponse.errors)}`
        );

        return {
          success: false,
          message: readingsResponse.message,
          errors: readingsResponse.errors || { message: "" },
          status: readingsResponse.status || "",
          isCache: false,
        };
      }
    } catch (error) {
      logObject("error", error);
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
  getBestAirQuality: async (request, next) => {
    try {
      const {
        query: { tenant, threshold, pollutant, language, limit, skip },
      } = request;

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const readingsResponse = await ReadingModel(
        tenant
      ).getBestAirQualityLocations({ threshold, pollutant, limit, skip }, next);
      const data = readingsResponse.data;

      // Handle language translation for health tips if applicable
      if (
        language !== undefined &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        for (const event of data) {
          const translatedHealthTips = await translate.translateTips(
            { healthTips: event.health_tips, targetLanguage: language },
            next
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      try {
        await createEvent.handleCacheOperation("set", data, request, next);
      } catch (error) {
        logger.warn(`Cache set operation failed: ${stringify(error)}`);
      }

      return {
        success: true,
        message:
          readingsResponse.message ||
          "Successfully retrieved air quality data.",
        data: readingsResponse.data,
        status: readingsResponse.status || "",
        isCache: false,
      };
    } catch (error) {
      logObject("error", error);
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
  signal: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language, limit, skip },
      } = request;

      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const readingsResponse = await SignalModel(tenant).latest(
        {
          skip,
          limit,
        },
        next
      );

      if (
        language !== undefined &&
        !isEmpty(readingsResponse) &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        const data = readingsResponse.data;
        for (const event of data) {
          const translatedHealthTips = await translate.translateTips(
            { healthTips: event.health_tips, targetLanguage: language },
            next
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      if (readingsResponse.success === true) {
        const data = readingsResponse.data;

        logText("Setting cache...");

        try {
          await createEvent.handleCacheOperation("set", data, request, next);
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache set.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : readingsResponse.message,
          data,
          status: readingsResponse.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(readingsResponse.errors)}`
        );

        return {
          success: false,
          message: readingsResponse.message,
          errors: readingsResponse.errors || { message: "" },
          status: readingsResponse.status || "",
          isCache: false,
        };
      }
    } catch (error) {
      logObject("error", error);
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
  create: async (request, next) => {
    try {
      const transformEventsResponse = await createEvent.transformManyEvents(
        request,
        next
      );
      // logObject("transformEventsResponse man", transformEventsResponse);
      if (transformEventsResponse.success === true) {
        let transformedEvents = transformEventsResponse.data;
        let nAdded = 0;
        let eventsAdded = [];
        let eventsRejected = [];
        let errors = [];

        for (const event of transformedEvents) {
          try {
            // logObject("event", event);
            let value = event;
            let dot = new Dot(".");
            let options = event.options;
            let filter = cleanDeep(event.filter);
            let update = event.update;
            dot.delete(["filter", "update", "options"], value);
            update["$push"] = { values: value };

            // logObject("event.tenant", event.tenant);
            // logObject("update", update);
            // logObject("filter", filter);
            // logObject("options", options);

            const addedEvents = await EventModel(event.tenant).updateOne(
              filter,
              update,
              options
            );
            // logObject("addedEvents", addedEvents);
            if (addedEvents) {
              nAdded += 1;
              eventsAdded.push(event);
            } else if (!addedEvents) {
              let errMsg = {
                message: "unable to add the events",
                record: {
                  ...(event.device ? { device: event.device } : {}),
                  ...(event.frequency ? { frequency: event.frequency } : {}),
                  ...(event.time ? { time: event.time } : {}),
                  ...(event.device_id ? { device_id: event.device_id } : {}),
                  ...(event.site_id ? { site_id: event.site_id } : {}),
                },
              };
              errors.push(errMsg);
            } else {
              eventsRejected.push(event);
              let errMsg = {
                message: "unable to add the events",
                record: {
                  ...(event.device ? { device: event.device } : {}),
                  ...(event.frequency ? { frequency: event.frequency } : {}),
                  ...(event.time ? { time: event.time } : {}),
                  ...(event.device_id ? { device_id: event.device_id } : {}),
                  ...(event.site_id ? { site_id: event.site_id } : {}),
                },
              };
              errors.push(errMsg);
            }
          } catch (e) {
            // logger.error(`internal server error -- ${e.message}`);
            eventsRejected.push(event);
            let errMsg = {
              message:
                "system conflict detected, most likely a duplicate record",
              more: e.message,
              record: {
                ...(event.device ? { device: event.device } : {}),
                ...(event.frequency ? { frequency: event.frequency } : {}),
                ...(event.time ? { time: event.time } : {}),
                ...(event.device_id ? { device_id: event.device_id } : {}),
                ...(event.site_id ? { site_id: event.site_id } : {}),
              },
            };
            errors.push(errMsg);
          }
        }

        if (errors.length > 0 && nAdded === 0) {
          return {
            success: false,
            status: httpStatus.CONFLICT,
            message: "all operations failed with conflicts",
            errors,
          };
        } else if (errors.length > 0 && nAdded > 0) {
          return {
            success: true,
            status: httpStatus.OK,
            message: "finished the operation with some conflicts",
            errors,
          };
        } else if (errors.length === 0 && nAdded > 0) {
          return {
            success: true,
            status: httpStatus.OK,
            message: "successfully added all the events",
          };
        }
      } else if (transformEventsResponse.success === false) {
        // logText("maan, things have jam!");
        return transformEventsResponse;
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
    }
  },
  deleteEvents: async (
    tenant,
    startTime,
    endTime,
    device,
    site,
    next,
    limit = 1000
  ) => {
    try {
      let filter = {
        ...(device ? { device } : {}), // Add device filter if provided
        ...(site ? { site } : {}), // Add site filter if provided
      };

      if (startTime && endTime) {
        filter["values.time"] = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }

      let deletedCount = 0;
      let totalDeletedCount = 0;
      let shouldContinue = true;
      let lastDeletedEventTime = new Date(endTime); // Initialize with endTime

      do {
        const eventsToDelete = await EventModel(tenant)
          .find(filter)
          .sort({ "values.time": -1 }) //sort in decending order of time to consistently pick the last time in every batch
          .limit(limit)
          .lean();

        if (eventsToDelete.length === 0) {
          shouldContinue = false;
        } else {
          const eventIds = eventsToDelete.map((event) => event._id);
          try {
            const result = await EventModel(tenant).deleteMany({
              _id: { $in: eventIds },
            });
            deletedCount = result.deletedCount;
            totalDeletedCount += deletedCount;
          } catch (error) {
            logger.error(`Batch deletion failed: ${error.message}`);
            return {
              success: false,
              message: "Batch deletion failed",
              error: error.message,
              deletedCount: totalDeletedCount,
              lastEndTimeProcessed: lastDeletedEventTime,
            };
          }

          if (deletedCount > 0) {
            //pick the minimum time in the current batch since the query sorts in descending order
            lastDeletedEventTime = Math.min(
              ...eventsToDelete.map((event) => {
                if (event.values && Array.isArray(event.values)) {
                  return Math.min(
                    ...event.values.map((val) => new Date(val.time))
                  );
                }
                return new Date(); // Return current time if no values to avoid affecting Math.min
              })
            );

            filter["values.time"]["$lte"] = lastDeletedEventTime; // Adjust $lte
          } else {
            shouldContinue = false; // Stop if nothing deleted in this batch
          }
        }
      } while (shouldContinue);

      logObject("totalDeletedCount", totalDeletedCount);
      logObject("lastDeletedEventTime", lastDeletedEventTime);

      return {
        success: true,
        message: "Events deleted successfully",
        deletedCount: totalDeletedCount,
        lastEndTimeProcessed: lastDeletedEventTime,
      };
    } catch (error) {
      logObject("the error in the util", error);
      logger.error(`Error deleting events: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  store: async (request, next) => {
    try {
      const transformReadingsResponse = await transformManyReadings(
        request,
        next
      );
      logObject("transformReadingsResponse man", transformReadingsResponse);
      if (transformReadingsResponse.success === true) {
        let transformedReadings = transformReadingsResponse.data;
        let result = await processEvents(transformedReadings, next);
        return result;
      } else if (transformReadingsResponse.success === false) {
        logText("maan, things have jam!");
        return transformReadingsResponse;
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
  generateOtherDataString: (inputObject, next) => {
    try {
      const str = Object.values(inputObject).join(",");
      return str;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
    }
  },
  createThingSpeakRequestBody: (req, next) => {
    try {
      const {
        api_key,
        time,
        s1_pm2_5,
        s1_pm10,
        s2_pm2_5,
        s2_pm10,
        latitude,
        longitude,
        battery,
        status,
        altitude,
        wind_speed,
        satellites,
        hdop,
        internal_temperature,
        internal_humidity,
        external_temperature,
        external_humidity,
        external_pressure,
        external_altitude,
        category,
        rtc_adc,
        rtc_v,
        rtc,
        stc_adc,
        stc_v,
        stc,
      } = req.body;

      let stringPositionsAndValues = {};
      stringPositionsAndValues[0] = latitude || null;
      stringPositionsAndValues[1] = longitude || null;
      stringPositionsAndValues[2] = altitude || null;
      stringPositionsAndValues[3] = wind_speed || null;
      stringPositionsAndValues[4] = satellites || null;
      stringPositionsAndValues[5] = hdop || null;
      stringPositionsAndValues[6] = internal_temperature || null;
      stringPositionsAndValues[7] = internal_humidity || null;
      stringPositionsAndValues[8] = external_temperature || null;
      stringPositionsAndValues[9] = external_humidity || null;
      stringPositionsAndValues[10] = external_pressure || null;
      stringPositionsAndValues[11] = external_altitude || null;
      stringPositionsAndValues[12] = category || null;

      const otherDataString = createEvent.generateOtherDataString(
        stringPositionsAndValues,
        next
      );
      let requestBody = {};
      const lowCostRequestBody = {
        api_key: api_key,
        created_at: time,
        field1: s1_pm2_5,
        field2: s1_pm10,
        field3: s2_pm2_5,
        field4: s2_pm10,
        field5: latitude,
        field6: longitude,
        field7: battery,
        field8: otherDataString,
        latitude: latitude,
        longitude: longitude,
        status: status,
      };

      const bamRequestBody = {
        api_key: api_key,
        created_at: time,
        field1: rtc_adc,
        field2: rtc_v,
        field3: rtc,
        field4: stc_adc,
        field5: stc_v,
        field6: stc,
        field7: battery,
        field8: otherDataString,
        latitude: latitude,
        longitude: longitude,
        status: status,
      };

      if (category === "bam") {
        requestBody = bamRequestBody;
      } else if (category === "lowcost") {
        requestBody = lowCostRequestBody;
      }

      return {
        success: true,
        message: "successfully created ThingSpeak body",
        data: requestBody,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  transmitMultipleSensorValues: async (request, next) => {
    try {
      let requestBody = {};
      const responseFromListDevice = await listDevices(request, next);
      let deviceDetail = {};
      if (responseFromListDevice.success === true) {
        if (responseFromListDevice.data.length === 1) {
          deviceDetail = responseFromListDevice.data[0];
          if (isEmpty(deviceDetail.category)) {
            return {
              success: false,
              status: httpStatus.INTERNAL_SERVER_ERROR,
              message:
                "unable to categorise this device, please first update device details",
              errors: {
                message:
                  "unable to categorise this device, please first update device details",
              },
            };
          }
        } else {
          return {
            success: false,
            status: httpStatus.NOT_FOUND,
            message: "no matching devices found",
            errors: { message: "no matching devices found" },
          };
        }
      } else if (responseFromListDevice.success === false) {
        return {
          success: false,
          message: responseFromListDevice.message,
          errors: responseFromListDevice.errors
            ? responseFromListDevice.errors
            : { message: "" },
          status: responseFromListDevice.status
            ? responseFromListDevice.status
            : httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      let requestBodyForCreateThingsSpeakBody = request;
      requestBodyForCreateThingsSpeakBody["body"]["category"] =
        deviceDetail.category;

      const responseFromCreateRequestBody = createEvent.createThingSpeakRequestBody(
        requestBodyForCreateThingsSpeakBody,
        next
      );

      if (responseFromCreateRequestBody.success === true) {
        requestBody = responseFromCreateRequestBody.data;
      } else {
        return {
          success: false,
          message: responseFromCreateRequestBody.message,
          status: responseFromCreateRequestBody.status,
        };
      }

      let api_key = deviceDetail.writeKey;
      const responseFromDecryptKey = await decryptKey(api_key);
      if (responseFromDecryptKey.success === true) {
        api_key = responseFromDecryptKey.data;
      } else if (responseFromDecryptKey.success === false) {
        return responseFromDecryptKey;
      }
      requestBody.api_key = api_key;
      return await axios
        .post(constants.ADD_VALUE_JSON, requestBody)
        .then(function(response) {
          let resp = {};
          if (isEmpty(response.data)) {
            return {
              success: false,
              message: "successful operation but no data sent",
              status: httpStatus.CONFLICT,
              data: resp,
              errors: {
                message: "likely a duplicate value or system conflict",
              },
            };
          } else if (!isEmpty(response.data)) {
            resp.channel_id = response.data.channel_id;
            resp.created_at = response.data.created_at;
            resp.entry_id = response.data.entry_id;
            return {
              message: "successfully transmitted the data",
              success: true,
              data: resp,
            };
          }
        })
        .catch(function(error) {
          try {
            logger.error(
              `internal server error -- ${stringify(
                error.response.data.error.details
              )}`
            );
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message: error.response
                ? error.response.data.error.details
                : "Unable to establish connection with external system",
            },
            status: error.response
              ? error.response.data.status
              : httpStatus.INTERNAL_SERVER_ERROR,
          };
        });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  bulkTransmitMultipleSensorValues: async (request, next) => {
    try {
      logText("bulk write to thing.......");
      const { body } = request;

      const responseFromListDevice = await listDevices(request, next);

      let deviceDetail = {};

      if (responseFromListDevice.success === true) {
        if (responseFromListDevice.data.length === 1) {
          deviceDetail = responseFromListDevice.data[0];
          if (isEmpty(deviceDetail.category)) {
            return {
              success: false,
              status: httpStatus.INTERNAL_SERVER_ERROR,
              message:
                "unable to categorise this device, please first update device details",
            };
          }
        } else {
          return {
            success: false,
            status: httpStatus.NOT_FOUND,
            message: "device not found for this organisation",
          };
        }
      } else if (responseFromListDevice.success === false) {
        return responseFromListDevice;
      }

      const channel = deviceDetail.device_number;
      let api_key = deviceDetail.writeKey;

      const responseFromDecryptKey = await decryptKey(api_key);
      if (responseFromDecryptKey.success === true) {
        api_key = responseFromDecryptKey.data;
      } else if (responseFromDecryptKey.success === false) {
        return responseFromDecryptKey;
      }
      let enrichedBody = [];

      body.forEach((value) => {
        value["category"] = deviceDetail.category;
        enrichedBody.push(value);
      });

      let responseFromTransformMeasurements = await createEvent.transformMeasurementFields(
        enrichedBody,
        next
      );

      let transformedUpdates = {};
      if (responseFromTransformMeasurements.success === true) {
        transformedUpdates = responseFromTransformMeasurements.data;
      } else {
        return responseFromTransformMeasurements;
      }

      let requestObject = {};
      requestObject.write_api_key = api_key;
      requestObject.updates = transformedUpdates;
      return await axios
        .post(constants.BULK_ADD_VALUES_JSON(channel), requestObject)
        .then(function(response) {
          if (isEmpty(response)) {
            return {
              success: false,
              message: "successful operation but no data sent",
              status: httpStatus.CONFLICT,
              errors: {
                message: "likely duplicate values or system conflicts",
              },
            };
          } else if (!isEmpty(response)) {
            let output = JSON.parse(response.config.data).updates;
            return {
              message: "successfully transmitted the data",
              success: true,
              data: output,
              status: httpStatus.OK,
            };
          }
        })
        .catch(function(error) {
          try {
            logger.error(
              `internal server error -- ${stringify(error.response.data.error)}`
            );
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message: error.response
                ? error.response.data.error
                : "Unable to establish connection with external system",
            },
            status: error.response
              ? error.response.data.status
              : httpStatus.INTERNAL_SERVER_ERROR,
          };
        });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateCacheID: (request, next) => {
    try {
      const {
        device,
        device_number,
        device_id,
        site,
        site_id,
        airqloud_id,
        airqloud,
        tenant,
        skip,
        limit,
        frequency,
        startTime,
        endTime,
        metadata,
        external,
        recent,
        lat_long,
        page,
        index,
        running,
        brief,
        latitude,
        longitude,
        network,
        language,
        averages,
        threshold,
        pollutant,
        quality_checks,
        historical,
        optimize,
      } = { ...request.query, ...request.params };

      const currentTime = new Date().toISOString();
      const day = generateDateFormatWithoutHrs(currentTime);
      const isHistorical = isHistoricalMeasurement(request);

      return `list_events
      _${device ? device : "noDevice"}
      _${tenant}
      _${skip ? skip : 0}
      _${limit ? limit : 0}
      _${recent ? recent : "noRecent"}
      _${frequency ? frequency : "noFrequency"}
      _${endTime ? endTime : "noEndTime"}
      _${startTime ? startTime : "noStartTime"}
      _${device_id ? device_id : "noDeviceId"}
      _${site ? site : "noSite"}
      _${site_id ? site_id : "noSiteId"}
      _${day ? day : "noDay"}
      _${device_number ? device_number : "noDeviceNumber"}
      _${metadata ? metadata : "noMetadata"}
      _${external ? external : "noExternal"}
      _${airqloud ? airqloud : "noAirQloud"}
      _${airqloud_id ? airqloud_id : "noAirQloudID"}
      _${lat_long ? lat_long : "noLatLong"}
      _${page ? page : "noPage"}
      _${running ? running : "noRunning"}
      _${index ? index : "noIndex"}
      _${brief ? brief : "noBrief"}
      _${latitude ? latitude : "noLatitude"}
      _${longitude ? longitude : "noLongitude"}
      _${network ? network : "noNetwork"}
      _${language ? language : "noLanguage"}
      _${averages ? averages : "noAverages"}
      _${threshold ? threshold : "noThreshold"}
      _${pollutant ? pollutant : "noPollutant"}
      _${quality_checks ? quality_checks : "noQualityChecks"}
      _${isHistorical ? "historical" : "current"}
      `;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  setCache: async (data, request, next) => {
    try {
      const cacheID = createEvent.generateCacheID(request, next);
      if (!cacheID) {
        logger.warn("Failed to generate cache ID");
        return {
          success: false,
          message: "Cache ID generation failed",
          status: httpStatus.OK,
        };
      }

      const cacheData = {
        isCache: true,
        success: true,
        message: "Successfully retrieved the measurements",
        data,
      };

      let serializedData;
      try {
        serializedData = stringify(cacheData);
      } catch (serializeError) {
        logger.warn(`Cache serialization error: ${serializeError.message}`);
        return {
          success: false,
          message: "Cache serialization failed",
          status: httpStatus.OK,
        };
      }

      // Simple timeout for cache operations
      const cacheTimeout = 5000; // 5 seconds
      const expirationTime = parseInt(constants.EVENTS_CACHE_LIMIT) || 300;

      try {
        await Promise.race([
          (async () => {
            await redisSetAsync(cacheID, serializedData);
            await redisExpireAsync(cacheID, expirationTime);
          })(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Cache operation timeout")),
              cacheTimeout
            )
          ),
        ]);

        return {
          success: true,
          message: "Response stored in cache",
          status: httpStatus.OK,
        };
      } catch (timeoutError) {
        logger.warn(`Cache set timeout: ${timeoutError.message}`);
        return {
          success: false,
          message: "Cache set timeout",
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.warn(`Cache set operation failed: ${error.message}`);
      return {
        success: false,
        message: "Cache set operation failed",
        errors: { message: error.message },
        status: httpStatus.OK,
      };
    }
  },
  getCache: async (request, next) => {
    try {
      const cacheID = createEvent.generateCacheID(request, next);
      if (!cacheID) {
        return {
          success: false,
          message: "Cache ID generation failed",
          status: httpStatus.OK,
        };
      }

      // Simple timeout for cache get
      const cacheTimeout = 3000; // 3 seconds

      let result;
      try {
        result = await Promise.race([
          redisGetAsync(cacheID),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Cache get timeout")),
              cacheTimeout
            )
          ),
        ]);
      } catch (timeoutError) {
        logger.warn(`Cache get timeout: ${timeoutError.message}`);
        return {
          success: false,
          message: "Cache get timeout",
          status: httpStatus.OK,
        };
      }

      // Handle null/undefined result
      if (!result) {
        return {
          success: false,
          message: "No cache present",
          errors: { message: "No cache present" },
          status: httpStatus.OK,
        };
      }

      let resultJSON;
      try {
        resultJSON = JSON.parse(result);
      } catch (parseError) {
        logger.warn(`Cache parse error: ${parseError.message}`);
        return {
          success: false,
          message: "Cache data corrupted",
          errors: { message: "Failed to parse cached data" },
          status: httpStatus.OK,
        };
      }

      // Simple validation
      if (!resultJSON || typeof resultJSON !== "object") {
        logger.warn("Invalid cache data structure");
        return {
          success: false,
          message: "Invalid cache data",
          errors: { message: "Cache data structure invalid" },
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message: "Utilizing cache...",
        data: resultJSON,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.warn(`Cache get operation failed: ${error.message}`);
      return {
        success: false,
        message: "Cache operation failed",
        errors: { message: error.message },
        status: httpStatus.OK,
      };
    }
  },
  transformOneEvent: async (
    { data = {}, map = {}, context = {} } = {},
    next
  ) => {
    try {
      let dot = new Dot(".");
      let modifiedFilter = {};

      let result = {};
      let transformedEvent = transform(data, map, context);

      return {
        success: true,
        message: "successfully transformed the provided event",
        data: transformedEvent,
      };

      const responseFromEnrichOneEvent = await createEvent.enrichOneEvent(
        transformedEvent,
        next
      );

      logObject("responseFromEnrichOneEvent", responseFromEnrichOneEvent);

      if (responseFromEnrichOneEvent.success === true) {
        result = responseFromEnrichOneEvent.data;
        logObject("the result", result);
        if (!isEmpty(result)) {
          dot.object(result);
          let cleanedResult = cleanDeep(result);
          return {
            success: true,
            message: "successfully transformed the provided event",
            data: cleanedResult,
          };
        } else {
          logger.warn(
            `the request body for the external system is empty after transformation`
          );
          return {
            success: false,
            message:
              "the request body for the external system is empty after transformation",
          };
        }
      } else if (responseFromEnrichOneEvent.success === false) {
        logger.error(
          `responseFromEnrichOneEvent , not a success -- ${responseFromEnrichOneEvent.message}`
        );
        return {
          success: false,
          message: "unable to enrich event using device details",
          errors: { message: responseFromEnrichOneEvent.message },
          status: responseFromEnrichOneEvent.status,
        };
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
    }
  },
  enrichOneEvent: async (transformedEvent, next) => {
    try {
      let request = {};
      let enrichedEvent = transformedEvent;

      logObject("transformed event received for enrichment", transformedEvent);
      logObject(
        "transformedEvent[filter][$or]",
        transformedEvent["filter"]["$or"]
      );
      request["query"] = {};
      request["query"]["device"] = transformedEvent.filter.device;
      request["query"]["tenant"] = transformedEvent.tenant;

      const responseFromGetDeviceDetails = await listDevices(request, next);

      if (responseFromGetDeviceDetails.success === true) {
        if (responseFromGetDeviceDetails.data.length === 1) {
          let deviceDetails = responseFromGetDeviceDetails.data[0];

          enrichedEvent["is_test_data"] = !deviceDetails.isActive;
          enrichedEvent["is_device_primary"] =
            deviceDetails.isPrimaryInLocation;

          return {
            success: true,
            message: "successfully enriched",
            data: enrichedEvent,
          };
        } else {
          return {
            success: false,
            message: "unable to find one device matching provided details",
            status: httpStatus.BAD_REQUEST,
          };
        }
      } else if (responseFromGetDeviceDetails.success === false) {
        let errors = responseFromGetDeviceDetails.errors
          ? responseFromGetDeviceDetails.errors
          : { message: "" };
        try {
          logger.error(
            `responseFromGetDeviceDetails was not a success -- ${
              responseFromGetDeviceDetails.message
            } -- ${stringify(errors)}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
        return {
          success: false,
          message: responseFromGetDeviceDetails.message,
          errors,
        };
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
    }
  },
  transformManyEvents: async (request, next) => {
    try {
      const { body } = request;

      let promises = body.map(async (event) => {
        const data = event;
        const map = constants.EVENT_MAPPINGS;

        const transformEventsResponse = await createEvent.transformOneEvent(
          {
            data,
            map,
          },
          next
        );

        if (transformEventsResponse.success === true) {
          return transformEventsResponse;
        } else if (transformEventsResponse.success === false) {
          let errors = transformEventsResponse.errors
            ? transformEventsResponse.errors
            : { message: "" };
          try {
            logger.error(
              `transformEventsResponse is not a success -- unable to transform -- ${stringify(
                errors
              )}`
            );
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return transformEventsResponse;
        }
      });

      return Promise.all(promises).then((results) => {
        let transforms = [];
        let errors = [];
        if (results.every((res) => res.success === true)) {
          for (const result of results) {
            transforms.push(result.data);
          }
        } else if (results.every((res) => res.success === false)) {
          for (const result of results) {
            let error = result.errors ? result.errors : { message: "" };
            errors.push(error);
          }
          try {
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
        }
        if (errors.length > 0) {
          return {
            success: false,
            errors,
            message: "some operational errors as we were trying to transform",
            data: transforms,
            status: httpStatus.BAD_REQUEST,
          };
        } else if (errors.length === 0) {
          return {
            success: true,
            errors,
            message: "transformation successfully done",
            data: transforms,
            status: httpStatus.OK,
          };
        }
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  addEvents: async (request, next) => {
    try {
      // logText("adding the events insertTransformedEvents to the util.....");
      // logger.info(`adding events in the util.....`);
      /**
       * Step One: trasform or prepare for insertion into Events collection -- prepare the nesting expexctation
       * Step Two: Insert
       */
      const { tenant } = request.query;
      const transformEventsResponses = await createEvent.transformManyEvents(
        request,
        next
      );

      if (transformEventsResponses.success === false) {
        // logElement("transformEventsResponses was false?", true);
        return transformEventsResponses;
      } else if (transformEventsResponses.success === true) {
        const transformedMeasurements = transformEventsResponses.data;
        const responseFromInsertEvents = await createEvent.insertTransformedEvents(
          tenant,
          transformedMeasurements,
          next
        );
        return responseFromInsertEvents;
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
    }
  },
  insertTransformedEvents: async (tenant, events, next) => {
    try {
      let errors = [];
      let data = [];
      let filter = {};
      let options = {};
      let value = {};
      let update = {};
      let modifiedFilter = {};
      let dot = new Dot(".");

      for (const event of events) {
        try {
          options = event.options;
          value = event;
          filter = event.filter;
          update = event.update;
          modifiedFilter = event.modifiedFilter;

          dot.object(filter);

          dot.delete(
            ["filter", "update", "options", "modifiedFilter", "tenant", "day"],
            value
          );

          update["$push"] = { values: value };

          const addedEvents = await EventModel(tenant).updateOne(
            modifiedFilter,
            update,
            options
          );

          dot.delete("nValues", filter);
          if (!isEmpty(addedEvents)) {
            let insertion = {
              msg: "successfuly added the event",
              event_details: filter,
              status: httpStatus.CREATED,
            };
            data.push(insertion);
          }

          if (isEmpty(addedEvents)) {
            let errMsg = {
              msg: "unable to add the event",
              event_details: filter,
              status: httpStatus.NOT_MODIFIED,
            };
            errors.push(errMsg);
          }
        } catch (error) {
          dot.delete("nValues", filter);
          let errMsg = {
            msg: "duplicate event",
            event_details: filter,
            status: httpStatus.FORBIDDEN,
          };
          errors.push(errMsg);
        }
      }

      if (errors.length > 0 && isEmpty(data)) {
        logger.error(
          `finished the operation with some errors -- ${stringify(errors)}`
        );
        return {
          success: false,
          message: "finished the operation with some errors",
          errors,
        };
      } else {
        return {
          success: true,
          message: "successfully added the events",
          data,
          errors,
        };
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
    }
  },
  clearEventsOnClarity: (request, next) => {
    return {
      success: false,
      message: "coming soon - unavailable option",
      status: httpStatus.NOT_IMPLEMENTED,
      errors: { message: "coming soon" },
    };
  },
  insertMeasurements: async (measurements, next) => {
    try {
      const responseFromInsertMeasurements = await createEvent.insert(
        "airqo",
        measurements,
        next
      );
      return responseFromInsertMeasurements;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  transformMeasurements: async (device, measurements, next) => {
    let promises = measurements.map(async (measurement) => {
      try {
        let time = measurement.time;
        const day = generateDateFormatWithoutHrs(time);
        return {
          device: device,
          day: day,
          ...measurement,
          success: true,
        };
      } catch (e) {
        logger.error(`internal server error -- ${e.message}`);
        return {
          device: device,
          success: false,
          message: e.message,
          errors: { message: e.message },
        };
      }
    });
    return Promise.all(promises).then((results) => {
      if (results.every((res) => res.success)) {
        return results;
      } else {
        logObject("the results for no success", results);
      }
    });
  },
  transformMeasurements_v2: async (measurements, next) => {
    try {
      logText("we are transforming version 2....");
      let promises = measurements.map(async (measurement) => {
        try {
          let time = measurement.time;
          const day = generateDateFormatWithoutHrs(time);
          let data = {
            day: day,
            ...measurement,
          };
          return data;
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
          return {
            success: false,
            message: "server side error",
            errors: { message: e.message },
          };
        }
      });
      return Promise.all(promises).then((results) => {
        if (results.every((res) => res.success)) {
          return {
            success: true,
            data: results,
          };
        } else {
          return {
            success: true,
            data: results,
          };
        }
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  transformField: (field, next) => {
    try {
      switch (field) {
        case "s1_pm2_5":
          return "field1";
        case "s1_pm10":
          return "field2";
        case "s2_pm2_5":
          return "field3";
        case "s2_pm10":
          return "field4";
        case "latitude":
          return "field5";
        case "longitude":
          return "field6";
        case "battery":
          return "field7";
        case "others":
          return "field8";
        case "time":
          return "created_at";
        case "elevation":
          return "elevation";
        case "status":
          return "status";
        default:
          return field;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
    }
  },
  transformMeasurementFields: async (measurements, next) => {
    try {
      let transformed = [];
      let request = {};
      for (const measurement of measurements) {
        request["body"] = measurement;
        const responseFromCreateThingSpeakBody = createEvent.createThingSpeakRequestBody(
          request,
          next
        );

        if (responseFromCreateThingSpeakBody.success === true) {
          transformed.push(responseFromCreateThingSpeakBody.data);
        } else {
          logObject(
            "responseFromCreateThingSpeakBody",
            responseFromCreateThingSpeakBody
          );
        }
      }
      return {
        message: "successfully transformed the measurements",
        data: transformed,
        success: true,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteValuesOnThingspeak: async (req, res, next) => {
    try {
      const { device, tenant, chid, name, device_number } = req.query;

      let request = {};
      request["query"] = {};
      request["query"]["name"] = device || name;
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = chid || device_number;

      const responseFromListDevice = await listDevices(request, next);

      let deviceDetail = {};

      if (responseFromListDevice.success === true) {
        if (responseFromListDevice.data.length === 1) {
          deviceDetail = responseFromListDevice.data[0];
        }
      } else if (responseFromListDevice.success === false) {
        logObject(
          "responseFromListDevice has an error",
          responseFromListDevice
        );
      }

      const doesDeviceExist = !isEmpty(deviceDetail);
      logElement("isDevicePresent ?", doesDeviceExist);
      if (doesDeviceExist) {
        const device_number = await getChannelID(
          req,
          res,
          device,
          tenant.toLowerCase()
        );
        logText("...................................");
        logText("clearing the Thing....");
        logElement("url", constants.CLEAR_THING_URL(device_number));
        await axios
          .delete(constants.CLEAR_THING_URL(device_number))
          .then(async (response) => {
            logText("successfully cleared the device in TS");
            logObject("response from TS", response.data);
            return {
              message: `successfully cleared the data for device ${device}`,
              success: true,
              updatedDevice,
            };
          })
          .catch(function(error) {
            logger.error(`internal server error -- ${error.message}`);
            return {
              message: `unable to clear the device data, device ${device} does not exist`,
              success: false,
              errors: {
                message: `unable to clear the device data, device ${device} does not exist`,
              },
            };
          });
      } else {
        logText(`device ${device} does not exist in the system`);
        return {
          message: `device ${device} does not exist in the system`,
          success: false,
          errors: { message: `device ${device} does not exist in the system` },
        };
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
    }
  },

  // Add to event.util.js
  getNearestReadings: async (request, next) => {
    try {
      const {
        latitude,
        longitude,
        radius = 15,
        limit = 5,
        tenant = "airqo",
      } = {
        ...request.query,
        ...request.params,
      };

      // Step 1: Find the nearest sites within the specified radius
      const sites = await SiteModel(tenant)
        .find({})
        .lean();

      // Calculate and filter sites by distance
      const sitesWithDistance = sites
        .map((site) => {
          const distanceInKm = distance.distanceBtnTwoPoints(
            {
              latitude1: parseFloat(latitude),
              longitude1: parseFloat(longitude),
              latitude2: site.latitude,
              longitude2: site.longitude,
            },
            next
          );

          return {
            ...site,
            distance: distanceInKm,
          };
        })
        .filter((site) => site.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      if (sitesWithDistance.length === 0) {
        // Fallback: Find the nearest city using the Grid model
        const nearestCityReading = await findNearestCityReading(
          latitude,
          longitude,
          tenant,
          next
        );

        if (nearestCityReading.success) {
          return {
            success: true,
            message: `No sites found within ${radius}km radius. Showing readings from the nearest city.`,
            data: nearestCityReading.data,
            fromNearestCity: true,
            nearestCityInfo: nearestCityReading.cityInfo,
            status: httpStatus.OK,
          };
        } else {
          return {
            success: false,
            message:
              "No sites found within radius and no nearby city readings available",
            errors: {
              message: "No air quality data available for your location",
            },
            status: httpStatus.NOT_FOUND,
          };
        }
      }

      // Step 2: Get readings for these sites
      const siteIds = sitesWithDistance.map((site) => site._id.toString());

      const filter = {
        site_id: { $in: siteIds },
      };

      const readings = await ReadingModel(tenant).recent(
        { filter, limit: 100 },
        next
      );

      if (!readings.success || isEmpty(readings.data)) {
        return {
          success: false,
          message: "No recent readings found for nearby sites",
          errors: { message: "No air quality data available for nearby sites" },
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 3: Match readings with site distances and sort
      const readingsWithDistance = readings.data
        .map((reading) => {
          const site = sitesWithDistance.find(
            (site) => site._id.toString() === reading.site_id.toString()
          );

          return {
            ...reading,
            distance: site ? site.distance : Infinity,
          };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      return {
        success: true,
        message: "Successfully retrieved the nearest readings",
        data: readingsWithDistance,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },

  // Helper function to find the nearest city reading
  findNearestCityReading: async (latitude, longitude, tenant, next) => {
    try {
      // Step 1: Find all grids with admin_level that would represent cities
      // Typically admin_level could be 'city', 'town', 'district', depending on your system
      const cityGrids = await GridModel(tenant)
        .find({
          admin_level: { $in: ["city", "town", "district", "division"] },
        })
        .lean();

      if (isEmpty(cityGrids)) {
        return {
          success: false,
          message: "No city grids found in the system",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 2: Find the nearest city grid
      let nearestCity = null;
      let minDistance = Infinity;

      cityGrids.forEach((grid) => {
        // For each grid, calculate distance to each center point
        if (grid.centers && grid.centers.length > 0) {
          grid.centers.forEach((center) => {
            const distanceToCenter = distance.distanceBtnTwoPoints(
              {
                latitude1: parseFloat(latitude),
                longitude1: parseFloat(longitude),
                latitude2: center.latitude,
                longitude2: center.longitude,
              },
              next
            );

            if (distanceToCenter < minDistance) {
              minDistance = distanceToCenter;
              nearestCity = {
                ...grid,
                distanceToUser: distanceToCenter,
              };
            }
          });
        }
      });

      if (!nearestCity) {
        return {
          success: false,
          message: "No city found with valid center coordinates",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 3: Find sites within this city grid
      const sitesInCity = await SiteModel(tenant)
        .find({
          grids: nearestCity._id,
        })
        .lean();

      if (isEmpty(sitesInCity)) {
        return {
          success: false,
          message: `No sites found in the nearest city (${nearestCity.name})`,
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 4: Get readings for these sites
      const siteIds = sitesInCity.map((site) => site._id.toString());

      const filter = {
        site_id: { $in: siteIds },
      };

      const readings = await ReadingModel(tenant).recent(
        { filter, limit: 5 },
        next
      );

      if (!readings.success || isEmpty(readings.data)) {
        return {
          success: false,
          message: `No recent readings found for sites in ${nearestCity.name}`,
          status: httpStatus.NOT_FOUND,
        };
      }

      // Add city information to each reading
      readings.data = readings.data.map((reading) => ({
        ...reading,
        isNearestCity: true,
        distanceToUser: minDistance,
      }));

      return {
        success: true,
        message: `Successfully retrieved readings from nearest city (${nearestCity.name})`,
        data: readings.data,
        cityInfo: {
          name: nearestCity.name,
          long_name: nearestCity.long_name,
          distance: minDistance,
          admin_level: nearestCity.admin_level,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve nearest city readings",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  resolveDeviceDeploymentContext: async (measurement, tenant, next) => {
    try {
      const {
        device_id,
        device,
        device_number,
        deployment_type,
        site_id,
        grid_id,
      } = measurement;

      // Validate that we have at least one device identifier
      if (!device_id && !device && !device_number) {
        throw new HttpError(
          "Missing device identifier",
          httpStatus.BAD_REQUEST,
          {
            message:
              "Device identifier required: device_id, device name, or device_number",
          }
        );
      }

      // Build device query
      const deviceQuery = {};
      if (device_id) {
        // Handle both ObjectId and string formats
        deviceQuery._id = device_id;
      } else if (device) {
        deviceQuery.name = device;
      } else if (device_number) {
        deviceQuery.device_number = device_number;
      }

      let deviceRecord;
      try {
        deviceRecord = await DeviceModel(tenant)
          .findOne(deviceQuery)
          .lean();
      } catch (dbError) {
        logger.error(`Database error finding device: ${dbError.message}`);
        throw new HttpError(
          "Database error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: `Failed to query device: ${dbError.message}`,
          }
        );
      }

      if (!deviceRecord) {
        throw new HttpError("Device not found", httpStatus.BAD_REQUEST, {
          message: `Device not found: ${device_id || device || device_number}`,
          hint:
            "Please verify the device exists in the database and the tenant is correct",
          provided_identifiers: {
            device_id: device_id || null,
            device: device || null,
            device_number: device_number || null,
          },
          tenant: tenant,
        });
      }

      // Determine actual deployment type with fallbacks
      const actualDeploymentType =
        deployment_type || deviceRecord.deployment_type || "static"; // Default fallback

      // Validate deployment consistency but be more lenient
      if (actualDeploymentType === "static") {
        const resolvedSiteId = site_id || deviceRecord.site_id;
        if (!resolvedSiteId) {
          logger.warn(`Static device ${deviceRecord.name} missing site_id`);
          // Don't throw error, just warn and continue
        }
        if (grid_id) {
          logger.warn(
            `Static device ${deviceRecord.name} has grid_id, which may be unnecessary`
          );
        }
      } else if (actualDeploymentType === "mobile") {
        // For mobile devices, location data becomes more critical
        if (
          !measurement.location?.latitude?.value ||
          !measurement.location?.longitude?.value
        ) {
          logger.warn(
            `Mobile device measurement missing location data: ${deviceRecord.name}`
          );
          logObject(
            "Warning: Mobile device measurement without location data",
            {
              device: deviceRecord.name,
              device_id: deviceRecord._id,
              timestamp: measurement.time,
            }
          );
        }
      }

      return {
        deviceRecord,
        actualDeploymentType,
        resolvedSiteId: site_id || deviceRecord.site_id,
        resolvedGridId: grid_id || deviceRecord.grid_id,
      };
    } catch (error) {
      // Re-throw HttpErrors as-is
      if (error instanceof HttpError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  transformMeasurements_v3: async (measurements, next) => {
    try {
      logText("Transforming measurements v3 with mobile device support...");

      let promises = measurements.map(async (measurement) => {
        try {
          let time = measurement.time;
          const day = generateDateFormatWithoutHrs(time);

          let transformedMeasurement = {
            day: day,
            ...measurement,
            deployment_type: measurement.deployment_type || "static",
          };

          try {
            const deploymentContext = await createEvent.resolveDeviceDeploymentContext(
              measurement,
              measurement.tenant || "airqo",
              next
            );

            transformedMeasurement.deployment_type =
              deploymentContext.actualDeploymentType;
            transformedMeasurement.device_deployment_type =
              deploymentContext.deviceRecord.deployment_type;

            if (deploymentContext.actualDeploymentType === "static") {
              transformedMeasurement.site_id = deploymentContext.resolvedSiteId;
              if (transformedMeasurement.grid_id) {
                delete transformedMeasurement.grid_id;
              }
            } else if (deploymentContext.actualDeploymentType === "mobile") {
              transformedMeasurement.grid_id = deploymentContext.resolvedGridId;
            }
          } catch (contextError) {
            // CHANGED: Re-throw with better error details instead of catching
            if (contextError instanceof HttpError) {
              // Preserve the detailed error from resolveDeviceDeploymentContext
              throw new Error(
                contextError.errors?.message ||
                  contextError.message ||
                  "Device validation failed"
              );
            }
            throw contextError;
          }

          return transformedMeasurement;
        } catch (e) {
          // CHANGED: Include more context in the error
          logger.warn(
            `Measurement transformation failed: ${e.message} for device ${measurement.device_id}`
          );

          return {
            success: false,
            message: e.message, // Use actual error message, not generic
            errors: {
              message: e.message,
              device_id: measurement.device_id?.toString(),
            },
            original_measurement: measurement,
          };
        }
      });

      const results = await Promise.all(promises);

      const successful = results.filter((result) => result.success !== false);
      const failed = results.filter((result) => result.success === false);

      if (failed.length > 0) {
        // Log but don't print to console
        logger.warn(`${failed.length} measurement transformation(s) failed`);
      }

      return {
        success: true,
        data: successful,
        failed_transformations: failed,
        total_processed: measurements.length,
        successful_count: successful.length,
        failed_count: failed.length,
      };
    } catch (error) {
      logger.error(`Error in transformMeasurements_v3: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  insert: async (tenant, measurements, next) => {
    try {
      let nAdded = 0;
      let eventsAdded = [];
      let eventsRejected = [];
      let errors = [];

      const responseFromTransformMeasurements = await createEvent.transformMeasurements_v2(
        measurements,
        next
      );

      if (!responseFromTransformMeasurements.success) {
        logger.error(
          `internal server error -- unable to transform measurements -- ${
            responseFromTransformMeasurements.message
          }, ${stringify(measurements)}`
        );
      }

      for (const measurement of responseFromTransformMeasurements.data) {
        try {
          // logObject("the measurement in the insertion process", measurement);
          const eventsFilter = {
            day: measurement.day,
            site_id: measurement.site_id,
            device_id: measurement.device_id,
            nValues: { $lt: parseInt(constants.N_VALUES || 500) },
            $or: [
              { "values.time": { $ne: measurement.time } },
              { "values.device": { $ne: measurement.device } },
              { "values.frequency": { $ne: measurement.frequency } },
              { "values.device_id": { $ne: measurement.device_id } },
              { "values.site_id": { $ne: measurement.site_id } },
              { day: { $ne: measurement.day } },
            ],
          };
          let someDeviceDetails = {};
          someDeviceDetails["device_id"] = measurement.device_id;
          someDeviceDetails["site_id"] = measurement.site_id;
          // logObject("someDeviceDetails", someDeviceDetails);

          // logObject("the measurement", measurement);

          const eventsUpdate = {
            $push: { values: measurement },
            $min: { first: measurement.time },
            $max: { last: measurement.time },
            $inc: { nValues: 1 },
          };
          // logObject("eventsUpdate", eventsUpdate);
          // logObject("eventsFilter", eventsFilter);

          const addedEvents = await EventModel(tenant).updateOne(
            eventsFilter,
            eventsUpdate,
            {
              upsert: true,
            }
          );
          // logObject("addedEvents", addedEvents);
          if (addedEvents) {
            nAdded += 1;
            eventsAdded.push(measurement);
          } else if (!addedEvents) {
            eventsRejected.push(measurement);
            let errMsg = {
              msg: "unable to add the events",
              record: {
                ...(measurement.device ? { device: measurement.device } : {}),
                ...(measurement.frequency
                  ? { frequency: measurement.frequency }
                  : {}),
                ...(measurement.time ? { time: measurement.time } : {}),
                ...(measurement.device_id
                  ? { device_id: measurement.device_id }
                  : {}),
                ...(measurement.site_id
                  ? { site_id: measurement.site_id }
                  : {}),
              },
            };
            errors.push(errMsg);
          } else {
            eventsRejected.push(measurement);
            let errMsg = {
              msg: "unable to add the events",
              record: {
                ...(measurement.device ? { device: measurement.device } : {}),
                ...(measurement.frequency
                  ? { frequency: measurement.frequency }
                  : {}),
                ...(measurement.time ? { time: measurement.time } : {}),
                ...(measurement.device_id
                  ? { device_id: measurement.device_id }
                  : {}),
                ...(measurement.site_id
                  ? { site_id: measurement.site_id }
                  : {}),
              },
            };
            errors.push(errMsg);
          }
        } catch (e) {
          // logger.error(`internal server serror -- ${e.message}`);
          eventsRejected.push(measurement);
          let errMsg = {
            msg:
              "there is a system conflict, most likely a cast error or duplicate record",
            more: e.message,
            record: {
              ...(measurement.device ? { device: measurement.device } : {}),
              ...(measurement.frequency
                ? { frequency: measurement.frequency }
                : {}),
              ...(measurement.time ? { time: measurement.time } : {}),
              ...(measurement.device_id
                ? { device_id: measurement.device_id }
                : {}),
              ...(measurement.site_id ? { site_id: measurement.site_id } : {}),
            },
          };
          errors.push(errMsg);
        }
      }

      if (errors.length > 0 && isEmpty(eventsAdded)) {
        logTextWithTimestamp(
          "API: failed to store measurements, most likely DB cast errors or duplicate records"
        );
        return {
          success: false,
          message: "finished the operation with some errors",
          errors,
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      } else {
        logTextWithTimestamp("API: successfully added the events");
        return {
          success: true,
          message: "successfully added the events",
          status: httpStatus.OK,
          errors,
        };
      }
    } catch (error) {
      logTextWithTimestamp(`API: Internal Server Error ${error.message}`);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  insertMeasurements_v3: async (tenant, measurements, next) => {
    try {
      let nAdded = 0;
      let eventsAdded = [];
      let eventsRejected = [];
      let errors = [];
      let mobileDeviceCount = 0;
      let staticDeviceCount = 0;

      const deviceIdentifiers = measurements
        .map(({ device_id, device, device_number }) => {
          if (device_id) return { _id: device_id };
          if (device) return { name: device };
          if (device_number) return { device_number: device_number };
          return null;
        })
        .filter(Boolean);

      const uniqueDeviceIdentifiers = deviceIdentifiers.reduce(
        (acc, current) => {
          const key = JSON.stringify(current);
          if (!acc.find((item) => JSON.stringify(item) === key)) {
            acc.push(current);
          }
          return acc;
        },
        []
      );

      let deviceContexts = new Map();
      if (uniqueDeviceIdentifiers.length > 0) {
        try {
          const devices = await DeviceModel(tenant)
            .find({ $or: uniqueDeviceIdentifiers })
            .select(
              "_id name device_number deployment_type site_id grid_id mobility isActive"
            )
            .lean();

          devices.forEach((device) => {
            deviceContexts.set(device._id.toString(), device);
            deviceContexts.set(device.name, device);
            if (device.device_number) {
              deviceContexts.set(device.device_number.toString(), device);
            }
          });
        } catch (dbError) {
          logger.error(
            `Database error pre-fetching devices: ${dbError.message}`
          );
        }
      }

      const responseFromTransformMeasurements = await createEvent.transformMeasurements_v3(
        measurements,
        next
      );

      if (!responseFromTransformMeasurements.success) {
        logObject(
          "Failed to transform measurements",
          responseFromTransformMeasurements
        );
        return responseFromTransformMeasurements;
      }

      if (responseFromTransformMeasurements.failed_count > 0) {
        const transformationErrors = responseFromTransformMeasurements.failed_transformations.map(
          (failure) => ({
            type: "TRANSFORMATION_FAILURE",
            message: failure.message || "Measurement transformation failed",
            details: failure.errors,
            device_id: failure.original_measurement?.device_id,
          })
        );
        errors.push(...transformationErrors);
      }

      const measurementsWithContext = responseFromTransformMeasurements.data.map(
        (m) => {
          const identifier = m.device_id
            ? m.device_id.toString()
            : m.device || (m.device_number ? m.device_number.toString() : null);
          const context = deviceContexts.get(identifier);
          if (context) {
            return { ...m, ...context };
          }
          return m;
        }
      );

      for (const measurement of measurementsWithContext) {
        try {
          if (measurement.deployment_type === "mobile") {
            mobileDeviceCount++;
          } else {
            staticDeviceCount++;
          }

          let eventsFilter = {
            day: measurement.day,
            device_id: measurement.device_id,
            nValues: { $lt: parseInt(constants.N_VALUES || 500) },
            $or: [
              { "values.time": { $ne: measurement.time } },
              { "values.device": { $ne: measurement.device } },
              { "values.frequency": { $ne: measurement.frequency } },
              { "values.device_id": { $ne: measurement.device_id } },
              { day: { $ne: measurement.day } },
            ],
          };

          if (measurement.deployment_type === "static" && measurement.site_id) {
            eventsFilter.site_id = measurement.site_id;
            eventsFilter.$or.push({
              "values.site_id": { $ne: measurement.site_id },
            });
          } else if (
            measurement.deployment_type === "mobile" &&
            measurement.grid_id
          ) {
            eventsFilter.grid_id = measurement.grid_id;
            eventsFilter.$or.push({
              "values.grid_id": { $ne: measurement.grid_id },
            });
          }

          const eventsUpdate = {
            $push: { values: measurement },
            $min: { first: measurement.time },
            $max: { last: measurement.time },
            $inc: { nValues: 1 },
          };

          if (measurement.deployment_type === "static") {
            eventsUpdate.$set = {
              site_id: measurement.site_id,
              device_id: measurement.device_id,
              deployment_type: "static",
            };
          } else if (measurement.deployment_type === "mobile") {
            eventsUpdate.$set = {
              grid_id: measurement.grid_id,
              device_id: measurement.device_id,
              deployment_type: "mobile",
            };
            if (measurement.site_id) {
              eventsUpdate.$set.site_id = measurement.site_id;
            }
          }

          const addedEvents = await EventModel(tenant).updateOne(
            eventsFilter,
            eventsUpdate,
            { upsert: true }
          );

          if (addedEvents) {
            nAdded += 1;
            eventsAdded.push(measurement);
          } else {
            eventsRejected.push(measurement);
            let errMsg = {
              msg: "Unable to add the events",
              deployment_type: measurement.deployment_type,
              record: {
                ...(measurement.device ? { device: measurement.device } : {}),
                ...(measurement.frequency
                  ? { frequency: measurement.frequency }
                  : {}),
                ...(measurement.time ? { time: measurement.time } : {}),
                ...(measurement.device_id
                  ? { device_id: measurement.device_id }
                  : {}),
                ...(measurement.site_id
                  ? { site_id: measurement.site_id }
                  : {}),
                ...(measurement.grid_id
                  ? { grid_id: measurement.grid_id }
                  : {}),
              },
            };
            errors.push(errMsg);
          }
        } catch (e) {
          eventsRejected.push(measurement);
          let errMsg = {
            msg:
              "System conflict detected, most likely a cast error or duplicate record",
            more: e.message,
            deployment_type: measurement.deployment_type,
            record: {
              ...(measurement.device ? { device: measurement.device } : {}),
              ...(measurement.frequency
                ? { frequency: measurement.frequency }
                : {}),
              ...(measurement.time ? { time: measurement.time } : {}),
              ...(measurement.device_id
                ? { device_id: measurement.device_id }
                : {}),
              ...(measurement.site_id ? { site_id: measurement.site_id } : {}),
              ...(measurement.grid_id ? { grid_id: measurement.grid_id } : {}),
            },
          };
          errors.push(errMsg);
        }
      }

      const deploymentStats = {
        total_measurements: measurements.length,
        static_device_measurements: staticDeviceCount,
        mobile_device_measurements: mobileDeviceCount,
        successful_insertions: nAdded,
        failed_insertions: eventsRejected.length,
        transformation_failures: responseFromTransformMeasurements.failed_count,
      };

      if (errors.length > 0 && nAdded === 0) {
        logTextWithTimestamp(
          "API: failed to store measurements, most likely DB cast errors or duplicate records"
        );
        return {
          success: false,
          message: "finished the operation with some errors",
          deployment_stats: deploymentStats,
          errors,
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      } else {
        logTextWithTimestamp("API: successfully added the events");
        return {
          success: true,
          message: "successfully added the events",
          deployment_stats: deploymentStats,
          status: httpStatus.OK,
          errors: errors.length > 0 ? errors : undefined,
        };
      }
    } catch (error) {
      logTextWithTimestamp(`API: Internal Server Error ${error.message}`);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  validateDeviceContext: async (
    { device_id, device, device_number, tenant },
    next
  ) => {
    try {
      if (!device_id && !device && !device_number) {
        return {
          success: false,
          message: "Device identifier required",
          errors: {
            message: "Provide device_id, device name, or device_number",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      try {
        const context = await createEvent.resolveDeviceDeploymentContext(
          { device_id, device, device_number },
          tenant,
          next
        );

        return {
          success: true,
          message: "Device deployment context retrieved successfully",
          data: {
            device_name: context.deviceRecord.name,
            device_id: context.deviceRecord._id,
            deployment_type: context.actualDeploymentType,
            site_id: context.resolvedSiteId,
            grid_id: context.resolvedGridId,
            mobility: context.deviceRecord.mobility,
            is_active: context.deviceRecord.isActive,
            required_fields_for_measurements:
              context.actualDeploymentType === "mobile"
                ? [
                    "device_id",
                    "location.latitude.value",
                    "location.longitude.value",
                    "time",
                    "frequency",
                  ]
                : ["device_id", "site_id", "time", "frequency"],
          },
          status: httpStatus.OK,
        };
      } catch (error) {
        if (error instanceof HttpError) {
          return {
            success: false,
            message: error.message,
            errors: error.details,
            status: error.statusCode,
          };
        }
        throw error;
      }
    } catch (error) {
      logger.error(`🐛🐛 Validate Device Context Util Error ${error.message}`);
      throw error;
    }
  },

  getDeploymentStats: async (tenant, next) => {
    try {
      // Get deployment statistics from events
      const [staticEvents, mobileEvents, totalEvents] = await Promise.all([
        EventModel(tenant).countDocuments({ deployment_type: "static" }),
        EventModel(tenant).countDocuments({ deployment_type: "mobile" }),
        EventModel(tenant).countDocuments({}),
      ]);

      const stats = {
        total_events: totalEvents,
        static_events: staticEvents,
        mobile_events: mobileEvents,
        static_percentage:
          totalEvents > 0
            ? ((staticEvents / totalEvents) * 100).toFixed(2)
            : "0.00",
        mobile_percentage:
          totalEvents > 0
            ? ((mobileEvents / totalEvents) * 100).toFixed(2)
            : "0.00",
        generated_at: new Date().toISOString(),
      };

      return {
        success: true,
        message: "Deployment statistics retrieved successfully",
        data: stats,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Get Deployment Stats Util Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  addValuesWithStats: async (tenant, measurements, next) => {
    try {
      if (!Array.isArray(measurements)) {
        return {
          success: false,
          message: "Measurements must be an array",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const MAX_BATCH_SIZE = 100;
      if (measurements.length > MAX_BATCH_SIZE) {
        return {
          success: false,
          message: `Batch size too large. Maximum allowed: ${MAX_BATCH_SIZE}`,
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Filter measurements by timestamp BEFORE processing
      const filterResult = await filterMeasurementsByTimestamp(
        measurements,
        next
      );
      const validMeasurements = filterResult.data.valid;
      const timestampFilterStats = filterResult.data.stats;

      // If all measurements were rejected, return early
      if (validMeasurements.length === 0) {
        await ActivityLogger.logActivity({
          operation_type: "BULK_INSERT",
          entity_type: "EVENT",
          status: "FAILURE",
          records_attempted: measurements.length,
          records_successful: 0,
          records_failed: measurements.length,
          tenant: tenant,
          source_function: "addValuesWithStats",
          error_details:
            "All measurements rejected due to timestamp validation",
          error_code: "TIMESTAMP_VALIDATION_FAILED",
          metadata: {
            timestamp_filter_stats: timestampFilterStats,
            rejection_reasons: timestampFilterStats.rejectionReasons,
            measurements_received: measurements.length,
            measurements_after_filter: 0,
          },
        });

        return {
          success: false,
          message: `All ${measurements.length} measurements rejected: timestamps outside acceptable range (last ${constants.MAX_EVENT_AGE_HOURS} hours)`,
          status: httpStatus.BAD_REQUEST,
          timestamp_filter_stats: timestampFilterStats,
          errors: {
            message: "All measurements have invalid timestamps",
            details: timestampFilterStats.rejectionReasons,
          },
        };
      }

      // Log if some measurements were filtered
      if (timestampFilterStats.rejected > 0) {
        logger.info(
          `Filtered ${timestampFilterStats.rejected} out of ${timestampFilterStats.total} ` +
            `measurements (age > ${constants.MAX_EVENT_AGE_HOURS} hours). Processing ${validMeasurements.length} valid measurements.`
        );
      }

      return await ActivityLogger.trackOperation(
        async () => {
          // Process only valid measurements
          const result = await createEvent.insertMeasurements_v3(
            tenant,
            validMeasurements, // Use filtered measurements
            next
          );

          // Guard against undefined result
          if (!result) {
            return {
              success: false,
              message: "Insertion did not return a response",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              records_successful: 0,
              records_failed: validMeasurements.length,
              timestamp_filter_stats: timestampFilterStats,
            };
          }

          // Enhance result with timestamp filtering stats and processing summary
          return {
            ...result,
            records_successful:
              result.deployment_stats?.successful_insertions || 0,
            records_failed: result.deployment_stats?.failed_insertions || 0,
            timestamp_filter_stats: timestampFilterStats,
            processing_summary: {
              total_received: measurements.length,
              rejected_by_timestamp_filter: timestampFilterStats.rejected,
              passed_timestamp_filter: validMeasurements.length,
              successfully_inserted:
                result.deployment_stats?.successful_insertions || 0,
              failed_at_database:
                result.deployment_stats?.failed_insertions || 0,
            },
          };
        },
        {
          operation_type: "BULK_INSERT",
          entity_type: "EVENT",
          tenant: tenant,
          source_function: "addValuesWithStats",
          records_attempted: measurements.length, // Total received (not filtered count)
          metadata: {
            tenant: tenant,
            measurements_received: measurements.length, // Total initially received
            measurements_after_timestamp_filter: validMeasurements.length, // After filtering
            timestamp_rejected: timestampFilterStats.rejected,
            timestamp_rejection_rate: `${(
              (timestampFilterStats.rejected / measurements.length) *
              100
            ).toFixed(1)}%`,
            processing_mode: "direct",
            timestamp_filter_stats: timestampFilterStats,
          },
        }
      );
    } catch (error) {
      logger.error(`🐛🐛 Add Values With Stats Util Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  v0_addValuesWithStats: async (tenant, measurements, next) => {
    try {
      if (!Array.isArray(measurements)) {
        return {
          success: false,
          message: "Measurements must be an array",
          status: httpStatus.BAD_REQUEST,
        };
      }

      const MAX_BATCH_SIZE = 100;
      if (measurements.length > MAX_BATCH_SIZE) {
        return {
          success: false,
          message: `Batch size too large. Maximum allowed: ${MAX_BATCH_SIZE}`,
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Call the function directly
      const result = await createEvent.insertMeasurements_v3(
        tenant,
        measurements,
        next
      );

      // Guard against undefined result from insertMeasurements_v3 catch block
      if (!result) {
        return {
          success: false,
          message: "Insertion did not return a response",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "insertMeasurements_v3 returned undefined" },
          deployment_stats: {
            total_measurements: measurements.length,
            successful_insertions: 0,
            failed_insertions: measurements.length,
            transformation_failures: 0,
          },
        };
      }

      return result;
    } catch (error) {
      logger.error(`🐛🐛 v0 Add Values With Stats Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  processLocationIds: async (
    { grid_ids, cohort_ids, airqloud_ids, type },
    request,
    next
  ) => {
    try {
      let locationErrors = 0;

      if (type === "grid" && grid_ids) {
        await createEvent.processGridIds(grid_ids, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      } else if (type === "cohort" && cohort_ids) {
        await createEvent.processCohortIds(cohort_ids, request);
        if (isEmpty(request.query.device_id)) {
          locationErrors++;
        }
      } else if (type === "airqloud" && airqloud_ids) {
        await createEvent.processAirQloudIds(airqloud_ids, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      return {
        success: locationErrors === 0,
        locationErrors,
        message:
          locationErrors > 0
            ? `Unable to process measurements for the provided ${type} IDs`
            : "Successfully processed location IDs",
      };
    } catch (error) {
      logger.error(`🐛🐛 Process Location IDs Error ${error.message}`);
      return {
        success: false,
        locationErrors: 1,
        message: "Error processing location IDs",
        errors: { message: error.message },
      };
    }
  },

  // Business logic for handling common event listing patterns
  prepareEventListingRequest: (req, options = {}) => {
    try {
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const request = {
        ...req,
        query: {
          ...req.query,
          tenant: isEmpty(req.query.tenant) ? defaultTenant : req.query.tenant,
          recent: options.recent || "no",
          metadata: options.metadata || "site_id",
          brief: "yes",
          ...options.additionalQuery,
        },
      };

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      logger.error(`🐛🐛 Prepare Event Listing Request Error ${error.message}`);
      return {
        success: false,
        message: "Error preparing request",
        errors: { message: error.message },
      };
    }
  },

  // Business logic for cache operations with better error handling
  handleCacheOperation: async (operation, data, request, next) => {
    try {
      let cacheResult = { success: false };

      if (operation === "get") {
        try {
          cacheResult = await Promise.race([
            createEvent.getCache(request, next),
            new Promise((resolve) =>
              setTimeout(resolve, CACHE_TIMEOUT_PERIOD, {
                success: false,
                message: "Cache timeout",
                isCacheTimeout: true,
              })
            ),
          ]);
        } catch (error) {
          logRedisWarning("get operation");
        }
      } else if (operation === "set" && data) {
        try {
          await Promise.race([
            createEvent.setCache(data, request, next),
            new Promise((resolve) =>
              setTimeout(resolve, CACHE_TIMEOUT_PERIOD, {
                success: false,
                message: "Cache set timeout",
              })
            ),
          ]);
        } catch (error) {
          logRedisWarning("set operation");
        }
      }

      return cacheResult;
    } catch (error) {
      logRedisWarning("operation");
      return { success: false, message: "Cache operation failed" };
    }
  },

  listFromReadingsOptimized: async (request, next) => {
    try {
      const { query } = request;
      let { limit, skip, tenant, language, recent } = query;

      limit = Number(limit) || 30;
      skip = Number(skip) || 0;
      let page = parseInt(query.page);

      if (page) {
        skip = parseInt((page - 1) * limit);
      }

      // Try cache first
      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning ultra-optimized cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache operation failed: ${stringify(error)}`);
      }

      // Generate simple filter for Readings
      const filter = generateFilter.readings(request, next);

      // **Use ultra-fast method with no aggregations**
      const responseFromListReadings = await ReadingModel(
        tenant
      ).listRecentOptimized(
        {
          filter,
          skip,
          limit,
          page,
        },
        next
      );

      if (!responseFromListReadings.success) {
        return responseFromListReadings;
      }

      const data = responseFromListReadings.data;

      // Handle language translation (only if needed)
      if (
        language !== undefined &&
        !isEmpty(data) &&
        data[0] &&
        !isEmpty(data[0].data)
      ) {
        for (const event of data[0].data) {
          try {
            if (event.health_tips) {
              const translatedHealthTips = await translate.translateTips(
                { healthTips: event.health_tips, targetLanguage: language },
                next
              );
              if (translatedHealthTips.success === true) {
                event.health_tips = translatedHealthTips.data;
              }
            }
          } catch (translationError) {
            logger.warn(`Translation failed: ${translationError.message}`);
          }
        }
      }

      // Set cache
      try {
        await createEvent.handleCacheOperation(
          "set",
          responseFromListReadings,
          request,
          next
        );
      } catch (error) {
        logger.warn(`Cache set failed: ${stringify(error)}`);
      }

      return {
        success: true,
        message: isEmpty(data[0].data)
          ? "no measurements for this search"
          : "successfully returned the measurements",
        data,
        status: httpStatus.OK,
        isCache: false,
        source: "readings_ultra_optimized",
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Ultra-optimized listFromReadings error: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
};

module.exports = createEvent;
