const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- event-util`);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  logTextWithTimestamp,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const { transform } = require("node-json-transform");
const Dot = require("dot-object");
const cleanDeep = require("clean-deep");
const redis = require("@config/redis");
const axios = require("axios");
const { BigQuery } = require("@google-cloud/bigquery");
const bigquery = new BigQuery();
const { Parser } = require("json2csv");
const util = require("util");
const redisGetAsync = util.promisify(redis.get).bind(redis);
const redisSetAsync = util.promisify(redis.set).bind(redis);
const redisExpireAsync = util.promisify(redis.expire).bind(redis);
const asyncRetry = require("async-retry");
const EventModel = require("@models/Event");
const ReadingModel = require("@models/Reading");
const {
  generateFilter,
  generateDateFormatWithoutHrs,
  addMonthsToProvideDateTime,
  formatDate,
  translate,
  stringify,
} = require("@utils/common");

const DeviceModel = require("@models/Device");
const SignalModel = require("@models/Signal");
const cryptoJS = require("crypto-js");

const {
  MEASUREMENT_REGISTRY,
  generateValueSchema,
  generateEventMappings,
  generateEventDefaults,
  getPollutantKeys,
  getAggregationPollutants,
  getMeasurementsByCategory,
  getFieldNameMapping,
  getProjectionFields,
} = require("@utils/measurement-registry");

/**
 * Helper function to build AveragedFields query dynamically
 */
function buildAveragedFieldsQuery() {
  // Build fields dynamically from measurement registry
  const basicFields = "site_id, device_id, device_number, timestamp, ";

  // Add all pollutant fields from registry
  const pollutantFields = Object.entries(MEASUREMENT_REGISTRY)
    .filter(([_, def]) => def.isPollutant)
    .map(([key, def]) => {
      // Only include the main value and calibrated value fields
      const mainField = def.mappings.value;
      const calibratedField = def.mappings.calibratedValue || null;

      return calibratedField ? `${mainField}, ${calibratedField}` : mainField;
    })
    .join(", ");

  // Add environmental fields
  const envFields = Object.entries(MEASUREMENT_REGISTRY)
    .filter(([_, def]) => def.category === "environmental")
    .map(([_, def]) => def.mappings.value)
    .join(", ");

  return `${basicFields} ${pollutantFields}, ${envFields},`;
}

/**
 * Helper function to build Raw Fields query dynamically
 */
function buildRawFieldsQuery() {
  // Dynamic fields from the measurement registry
  const basicFields = "site_id, name, device_id, device_number, timestamp,";

  // Add all fields from the registry
  const allFields = Object.entries(MEASUREMENT_REGISTRY)
    .map(([key, def]) => {
      return def.mappings.value;
    })
    .filter((field) => field) // Remove any undefined fields
    .join(", ");

  return `${basicFields} ${allFields},`;
}

/**
 * Create ThingSpeak request body using measurement registry
 */
function createThingSpeakRequestBody(request, next) {
  try {
    const { body } = request;
    const { category } = body;

    // Define appropriate field mapping based on device category
    let fieldMapping;
    if (category === "bam") {
      fieldMapping = constants.BAM_FIELDS_AND_LABELS;
    } else if (category === "gas") {
      fieldMapping = constants.THINGSPEAK_GAS_FIELD_DESCRIPTIONS;
    } else {
      fieldMapping = constants.FIELDS_AND_LABELS;
    }

    // Initialize result object
    let result = {};

    // Map fields using registry
    for (const [field, label] of Object.entries(fieldMapping)) {
      // Find corresponding measurement in registry
      const measurement = Object.entries(MEASUREMENT_REGISTRY).find(
        ([key, def]) => def.mappings.value === label
      );

      if (measurement && body[label] !== undefined) {
        result[field] = body[label];
      } else if (body[label] !== undefined) {
        result[field] = body[label];
      }
    }

    // Handle special fields like created_at (timestamp)
    if (body.timestamp || body.time) {
      result.created_at = body.timestamp || body.time;
    }

    return {
      success: true,
      message: "successfully created the request body",
      data: result,
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

/**
 * Helper function to build mobile fields query dynamically
 */
function buildMobileFieldsQuery() {
  // Start with base fields
  const baseFields =
    "tenant, timestamp, device_number, device_id, latitude, longitude, horizontal_accuracy, ";

  // Add mobile-specific pollutant fields
  const pollutantFields = Object.entries(MEASUREMENT_REGISTRY)
    .filter(([_, def]) => def.isPollutant)
    .map(([key, def]) => {
      const rawField = def.mappings.value;
      const piField =
        def.mappings.calibratedValue &&
        def.mappings.calibratedValue.replace("_calibrated_value", "_pi_value");

      return piField ? `${rawField}, ${piField}` : rawField;
    })
    .join(", ");

  // Add GPS fields
  return `${baseFields} ${pollutantFields}, gps_device_timestamp, timestamp_abs_diff`;
}

/**
 * Helper function to build BAM raw fields query
 */
function buildBamRawFieldsQuery() {
  // Add BAM-specific fields
  const bamFields = [
    "realtime_conc",
    "hourly_conc",
    "short_time_conc",
    "air_flow",
    "wind_speed",
    "wind_direction",
    "temperature",
    "humidity",
    "barometric_pressure",
    "filter_temperature",
    "filter_humidity",
    "status",
    "timestamp",
    "device_id",
    "device_number",
    "site_id",
    "latitude",
    "longitude",
  ].join(", ");

  return bamFields;
}

/**
 * Helper function to build BAM fields query
 */
function buildBamFieldsQuery() {
  // Get pollutant fields specifically for BAM devices
  const bamPollutants = ["pm10", "pm2_5", "no2", "pm1"]
    .map((pollutant) => {
      if (MEASUREMENT_REGISTRY[pollutant]) {
        return MEASUREMENT_REGISTRY[pollutant].mappings.value.replace(
          "_raw_value",
          ""
        );
      }
      return pollutant;
    })
    .join(", ");

  return `site_id, device_id, device_number, timestamp, ${bamPollutants}, latitude, longitude`;
}

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

// Add this helper function for decryption
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

const createEvent = {
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
  fetch: async function(filter) {
    try {
      const request = filter;
      request.skip = filter.skip ? filter.skip : DEFAULT_SKIP;
      request.limit = filter.limit ? filter.limit : DEFAULT_LIMIT;
      request.page = filter.page ? filter.page : DEFAULT_PAGE;
      const result = await fetchData(this, request);
      const transformedData = filterNullAndReportOffDevices(result[0].data);
      result[0].data = transformedData;
      const calculatedValues = computeAveragePm2_5(transformedData);
      result[0].meta.pm2_5Avg = calculatedValues;
      return {
        success: true,
        data: result,
        message: "successfully returned the measurements",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error --- view events -- ${error.message}`
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
        const cacheResult = await Promise.race([
          createEvent.getCache(request, next),
          new Promise((resolve) =>
            setTimeout(resolve, 60000, {
              success: false,
              message: "Internal Server Error",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: { message: "Cache timeout" },
            })
          ),
        ]);

        if (cacheResult.success === true) {
          logText(cacheResult.message);
          return cacheResult.data;
        }
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Errors -- ${stringify(error)}`);
      }

      const readingsResponse = await ReadingModel(tenant).latest(
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
          const resultOfCacheOperation = await Promise.race([
            createEvent.setCache(readingsResponse, request, next),
            new Promise((resolve) =>
              setTimeout(resolve, 60000, {
                success: false,
                message: "Internal Server Error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
                errors: { message: "Cache timeout" },
              })
            ),
          ]);
          if (resultOfCacheOperation.success === false) {
            const errors = resultOfCacheOperation.errors
              ? resultOfCacheOperation.errors
              : { message: "Internal Server Error" };
            logger.error(`🐛🐛 Internal Server Error -- ${stringify(errors)}`);
          }
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Errors -- ${stringify(error)}`);
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

      // Determine the appropriate table and fields based on device type and tenant
      let table = `${constants.DATAWAREHOUSE_AVERAGED_DATA}.hourly_device_measurements`;
      let averaged_fields = buildAveragedFieldsQuery();
      let raw_fields = "";
      let mobile = false;

      if (!isEmpty(deviceDetails) && deviceDetails.category === "bam") {
        table = `${constants.DATAWAREHOUSE_AVERAGED_DATA}.hourly_bam_device_measurements`;
        averaged_fields = buildBamFieldsQuery();
        raw_fields = "";
        mobile = false;
      }

      if (frequency === "raw") {
        if (!isEmpty(deviceDetails) && deviceDetails.category === "bam") {
          raw_fields = buildBamRawFieldsQuery();
          averaged_fields = "";
          table = `${constants.DATAWAREHOUSE_RAW_DATA}.bam_device_measurements`;
        } else {
          table = `${constants.DATAWAREHOUSE_RAW_DATA}.device_measurements`;
          averaged_fields = "";
          raw_fields = buildRawFieldsQuery();
          mobile = false;
        }
      }

      if (tenant === "urban_better") {
        table = `${constants.DATAWAREHOUSE_RAW_DATA}.mobile_device_measurements`;
        mobile = true;
        raw_fields = buildMobileFieldsQuery();
        averaged_fields = "";
      }

      // Build the appropriate query based on device type
      const queryStatement = buildQueryStatement(
        table,
        averaged_fields,
        raw_fields,
        mobile,
        start,
        end,
        site,
        device,
        device_number,
        device_name,
        device_id,
        site_id,
        airqloud_id,
        airqloud_name,
        device_lat_long,
        tenant,
        limit,
        skip
      );

      // Define query options
      const options = {
        query: queryStatement,
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
  /**
   * Build query fields for different types of data
   * These helper functions make it easy to add new measurements in the future
   */
  buildAveragedFieldsQuery: () => {
    // Build fields dynamically from measurement registry
    const basicFields = "site_id, device_id, device_number, timestamp, ";

    // Add all pollutant fields from registry
    const pollutantFields = Object.entries(MEASUREMENT_REGISTRY)
      .filter(([_, def]) => def.isPollutant)
      .map(([key, def]) => {
        // Only include the main value and calibrated value fields
        const mainField = def.mappings.value;
        const calibratedField = def.mappings.calibratedValue || null;

        return calibratedField ? `${mainField}, ${calibratedField}` : mainField;
      })
      .join(", ");

    // Add environmental fields
    const envFields = Object.entries(MEASUREMENT_REGISTRY)
      .filter(([_, def]) => def.category === "environmental")
      .map(([_, def]) => def.mappings.value)
      .join(", ");

    return `${basicFields} ${pollutantFields}, ${envFields},`;
  },
  buildBamFieldsQuery: () => {
    return (
      "site_id, device_id, device_number, timestamp," +
      "pm10, pm2_5, no2, pm1, latitude, longitude"
    );
  },
  buildBamRawFieldsQuery: () => {
    return (
      "realtime_conc, hourly_conc," +
      "short_time_conc , air_flow , wind_speed ," +
      "wind_direction , temperature , humidity," +
      "barometric_pressure , filter_temperature ," +
      "filter_humidity, status, timestamp, device_id," +
      "device_number,site_id, latitude, longitude"
    );
  },
  buildRawFieldsQuery: () => {
    // Dynamic fields from the measurement registry
    const basicFields = "site_id, name, device_id, device_number, timestamp,";

    // Add all fields from the registry
    const allFields = Object.entries(MEASUREMENT_REGISTRY)
      .map(([key, def]) => {
        return def.mappings.value;
      })
      .filter((field) => field) // Remove any undefined fields
      .join(", ");

    return `${basicFields} ${allFields},`;
  },
  buildMobileFieldsQuery: () => {
    return (
      "tenant, timestamp, device_number, device_id, latitude, longitude," +
      "horizontal_accuracy, pm2_5_raw_value, pm1_raw_value, pm10_raw_value," +
      "no2_raw_value, voc_raw_value, pm1_pi_value, pm2_5_pi_value, pm10_pi_value," +
      "voc_pi_value, no2_pi_value, gps_device_timestamp, timestamp_abs_diff"
    );
  },
  /**
   * Helper function to build BigQuery SQL statement
   */
  buildQueryStatement: (
    table,
    averaged_fields,
    raw_fields,
    mobile,
    start,
    end,
    site,
    device,
    device_number,
    device_name,
    device_id,
    site_id,
    airqloud_id,
    airqloud_name,
    device_lat_long,
    tenant,
    limit = constants.DEFAULT_EVENTS_LIMIT,
    skip = constants.DEFAULT_EVENTS_SKIP
  ) => {
    // Different query types based on whether it's mobile data or not
    if (mobile) {
      return `SELECT ${averaged_fields} ${raw_fields}
    FROM \`${table}\` 
    WHERE timestamp 
    >= "${start}" AND timestamp <= "${end}" 
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
    DESC LIMIT ${limit} OFFSET ${skip}`;
    } else {
      return `SELECT ${averaged_fields} ${raw_fields}  \`${
        constants.DATAWAREHOUSE_METADATA
      }.sites\`.latitude AS latitude,
      \`${constants.DATAWAREHOUSE_METADATA}.sites\`.longitude AS longitude, 
      \`${constants.DATAWAREHOUSE_METADATA}.sites\`.tenant AS tenant
    FROM \`${table}\` 
    JOIN \`${constants.DATAWAREHOUSE_METADATA}.sites\` 
    ON \`${constants.DATAWAREHOUSE_METADATA}.sites\`.id = \`${table}\`.site_id 
    WHERE timestamp 
    >= "${start}" AND timestamp <= "${end}" 
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
    DESC LIMIT ${limit} OFFSET ${skip}`;
    }
  },
  list: async (request, next) => {
    try {
      let missingDataMessage = "";
      const { query } = request;
      let { limit, skip } = query;
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
      const filter = generateFilter.events(request, next);

      // Try to get from cache first
      try {
        const cacheResult = await Promise.race([
          createEvent.getCache(request, next),
          new Promise((resolve) =>
            setTimeout(resolve, 60000, {
              success: false,
              message: "Internal Server Error",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: { message: "Cache timeout" },
            })
          ),
        ]);

        logObject("Cache result", cacheResult);

        if (cacheResult.success === true) {
          logText(cacheResult.message);
          return cacheResult.data;
        }
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Errors -- ${stringify(error)}`);
      }

      if (page) {
        skip = parseInt((page - 1) * limit);
      }

      const responseFromListEvents = await EventModel(tenant).list(
        {
          skip,
          limit,
          filter,
          page,
        },
        next
      );

      if (!responseFromListEvents) {
        // Handle cases where responseFromListEvents is null or undefined
        logger.error(`🐛🐛 responseFromListEvents is null or undefined`);
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

      // Handle language translation for health tips
      if (
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
          const resultOfCacheOperation = await Promise.race([
            createEvent.setCache(data, request, next),
            new Promise((resolve) =>
              setTimeout(resolve, 60000, {
                success: false,
                message: "Internal Server Error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
                errors: { message: "Cache timeout" },
              })
            ),
          ]);
          if (resultOfCacheOperation.success === false) {
            const errors = resultOfCacheOperation.errors
              ? resultOfCacheOperation.errors
              : { message: "Internal Server Error" };
            logger.error(`🐛🐛 Internal Server Error -- ${stringify(errors)}`);
          }
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Errors -- ${stringify(error)}`);
        }

        logText("Cache set.");

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
  /**
   * Transmit multiple sensor values to ThingSpeak
   */
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
  /**
   * Bulk transmit multiple sensor values to ThingSpeak
   */
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
  /**
   * Generate a cache ID for storing and retrieving cache
   */
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
      } = { ...request.query, ...request.params };
      const currentTime = new Date().toISOString();
      const day = generateDateFormatWithoutHrs(currentTime);
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
  /**
   * Set data in cache with expiration
   */
  setCache: async (data, request, next) => {
    try {
      const cacheID = createEvent.generateCacheID(request, next);
      await redisSetAsync(
        cacheID,
        stringify({
          isCache: true,
          success: true,
          message: "Successfully retrieved the measurements",
          data,
        })
      );
      await redisExpireAsync(
        cacheID,
        parseInt(constants.EVENTS_CACHE_LIMIT) || 0
      );

      return {
        success: true,
        message: "Response stored in cache",
        status: httpStatus.OK,
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
  /**
   * Get data from cache
   */
  getCache: async (request, next) => {
    try {
      const cacheID = createEvent.generateCacheID(request, next);
      const result = await redisGetAsync(cacheID); // Use the promise-based version

      const resultJSON = JSON.parse(result);

      if (result) {
        return {
          success: true,
          message: "Utilizing cache...",
          data: resultJSON,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "No cache present",
          errors: { message: "No cache present" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
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
  /**
   * Transform one event using the measurement registry
   * Makes it easy to add new measurement types
   */
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

  /**
   * Enrich an event with device details
   */
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
  /**
   * Transform many events using the measurement registry
   */
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

  /**
   * Add events after transforming them
   */
  addEvents: async (request, next) => {
    try {
      const { tenant } = request.query;
      const transformEventsResponses = await createEvent.transformManyEvents(
        request,
        next
      );

      if (transformEventsResponses.success === false) {
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
  /**
   * Insert transformed events
   */
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
  /**
   * Insert measurements
   */
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
  /**
   * Insert measurements for a specific tenant
   */
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
          // Create filter using the measurement data
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

          // Define update operation
          const eventsUpdate = {
            $push: { values: measurement },
            $min: { first: measurement.time },
            $max: { last: measurement.time },
            $inc: { nValues: 1 },
          };

          // Update or insert event
          const addedEvents = await EventModel(tenant).updateOne(
            eventsFilter,
            eventsUpdate,
            {
              upsert: true,
            }
          );

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
          // Handle errors
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
  /**
   * Transform measurements with device information
   */
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
  /**
   * Transform measurements version 2
   * Uses the measurement registry for consistent handling
   */
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
  /**
   * Transform field names for ThingSpeak API
   */
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
  /**
   * Transform measurement fields for ThingSpeak format
   */
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
  /**
   * Delete values on ThingSpeak
   */
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
};

module.exports = createEvent;
