const EventModel = require("../models/Event");
const MeasurementModel = require("../models/Measurement");
const { logObject, logElement, logText } = require("./log");
const constants = require("../config/constants");
const generateFilter = require("./generate-filter");
const errors = require("./errors");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger("create-event-util");
const { transform } = require("node-json-transform");
const Dot = require("dot-object");
const cleanDeep = require("clean-deep");
const createDeviceUtil = require("./create-device");
const HTTPStatus = require("http-status");
const redis = require("../config/redis");
const axios = require("axios");
const { kafkaConsumer } = require("../config/kafkajs");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const { generateDateFormat, generateDateFormatWithoutHrs } = require("./date");

const httpStatus = require("http-status");

const createEvent = {
  list: async (request, callback) => {
    try {
      const { query } = request;
      let { recent, tenant, device } = query;
      let page = parseInt(query.page);
      let limit = parseInt(query.limit);
      let skip = parseInt(query.skip);
      let filter = {};
      const responseFromFilter = generateFilter.events_v2(request);
      if (responseFromFilter.success === true) {
        filter = responseFromFilter.data;
      }
      if (responseFromFilter.success === false) {
        const errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        logObject("responseFromFilter", errors);
      }

      createEvent.getCache(request, async (result) => {
        if (result.success === true) {
          logText(result.message);
          callback(result.data);
        }
        if (result.success === false) {
          await createDeviceUtil.getDevicesCount(request, async (result) => {
            if (result.success === true) {
              if ((device && !recent) || recent === "no") {
                if (!limit) {
                  limit = parseInt(constants.DEFAULT_EVENTS_LIMIT);
                }
                if (!skip) {
                  if (page) {
                    skip = parseInt((page - 1) * limit);
                  } else {
                    skip = parseInt(constants.DEFAULT_EVENTS_SKIP);
                  }
                }
              }
              if ((!recent && !device) || recent === "yes") {
                if (!limit) {
                  limit = result.data;
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

              if (responseFromListEvents.success === true) {
                const data = cleanDeep(responseFromListEvents.data);
                createEvent.setCache(data, request, (result) => {
                  if (result.success === true) {
                    logText(result.message);
                  }
                  if (result.success === false) {
                    logText(result.message);
                  }
                });

                const status = responseFromListEvents.status
                  ? responseFromListEvents.status
                  : "";
                callback({
                  success: true,
                  message: responseFromListEvents.message,
                  data,
                  status,
                  isCache: false,
                });
              }

              if (responseFromListEvents.success === false) {
                const status = responseFromListEvents.status
                  ? responseFromListEvents.status
                  : "";
                const errors = responseFromListEvents.errors
                  ? responseFromListEvents.errors
                  : { message: "" };
                callback({
                  success: false,
                  message: responseFromListEvents.message,
                  errors,
                  status,
                  isCache: false,
                });
              }
            }
            if (result.success === false) {
              logText(result.message);
            }
          });
        }
      });
    } catch (error) {
      callback({
        success: false,
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
  create: async (request) => {
    try {
      const responseFromTransformEvent = await createEvent.transformManyEvents(
        request
      );
      if (responseFromTransformEvent.success === true) {
        let transformedEvents = responseFromTransformEvent.data;
        let nAdded = 0;
        let eventsAdded = [];
        let eventsRejected = [];
        let errors = [];

        for (const event of transformedEvents) {
          try {
            let value = event;
            let dot = new Dot(".");
            let options = event.options;
            let filter = cleanDeep(event.filter);
            let update = event.update;
            dot.delete(["filter", "update", "options"], value);
            update["$push"] = { values: value };

            const addedEvents = await MeasurementModel("view").updateOne(
              filter,
              update,
              options
            );
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
            status: HTTPStatus.CONFLICT,
            message: "all operations failed with conflicts",
            errors,
          };
        } else if (errors.length > 0 && nAdded > 0) {
          return {
            success: false,
            status: HTTPStatus.OK,
            message: "finished the operation with some conflicts",
            errors,
          };
        } else if (errors.length === 0 && nAdded > 0) {
          return {
            success: true,
            status: HTTPStatus.OK,
            message: "successfully added all the events",
          };
        }
      } else if (responseFromTransformEvent.success === false) {
        return responseFromTransformEvent;
      }
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  generateOtherDataString: (inputObject) => {
    try {
      const str = Object.values(inputObject).join(",");
      return str;
    } catch (error) {
      logElement("the error for getting data string", error.message);
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
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  transmitMultipleSensorValues: async (request) => {
    try {
      let requestBody = {};
      const responseFromListDevice = await createDeviceUtil.list(request);
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
            message: "no matching devices found",
          };
        }
      } else if (responseFromListDevice.success === false) {
        const status = responseFromListDevice.status
          ? responseFromListDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromListDevice.errors
          ? responseFromListDevice.errors
          : { message: "" };

        return {
          success: false,
          message: responseFromListDevice.message,
          errors,
          status,
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
      const responseFromDecryptKey = await createDeviceUtil.decryptKey(api_key);
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
              status: HTTPStatus.CONFLICT,
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
          return {
            success: false,
            message: "Server Error",
            errors: {
              message: error.response
                ? error.response.data.error.details
                : "Unable to establish connection with external system",
            },
            status: error.response
              ? error.response.data.status
              : HTTPStatus.INTERNAL_SERVER_ERROR,
          };
        });
    } catch (error) {
      logger.error(`transmitMultipleSensorValues -- ${error.message}`);
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

      const responseFromListDevice = await createDeviceUtil.list(request);

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

      const responseFromDecryptKey = await createDeviceUtil.decryptKey(api_key);
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
              status: HTTPStatus.CONFLICT,
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
              status: HTTPStatus.OK,
            };
          }
        })
        .catch(function(error) {
          return {
            success: false,
            message: "Server Error",
            errors: {
              message: error.response
                ? error.response.data.error.details
                : "Unable to establish connection with external system",
            },
            status: error.response
              ? error.response.data.status
              : HTTPStatus.INTERNAL_SERVER_ERROR,
          };
        });
    } catch (error) {
      logger.error(`the error for bulk transmission -- ${error.message}`);
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
      tenant,
      skip,
      limit,
      frequency,
      startTime,
      endTime,
      metadata,
      external,
      recent,
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
    }`;
  },
  getEventsCount: async (request) => {},
  setCache: (data, request, callback) => {
    try {
      const cacheID = createEvent.generateCacheID(request);
      redis.set(
        cacheID,
        JSON.stringify({
          isCache: true,
          success: true,
          message: `successfully retrieved the measurements`,
          data,
        })
      );
      redis.expire(cacheID, parseInt(constants.EVENTS_CACHE_LIMIT));
      callback({
        success: true,
        message: "response stored in cache",
      });
    } catch (error) {
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  getCache: (request, callback) => {
    try {
      const cacheID = createEvent.generateCacheID(request);
      redis.get(cacheID, async (err, result) => {
        const resultJSON = JSON.parse(result);
        if (result) {
          callback({
            success: true,
            message: "utilising cache...",
            data: resultJSON,
          });
        } else if (err) {
          callback({
            success: false,
            message: "Internal Server Error",
            errors: { message: err.message },
          });
        } else {
          callback({
            success: false,
            message: "no cache present",
            data: resultJSON,
            errors: err,
          });
        }
      });
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
      };
    }
  },

  transformOneEvent: async ({ data = {}, map = {}, context = {} } = {}) => {
    try {
      let dot = new Dot(".");
      let modifiedFilter = {};

      let result = {};
      let transformedEvent = transform(data, map, context);
      let responseFromEnrichOneEvent = await createEvent.enrichOneEvent(
        transformedEvent
      );
      if (responseFromEnrichOneEvent.success === true) {
        result = responseFromEnrichOneEvent.data;
      } else if (responseFromEnrichOneEvent.success === false) {
        logger.error(
          `responseFromEnrichOneEvent , not a success -- ${responseFromEnrichOneEvent.message}`
        );
        return {
          success: false,
          message: "unable to enrich event using device details",
          errors: { message: responseFromEnrichOneEvent.message },
        };
      }
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
    } catch (error) {
      logger.error(`transform -- ${error.message}`);
      return {
        success: false,
        message: "server error - trasform util",
        errors: { message: error.message },
      };
    }
  },
  enrichOneEvent: async (transformedEvent) => {
    try {
      logger.info(
        `the transformedEvent received for enrichment -- ${JSON.stringify(
          transformedEvent
        )}`
      );
      let request = {};
      let enrichedEvent = transformedEvent;
      request["query"] = {};
      request["query"]["device_id"] = transformedEvent.filter.device_id;
      request["query"]["tenant"] = transformedEvent.tenant;

      const responseFromGetDeviceDetails = await createDeviceUtil.list(request);
      logger.info(
        `responseFromGetDeviceDetails ${JSON.stringify(
          responseFromGetDeviceDetails
        )}`
      );
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
            status: HTTPStatus.NOT_FOUND,
          };
        }
      } else if (responseFromGetDeviceDetails.success === false) {
        let errors = responseFromGetDeviceDetails.errors
          ? responseFromGetDeviceDetails.errors
          : { message: "" };
        logger.error(
          `responseFromGetDeviceDetails was not a success -- ${responseFromGetDeviceDetails.message} -- ${errors}`
        );
        return {
          success: false,
          message: responseFromGetDeviceDetails.message,
          errors,
        };
      }
    } catch (error) {
      logger.error(`server side error -- enrich one event -- ${error.message}`);
      return {
        success: false,
        message: "server error",
        errors: { message: error.message },
      };
    }
  },
  transformManyEvents: async (request) => {
    try {
      const { body, query } = request;

      logger.info(
        `the body received for transformation -- ${JSON.stringify(body)}`
      );
      let promises = body.map(async (event) => {
        let data = event;
        let map = constants.EVENT_MAPPINGS;
        let context = event;
        context["device_id"] = ObjectId(event.device_id);
        context["site_id"] = ObjectId(event.site_id);

        let responseFromTransformEvent = await createEvent.transformOneEvent({
          data,
          map,
          context,
        });

        logger.info(
          `responseFromTransformEvent -- ${JSON.stringify(
            responseFromTransformEvent
          )}`
        );
        if (responseFromTransformEvent.success === true) {
          logger.info(
            `responseFromTransformEvent is a success -- ${responseFromTransformEvent.message}`
          );
          return {
            success: true,
            data: responseFromTransformEvent.data,
            message: responseFromTransformEvent.message,
          };
        } else if (responseFromTransformEvent.success === false) {
          let errors = responseFromTransformEvent.errors
            ? responseFromTransformEvent.errors
            : { message: "" };
          logger.error(
            `responseFromTransformEvent is not a success -- unable to transform -- ${errors}`
          );
          return {
            success: false,
            errors,
            message: "unable to transform",
          };
        }
      });
      return Promise.all(promises).then((results) => {
        let transforms = [];
        let errors = [];
        if (results.every((res) => res.success === true)) {
          logger.info(`success tranformEvents -- ${JSON.stringify(results)}`);
          for (const result of results) {
            transforms.push(result.data);
          }
          return {
            success: true,
            data: transforms,
            message: "successful transformations",
          };
        } else if (results.every((res) => res.success === false)) {
          for (const result of results) {
            let error = result.errors ? result.errors : { message: "" };
            errors.push(error);
          }
          logger.error(
            `unsuccessful tranformEvents -- ${JSON.stringify(errors)}}`
          );
          return {
            success: false,
            errors,
            message: "failed transformations",
          };
        }
      });
    } catch (error) {
      logger.error(`transformEvents -- ${error.message}`);
      return {
        success: false,
        message: "server side error - transformEvents ",
        errors: { message: error.message },
      };
    }
  },
  addEvents: async (request) => {
    try {
      logText("adding the events insertTransformedEvents to the util.....");
      logger.info(`adding events in the util.....`);
      let { tenant } = request.query;
      let { body } = request;
      let responseFromTransformEvents = await createEvent.transformManyEvents(
        request
      );

      logger.info(
        `responseFromTransformEvents -- ${JSON.stringify(
          responseFromTransformEvents
        )}`
      );
      if (responseFromTransformEvents.success === false) {
        logElement("responseFromTransformEvents was false?", true);
        let errors = responseFromTransformEvents.errors
          ? responseFromTransformEvents.errors
          : { message: "" };
        return {
          success: false,
          message: responseFromTransformEvents.message,
          errors,
        };
      } else if (responseFromTransformEvents.success === true) {
        let transformedMeasurements = responseFromTransformEvents.data;
        let responseFromInsertEvents = await createEvent.insertTransformedEvents(
          tenant,
          transformedMeasurements
        );

        if (responseFromInsertEvents.success) {
          return {
            success: true,
            message: responseFromInsertEvents.message,
            data: responseFromInsertEvents.data,
          };
        } else if (!responseFromInsertEvents.success) {
          let errors = responseFromInsertEvents.errors
            ? responseFromInsertEvents.errors
            : "";
          return {
            success: false,
            message: responseFromInsertEvents.message,
            errors,
          };
        }
      }
    } catch (error) {
      logger.error(`the server side error -- addEvents -- ${error.message}`);
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
          logger.info(`the filter -- ${JSON.stringify(filter)}`);

          dot.delete(
            ["filter", "update", "options", "modifiedFilter", "tenant", "day"],
            value
          );
          logger.info(`the value -- ${JSON.stringify(value)}`);

          update["$push"] = { values: value };
          logger.info(`the update -- ${JSON.stringify(update)}`);

          logger.info(`the options -- ${JSON.stringify(options)}`);

          const addedEvents = await Model(tenant).updateOne(
            modifiedFilter,
            update,
            options
          );

          logger.info(`addedEvents -- ${JSON.stringify(addedEvents)}`);

          dot.delete("nValues", filter);
          if (!isEmpty(addedEvents)) {
            logger.info(`successfuly added the event`);
            let insertion = {
              msg: "successfuly added the event",
              event_details: filter,
              status: HTTPStatus.CREATED,
            };
            data.push(insertion);
          }

          if (isEmpty(addedEvents)) {
            let errMsg = {
              msg: "unable to add the event",
              event_details: filter,
              status: HTTPStatus.NOT_MODIFIED,
            };
            errors.push(errMsg);
            logger.info(
              `nothing added, empty response -- duplicate event -- ${JSON.stringify(
                event
              )}`
            );
          }
        } catch (error) {
          logger.error(`insertTransformedEvents -- ${error.message}`);
          dot.delete("nValues", filter);
          let errMsg = {
            msg: "duplicate event",
            event_details: filter,
            status: HTTPStatus.FORBIDDEN,
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
          errors: errors,
        };
      } else {
        return {
          success: true,
          message: "successfully added all the events",
          data,
        };
      }
    } catch (error) {
      logger.error(`insert measurements -- ${error.message}`);
      return {
        success: false,
        message: "server side error",
        errors: { message: error.message },
      };
    }
  },
  viewEvents: async (request) => {
    let { tenant } = request.query;
    const dot = new Dot("-");
    const limit = parseInt(request.query.limit, 0);
    const skip = parseInt(request.query.skip, 0);

    let responseFromFilter = generateFilter.events_v2(request);
    let filter = {};
    if (responseFromFilter.success === true) {
      filter = responseFromFilter.data;
    } else if (responseFromFilter.success === false) {
      let errors = responseFromFilter.errors
        ? responseFromFilter.errors
        : { message: "" };
      return {
        success: false,
        message: responseFromFilter.message,
        errors,
      };
    }
    let _limit = limit ? limit : 100;
    let _skip = skip ? skip : 0;
    let responseFromListEvents = await EventModel(tenant).view({
      _skip,
      _limit,
      filter,
    });

    if (responseFromListEvents.success === true) {
      let eventsArray = responseFromListEvents.data;
      let dottedEventsArray = eventsArray.map((object) => dot.object(object));
      return {
        success: true,
        message: responseFromListEvents.message,
        data: dottedEventsArray,
      };
    }

    if (responseFromListEvents.success === false) {
      let errors = responseFromListEvents.errors
        ? responseFromListEvents.errors
        : { message: "" };
      return {
        success: false,
        message: responseFromListEvents.message,
        errors,
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

      let filter = {};
      let responseFromFilter = generateFilter.events_v2(request);

      if (responseFromFilter.success == true) {
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
        };
      }

      let responseFromClearEvents = { success: false, message: "coming soon" };

      if (responseFromClearEvents.success == true) {
        return {
          success: true,
          message: responseFromClearEvents.message,
          data: responseFromClearEvents.data,
        };
      } else if (responseFromClearEvents.success == false) {
        let error = responseFromClearEvents.error
          ? responseFromClearEvents.error
          : { message: "" };

        return {
          success: false,
          message: responseFromClearEvents.message,
          errors: responseFromClearEvents.error,
        };
      }
    } catch (e) {
      logger.error(`server error, clearEventsOnPlatform -- ${e.message}`);
      errors.utillErrors.errors.tryCatchErrors(
        "clearEventsOnPlatform util",
        e.message
      );
    }
  },
  consume: async () => {
    try {
      const kafkaMessage = [
        {
          time: "2022-03-18T13:00:00Z",
          tenant: "kcca",
          site_id: "60d2b7e27e9018a1a8d38c28",
          device_id: "6228c43567c2db20bffaa0cb",
          device_number: 0,
          device: "A0WN66FH",
          latitude: "0.2857506",
          longitude: "32.5783253",
          pm2_5: 45.11,
          pm10: 39.16,
          s1_pm2_5: 26.4,
          s1_pm10: 39.16,
          s2_pm2_5: null,
          s2_pm10: null,
          pm2_5_calibrated_value: 45.11,
          pm10_calibrated_value: null,
          altitude: null,
          wind_speed: null,
          external_temperature: 27.82,
          external_humidity: 56.76,
        },
        {
          time: "2022-03-19T13:00:00Z",
          tenant: "airqo",
          frequency: "minute",
          site_id: "60d2b7e27e9018a1a8d38c28",
          device_id: "6228c43567c2db20bffaa0cb",
          device_number: 0,
          device: "aq_613_97",
          latitude: "0.2857506",
          longitude: "32.5783253",
          pm2_5: 45.11,
          pm10: 39.16,
          s1_pm2_5: 26.4,
          s1_pm10: 39.16,
          s2_pm2_5: null,
          s2_pm10: null,
          pm2_5_calibrated_value: 45.11,
          pm10_calibrated_value: null,
          altitude: null,
          wind_speed: null,
          external_temperature: 27.82,
          external_humidity: 56.76,
        },
      ];
      /**
       * during insertion, we need to deal with situations where
       * there is no frequency. We need to validate the inoput from here?
       *
       * we also need to properly handle the server errors, not everything
       * is duplicate errors! :)
       */
      let request = {};
      request["body"] = kafkaMessage;

      const responseFromCreateMeasurements = await createEvent.create(request);

      return responseFromCreateMeasurements;

      // measurements = await kafkaConsumer.subscribe({
      //   topic: constants.HOURLY_MEASUREMENTS_TOPIC,
      //   fromBeginning: true,
      // });
      // await kafkaConsumer.run({
      //   eachMessage: async ({ message }) => {
      //     // logElement("received message", message.value.toString());

      //     let measurements = message.value.toString().data;
      //     logElement("received message", measurements);

      //     const responseFromInsertMeasurements = await createEvent.insert(
      //       "airqo",
      //       measurements
      //     );
      //     logObject(
      //       "responseFromInsertMeasurements",
      //       responseFromInsertMeasurements
      //     );
      //     return responseFromInsertMeasurements;

      //     // return {
      //     //   success: true,
      //     //   message: "received the topic data",
      //     //   data: message.value.toString(),
      //     // };
      //   },
      // });
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
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
        `unable to transform measurements -- ${responseFromTransformMeasurements.message}`
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
        logObject("the detailed db conflict error", e);
        logger.error(`internal server serror ${e.message}`);
        eventsRejected.push(measurement);
        let errMsg = {
          msg: "there is a system conflict, most likely a duplicate record",
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
        errors: errors,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    } else {
      return {
        success: true,
        message: "successfully added all the events",
        status: HTTPStatus.OK,
      };
    }
  },
  transformMeasurements: (device, measurements) => {
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
        console.log("the errors: ", e.message);
        return {
          device: device,
          success: false,
          message: e.message,
        };
      }
    });
    return Promise.all(promises).then((results) => {
      if (results.every((res) => res.success)) {
        return results;
      } else {
        console.log("the results for no success", results);
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
          console.log("the errors: ", e.message);
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
      logElement("Internal Server Error", e.message);
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
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
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

      const responseFromListDevice = await createDeviceUtil.list(request);

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
            console.log(error);
            return {
              message: `unable to clear the device data, device ${device} does not exist`,
              success: false,
            };
          });
      } else {
        logText(`device ${device} does not exist in the system`);
        return {
          message: `device ${device} does not exist in the system`,
          success: false,
        };
      }
    } catch (e) {
      logText(`unable to clear device ${device}`);
      return {
        success: false,
        message: "Internal Server Error",
      };
    }
  },
};

module.exports = createEvent;
