const EventModel = require("@models/Event");
const DeviceModel = require("@models/Device");
const { logObject, logElement, logText } = require("./log");
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const errors = require("./errors");
const isEmpty = require("is-empty");
const cryptoJS = require("crypto-js");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-event-util`
);
const { transform } = require("node-json-transform");
const Dot = require("dot-object");
const cleanDeep = require("clean-deep");
const redis = require("@config/redis");
const axios = require("axios");
const { BigQuery } = require("@google-cloud/bigquery");
const bigquery = new BigQuery();
const {
  generateDateFormatWithoutHrs,
  addMonthsToProvideDateTime,
  formatDate,
} = require("./date");
const { Parser } = require("json2csv");
const httpStatus = require("http-status");
const translateUtil = require("./translate");

const listDevices = async (request) => {
  try {
    const { tenant } = request.query;
    const limit = parseInt(request.query.limit, 0);
    const skip = parseInt(request.query.skip, 0);
    logObject("the request for the filter", request);
    const filter = generateFilter.devices(request);
    const responseFromListDevice = await DeviceModel(tenant).list({
      filter,
      limit,
      skip,
    });
    if (responseFromListDevice.success === false) {
      let errors = responseFromListDevice.errors
        ? responseFromListDevice.errors
        : { message: "" };
      try {
        let errorsString = errors ? JSON.stringify(errors) : "";
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
  } catch (e) {
    logger.error(`error for list devices util -- ${e.message}`);
    return {
      success: false,
      message: "list devices util - server error",
      errors: { message: e.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
const getDevicesCount = async (request) => {
  try {
    const { query } = request;
    const { tenant } = query;

    const count = await DeviceModel(tenant).countDocuments({});

    if (count) {
      return {
        success: true,
        message: "retrieved the number of devices",
        status: httpStatus.OK,
        data: count,
      };
    } else {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "No devices found" }, // You can customize the error message as needed
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  } catch (error) {
    logger.error(`internal server error -- ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
    };
  }
};
const decryptKey = async (encryptedKey) => {
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
  } catch (err) {
    logger.error(`internal server error -- ${err.message}`);
    return {
      success: false,
      message: "unable to decrypt the key",
      errors: { message: err.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const createEvent = {
  getMeasurementsFromBigQuery: async (req) => {
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

      const responseFromGetDeviceDetails = await listDevices(req);
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
            `unable to retrieve device details --- ${JSON.stringify(
              responseFromGetDeviceDetails.errors
            )}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
      }

      if (!isEmpty(deviceDetails) && deviceDetails.visibility === false) {
        if (isEmpty(access_code) || deviceDetails.access_code !== access_code) {
          // return {
          //   success: false,
          //   message: "not authorized",
          //   status: httpStatus.UNAUTHORIZED,
          //   errors: { message: "not authorized" },
          // };
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
      logObject("error", error);
      logger.error(`internal server error --- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  latestFromBigQuery: async (req) => {
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  list: async (request) => {
    try {
      let missingDataMessage = "";
      const { query } = request;
      let { limit, skip } = query;
      const { recent, tenant, device } = query;
      let page = parseInt(query.page);
      const language = request.query.language;
      const filter = generateFilter.events(request);
      // const cacheResult = await createEvent.getCache(request);

      // if (cacheResult.success === true) {
      //   logText(cacheResult.message);
      //   return cacheResult.data;
      // }

      const deviceCountResult = await getDevicesCount(request);

      if (deviceCountResult.success === false) {
        logger.error(
          `Unable to retrieve events --- ${JSON.stringify(deviceCountResult)}`
        );
        logText(deviceCountResult.message);
        return deviceCountResult;
      }

      if ((!recent && !device) || recent === "yes") {
        if (!limit) {
          limit = deviceCountResult.data;
        }
        if (!skip) {
          if (page) {
            skip = parseInt((page - 1) * limit);
          } else {
            skip = parseInt(constants.DEFAULT_EVENTS_SKIP);
          }
        }
      } else {
        if (!limit) {
          limit = parseInt(constants.DEFAULT_EVENTS_LIMIT) || 1000;
        }
        if (!skip) {
          if (page) {
            skip = parseInt((page - 1) * limit);
          } else {
            skip = parseInt(constants.DEFAULT_EVENTS_SKIP);
          }
        }
      }

      const responseFromListEvents = await EventModel(tenant).list({
        skip,
        limit,
        filter,
        page,
      });

      if (
        language !== undefined &&
        constants.ENVIRONMENT === "STAGING ENVIRONMENT"
      ) {
        let data = responseFromListEvents.data[0].data;
        for (const event of data) {
          let translatedHealthTips = await translateUtil.translateTips(
            event.health_tips,
            language
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      if (responseFromListEvents.success === true) {
        let data = responseFromListEvents.data;
        data[0].data = !isEmpty(missingDataMessage) ? [] : data[0].data;

        // await createEvent.setCache(data, request);

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
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal server error -- ${error.message}`);

      return {
        success: false,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
      };
    }
  },
  create: async (request) => {
    try {
      const responseFromTransformEvent = await createEvent.transformManyEvents(
        request
      );
      logObject("responseFromTransformEvent man", responseFromTransformEvent);
      if (responseFromTransformEvent.success === true) {
        let transformedEvents = responseFromTransformEvent.data;
        let nAdded = 0;
        let eventsAdded = [];
        let eventsRejected = [];
        let errors = [];

        for (const event of transformedEvents) {
          try {
            logObject("event", event);
            let value = event;
            let dot = new Dot(".");
            let options = event.options;
            let filter = cleanDeep(event.filter);
            let update = event.update;
            dot.delete(["filter", "update", "options"], value);
            update["$push"] = { values: value };

            logObject("event.tenant", event.tenant);
            logObject("update", update);
            logObject("filter", filter);
            logObject("options", options);

            const addedEvents = await EventModel(event.tenant).updateOne(
              filter,
              update,
              options
            );
            logObject("addedEvents", addedEvents);
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
      } else if (responseFromTransformEvent.success === false) {
        logText("maan, things have jam!");
        return responseFromTransformEvent;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  generateOtherDataString: (inputObject) => {
    try {
      const str = Object.values(inputObject).join(",");
      return str;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
    }
  },
  createThingSpeakRequestBody: (req) => {
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
        stringPositionsAndValues
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  transmitMultipleSensorValues: async (request) => {
    try {
      let requestBody = {};
      const responseFromListDevice = await listDevices(request);
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

      logObject(
        "requestBodyForCreateThingsSpeakBody",
        requestBodyForCreateThingsSpeakBody
      );

      const responseFromCreateRequestBody = createEvent.createThingSpeakRequestBody(
        requestBodyForCreateThingsSpeakBody
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
              `internal server error -- ${JSON.stringify(
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
      };
    }
  },
  bulkTransmitMultipleSensorValues: async (request) => {
    try {
      logText("bulk write to thing.......");
      const { name, chid, device_number, tenant } = request.query;
      const { body } = request;

      const responseFromListDevice = await listDevices(request);

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
        enrichedBody
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
              `internal server error -- ${JSON.stringify(
                error.response.data.error
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
                ? error.response.data.error
                : "Unable to establish connection with external system",
            },
            status: error.response
              ? error.response.data.status
              : httpStatus.INTERNAL_SERVER_ERROR,
          };
        });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  generateCacheID: (request) => {
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
    } = request.query;
    const currentTime = new Date().toISOString();
    const day = generateDateFormatWithoutHrs(currentTime);
    return `list_events_${device ? device : "noDevice"}_${tenant}_${
      skip ? skip : 0
    }_${limit ? limit : 0}_${recent ? recent : "noRecent"}_${
      frequency ? frequency : "noFrequency"
    }_${endTime ? endTime : "noEndTime"}_${
      startTime ? startTime : "noStartTime"
    }_${device_id ? device_id : "noDeviceId"}_${site ? site : "noSite"}_${
      site_id ? site_id : "noSiteId"
    }_${day ? day : "noDay"}_${
      device_number ? device_number : "noDeviceNumber"
    }_${metadata ? metadata : "noMetadata"}_${
      external ? external : "noExternal"
    }_${airqloud ? airqloud : "noAirQloud"}_${
      airqloud_id ? airqloud_id : "noAirQloudID"
    }_${lat_long ? lat_long : "noLatLong"}_${page ? page : "noPage"}_${
      running ? running : "noRunning"
    }_${index ? index : "noIndex"}_${brief ? brief : "noBrief"}_${
      latitude ? latitude : "noLatitude"
    }_${longitude ? longitude : "noLongitude"}_${
      network ? network : "noNetwork"
    }_${language ? language : "noLanguage"}
    `;
  },
  setCache: async (data, request) => {
    try {
      const cacheID = createEvent.generateCacheID(request);
      await redis.set(
        cacheID,
        JSON.stringify({
          isCache: true,
          success: true,
          message: "Successfully retrieved the measurements",
          data,
        })
      );
      await redis.expire(cacheID, parseInt(constants.EVENTS_CACHE_LIMIT));

      return {
        success: true,
        message: "Response stored in cache",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  getCache: async (request) => {
    try {
      const cacheID = createEvent.generateCacheID(request);
      const result = await redis.get(cacheID);
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
      logger.error(`Internal server error -- ${error.message}`);
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  transformOneEvent: async ({ data = {}, map = {}, context = {} } = {}) => {
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
        transformedEvent
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
      logger.error(`internal server error-- ${error.message}`);
      return {
        success: false,
        message: "server error - trasform util",
        errors: { message: error.message },
      };
    }
  },
  enrichOneEvent: async (transformedEvent) => {
    try {
      // logger.info(
      //   `the transformedEvent received for enrichment -- ${JSON.stringify(
      //     transformedEvent
      //   )}`
      // );
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

      const responseFromGetDeviceDetails = await listDevices(request);
      // logger.info(
      //   `responseFromGetDeviceDetails ${JSON.stringify(
      //     responseFromGetDeviceDetails
      //   )}`
      // );
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
            } -- ${JSON.stringify(errors)}`
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
      logger.error(
        `internal server error -- enrich one event -- ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  transformManyEvents: async (request) => {
    try {
      const { body } = request;
      /**
       * Takes in the measurements -- which is request.body
       * Also, it transforms one body at a time to the "nested"
       */

      // logger.info(
      //   `the body received for transformation -- ${JSON.stringify(body)}`
      // );
      let promises = body.map(async (event) => {
        const data = event;
        const map = constants.EVENT_MAPPINGS;

        const responseFromTransformEvent = await createEvent.transformOneEvent({
          data,
          map,
        });
        logObject("responseFromTransformEvent ", responseFromTransformEvent);
        // logger.info(
        //   `responseFromTransformEvent -- ${JSON.stringify(
        //     responseFromTransformEvent
        //   )}`
        // );
        if (responseFromTransformEvent.success === true) {
          // logger.info(
          //   `responseFromTransformEvent is a success -- ${responseFromTransformEvent.message}`
          // );
          return responseFromTransformEvent;
        } else if (responseFromTransformEvent.success === false) {
          let errors = responseFromTransformEvent.errors
            ? responseFromTransformEvent.errors
            : { message: "" };
          try {
            logger.error(
              `responseFromTransformEvent is not a success -- unable to transform -- ${JSON.stringify(
                errors
              )}`
            );
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return responseFromTransformEvent;
        }
      });

      return Promise.all(promises).then((results) => {
        let transforms = [];
        let errors = [];
        if (results.every((res) => res.success === true)) {
          // logger.info(`success tranformEvents -- ${JSON.stringify(results)}`);
          for (const result of results) {
            transforms.push(result.data);
          }
        } else if (results.every((res) => res.success === false)) {
          for (const result of results) {
            let error = result.errors ? result.errors : { message: "" };
            errors.push(error);
          }
          try {
            // logger.error(
            //   `unsuccessful tranformEvents -- ${JSON.stringify(errors)}}`
            // );
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "server side error - transformEvents ",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  addEvents: async (request) => {
    try {
      logText("adding the events insertTransformedEvents to the util.....");
      // logger.info(`adding events in the util.....`);
      /**
       * Step One: trasform or prepare for insertion into Events collection -- prepare the nesting expexctation
       * Step Two: Insert
       */
      const { tenant } = request.query;
      const responseFromTransformEvents = await createEvent.transformManyEvents(
        request
      );

      if (responseFromTransformEvents.success === false) {
        logElement("responseFromTransformEvents was false?", true);
        return responseFromTransformEvents;
      } else if (responseFromTransformEvents.success === true) {
        const transformedMeasurements = responseFromTransformEvents.data;
        const responseFromInsertEvents = await createEvent.insertTransformedEvents(
          tenant,
          transformedMeasurements
        );
        return responseFromInsertEvents;
      }
    } catch (error) {
      logger.error(`internal server error -- addEvents -- ${error.message}`);
      return {
        success: false,
        message: "server side error",
        errors: { message: error.message },
      };
    }
  },
  insertTransformedEvents: async (tenant, events) => {
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
          // logger.info(`the filter -- ${JSON.stringify(filter)}`);

          dot.delete(
            ["filter", "update", "options", "modifiedFilter", "tenant", "day"],
            value
          );
          // logger.info(`the value -- ${JSON.stringify(value)}`);

          update["$push"] = { values: value };
          // logger.info(`the update -- ${JSON.stringify(update)}`);

          // logger.info(`the options -- ${JSON.stringify(options)}`);

          const addedEvents = await Model(tenant).updateOne(
            modifiedFilter,
            update,
            options
          );

          // logger.info(`addedEvents -- ${JSON.stringify(addedEvents)}`);

          dot.delete("nValues", filter);
          if (!isEmpty(addedEvents)) {
            // logger.info(`successfuly added the event`);
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
            // logger.info(
            //   `nothing added, empty response -- duplicate event -- ${JSON.stringify(
            //     event
            //   )}`
            // );
          }
        } catch (error) {
          // logger.error(`internal server error -- ${error.message}`);
          dot.delete("nValues", filter);
          let errMsg = {
            msg: "duplicate event",
            event_details: filter,
            status: httpStatus.FORBIDDEN,
          };
          errors.push(errMsg);
        }
      }

      if (errors.length > 0) {
        logger.error(
          `finished the operation with some errors -- ${JSON.stringify(errors)}`
        );
        return {
          success: false,
          message: "finished the operation with some errors",
          errors,
        };
      } else {
        return {
          success: true,
          message: "successfully added all the events",
          data,
        };
      }
    } catch (error) {
      // logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "internal server error",
        errors: { message: error.message },
      };
    }
  },
  clearEventsOnClarity: (request) => {
    return {
      success: false,
      message: "coming soon - unavailable option",
    };
  },
  clearEventsOnPlatform: async (request) => {
    try {
      const { device, name, id, device_number, tenant } = request.query;

      const filter = generateFilter.events(request);

      let responseFromClearEvents = { success: false, message: "coming soon" };

      if (responseFromClearEvents.success === true) {
        return responseFromClearEvents;
      } else if (responseFromClearEvents.success === false) {
        return responseFromClearEvents;
      }
    } catch (e) {
      logger.error(
        `internal server error, clearEventsOnPlatform -- ${e.message}`
      );
      errors.utillErrors.errors.tryCatchErrors(
        "clearEventsOnPlatform util",
        e.message
      );
    }
  },
  insertMeasurements: async (measurements) => {
    try {
      const responseFromInsertMeasurements = await createEvent.insert(
        "airqo",
        measurements
      );
      logObject(
        "responseFromInsertMeasurements",
        responseFromInsertMeasurements
      );
      return responseFromInsertMeasurements;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Unable to insert measurements",
        errors: {
          message: error.message,
        },
      };
    }
  },
  insert: async (tenant, measurements) => {
    let nAdded = 0;
    let eventsAdded = [];
    let eventsRejected = [];
    let errors = [];

    const responseFromTransformMeasurements = await createEvent.transformMeasurements_v2(
      measurements
    );

    if (!responseFromTransformMeasurements.success) {
      logger.error(
        `internal server error -- unable to transform measurements -- ${
          responseFromTransformMeasurements.message
        }, ${JSON.stringify(measurements)}`
      );
    }

    for (const measurement of responseFromTransformMeasurements.data) {
      try {
        logObject("the measurement in the insertion process", measurement);
        const eventsFilter = {
          day: measurement.day,
          site_id: measurement.site_id,
          device_id: measurement.device_id,
          nValues: { $lt: parseInt(constants.N_VALUES) },
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
        logObject("someDeviceDetails", someDeviceDetails);

        logObject("the measurement", measurement);

        const eventsUpdate = {
          $push: { values: measurement },
          $min: { first: measurement.time },
          $max: { last: measurement.time },
          $inc: { nValues: 1 },
        };
        logObject("eventsUpdate", eventsUpdate);
        logObject("eventsFilter", eventsFilter);

        const addedEvents = await EventModel(tenant).updateOne(
          eventsFilter,
          eventsUpdate,
          {
            upsert: true,
          }
        );
        logObject("addedEvents", addedEvents);
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
              ...(measurement.site_id ? { site_id: measurement.site_id } : {}),
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
              ...(measurement.site_id ? { site_id: measurement.site_id } : {}),
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

    if (errors.length > 0) {
      return {
        success: false,
        message: "finished the operation with some errors",
        errors,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    } else {
      return {
        success: true,
        message: "successfully added all the events",
        status: httpStatus.OK,
      };
    }
  },
  transformMeasurements: async (device, measurements) => {
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
  transformMeasurements_v2: async (measurements) => {
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "unable to transform measurement",
        errors: { message: error.message },
      };
    }
  },
  transformField: (field) => {
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
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
    }
  },
  transformMeasurementFields: async (measurements) => {
    try {
      let transformed = [];
      let request = {};
      for (const measurement of measurements) {
        request["body"] = measurement;
        let responseFromCreateThingSpeakBody = createEvent.createThingSpeakRequestBody(
          request
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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteValuesOnThingspeak: async (req, res) => {
    try {
      const { device, tenant, chid, name, device_number } = req.query;

      let request = {};
      request["query"] = {};
      request["query"]["name"] = device || name;
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = chid || device_number;

      const responseFromListDevice = await listDevices(request);

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
    } catch (e) {
      logText(`unable to clear device ${device}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },
};

module.exports = createEvent;
