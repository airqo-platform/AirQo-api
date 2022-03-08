const EventModel = require("../models/Event");
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
          : "";
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
                  : "";
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

      const data = await responseFromTransformEvent.data;
      const { filter, update, options } = data;

      logObject("responseFromTransformEvent", responseFromTransformEvent);
      logObject("the filter", filter);
      logObject("the update", update);
      logObject("the options", options);

      if (responseFromTransformEvent.success === "true") {
        let transformedEvents = responseFromTransformEvent.data;
        let nAdded = 0;
        let eventsAdded = [];
        let eventsRejected = [];
        let errors = [];

        for (const event of transformedEvents) {
          try {
            logObject("event", event);
            const addedEvents = await EventModel(tenant).updateOne(
              event.filter,
              event.update,
              event.options
            );
            if (addedEvents) {
              nAdded += 1;
              eventsAdded.push(event);
            } else if (!addedEvents) {
              let errMsg = {
                msg: "unable to add the events",
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
                msg: "unable to add the events",
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
            logObject("the detailed duplicate error", e);
            eventsRejected.push(event);
            let errMsg = {
              msg: "duplicate record",
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

        if (errors.length > 0) {
          return {
            success: true,
            status: HTTPStatus.CONFLICT,
            message: "finished the operation with some conflicts",
            errors: errors,
          };
        } else {
          return {
            success: true,
            status: HTTPStatus.OK,
            message: "successfully added all the events",
          };
        }
      }
      if (responseFromTransformEvent.success === "false") {
        return {
          success: false,
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
          message: "Internal Server Error",
          errors: { message: "Internal Server Error" },
        };
      }
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  transmitValues: async (req, res) => {
    try {
      const { type, tenant } = req.query;
      if (type == "one" && tenant) {
        return await createEvent.transmitOneSensorValue(req, res);
      } else if (type == "many" && tenant) {
        return await createEvent.transmitMultipleSensorValues(req, res);
      } else if (type == "bulk" && tenant) {
        return await createEvent.bulkTransmitMultipleSensorValues(
          req,
          res,
          tenant
        );
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          status: HTTPStatus.BAD_REQUEST,
          message: "misssing request parameters, please check documentation",
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  transmitOneSensorValue: async (req, res) => {
    try {
      const { quantity_kind, value } = req.body;
      const { tenant, name, chid, device_number, device } = req.query;

      let request = {};
      request["query"] = {};
      request["query"]["name"] = device;
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = chid;
      request["query"]["device_number"] = device_number;

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

      const api_key = deviceDetail.writeKey;

      if (tenant && quantity_kind && value) {
        await axios
          .get(
            constants.ADD_VALUE(
              createEvent.getTSField(quantity_kind),
              value,
              api_key
            )
          )
          .then(function(response) {
            let resp = {};
            resp.channel_id = response.data.channel_id;
            resp.created_at = response.data.created_at;
            resp.entry_id = response.data.entry_id;
            return {
              message: "successfully transmitted the data",
              success: true,
              data: resp,
            };
          })
          .catch(function(error) {
            return {
              success: false,
              errors: { message: error.response.data },
            };
          });
      } else {
        return {
          success: false,
          status: HTTPStatus.BAD_REQUEST,
          message: "misssing request parameters, please check documentation",
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },
  createRequestBody: (req) => {
    let {
      api_key,
      created_at,
      pm2_5,
      pm10,
      s2_pm2_5,
      s2_pm10,
      latitude,
      longitude,
      battery,
      other_data,
      status,
    } = req.body;

    let requestBody = {
      api_key: api_key,
      created_at: created_at,
      field1: pm2_5,
      field2: pm10,
      field3: s2_pm2_5,
      field4: s2_pm10,
      field5: latitude,
      field6: longitude,
      field7: battery,
      field8: other_data,
      latitude: latitude,
      longitude: longitude,
      status: status,
    };
    return requestBody;
  },
  getTSField: (measurement, res) => {
    let requestBody = {
      api_key: "api_key",
      created_at: "created_at",
      pm2_5: "field1",
      pm10: "field2",
      s2_pm2_5: "field3",
      s2_pm10: "field4",
      latitude: "field5",
      longitude: " field6",
      battery: "field7",
      other_data: "field8",
      latitude: "latitude",
      longitude: " longitude",
    };

    if (requestBody.hasOwnProperty(measurement)) {
      return requestBody[measurement];
    } else {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: `the provided quantity kind (${measurement}) does not exist for this organization`,
      });
    }
  },
  transmitMultipleSensorValues: async (req, res) => {
    try {
      logText("write to thing json.......");
      let { tenant, chid, name, device_number } = req.query;
      logElement("the tenant", tenant);
      const requestBody = createEvent.createRequestBody(req);

      let request = {};
      request["query"] = {};
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = chid;
      request["query"]["device_number"] = device_number;

      const responseFromListDevice = await createDeviceUtil.list(request);

      let deviceDetail = {};

      if (responseFromListDevice.success === true) {
        if (responseFromListDevice.data.length === 1) {
          deviceDetail = responseFromListDevice.data[0];
        }
      } else if (responseFromListDevice.success === false) {
        const status = responseFromListDevice.status
          ? responseFromListDevice.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromListDevice.errors
          ? responseFromListDevice.errors
          : "";
        logObject(
          "responseFromListDevice has an error",
          responseFromListDevice
        );
        return res.status(status).json({
          success: false,
          message: responseFromListDevice.message,
          errors,
        });
      }

      logObject("the device details", deviceDetail);
      const api_key = deviceDetail.writeKey;
      requestBody.api_key = api_key;
      logObject("the requestBody", requestBody);
      logElement("the writeKey", api_key);

      if (tenant) {
        await axios
          .post(constants.ADD_VALUE_JSON, requestBody)
          .then(function(response) {
            let resp = {};
            resp.channel_id = response.data.channel_id;
            resp.created_at = response.data.created_at;
            resp.entry_id = response.data.entry_id;
            res.status(HTTPStatus.OK).json({
              message: "successfully transmitted the data",
              success: true,
              update: resp,
            });
          })
          .catch(function(error) {
            logElement("the error", error.message);
            errors.axiosError(error, req, res);
          });
      } else {
        errors.missingQueryParams(req, res);
      }
    } catch (e) {
      errors.tryCatchErrors(res, e);
    }
  },

  bulkTransmitMultipleSensorValues: async (req, res) => {
    try {
      logText("bulk write to thing.......");
      let { tenant, type, name, chid, device_number } = req.query;
      let { updates } = req.body;
      let request = {};
      request["query"] = {};
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = chid;
      request["query"]["device_number"] = device_number;

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

      const channel = deviceDetail.channelID;
      const api_key = deviceDetail.writeKey;
      if (updates && tenant && type) {
        let transformedUpdates = await createEvent.transformMeasurementFields(
          updates
        );
        let requestObject = {};
        requestObject.write_api_key = api_key;
        requestObject.updates = transformedUpdates;
        await axios
          .post(constants.BULK_ADD_VALUES_JSON(channel), requestObject)
          .then(function(response) {
            console.log(response.data);
            let output = response.data;
            res.status(HTTPStatus.OK).json({
              message: "successfully transmitted the data",
              success: true,
              data: output,
            });
          })
          .catch(function(error) {
            errors.axiosError(error, req, res);
          });
      } else {
        errors.missingQueryParams(req, res);
      }
    } catch (e) {
      errors.tryCatchErrors(res, e);
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
      logObject("transformedEvent in constants", transformedEvent);
      let responseFromEnrichOneEvent = await createEvent.enrichOneEvent(
        transformedEvent
      );
      if (responseFromEnrichOneEvent.success === true) {
        result = responseFromEnrichOneEvent.data;
        result["update"]["is_device_primary"] = result["is_device_primary"];
        dot.delete("is_device_primary", result);
      }

      if (responseFromEnrichOneEvent.success === false) {
        logObject("responseFromEnrichOneEvent", responseFromEnrichOneEvent);
        return {
          success: false,
          message: "unable to enrich event",
          errors: { message: responseFromEnrichOneEvent.message },
        };
      }
      logObject("the event", result);
      if (!isEmpty(result)) {
        dot.object(result);
        let cleanedResult = cleanDeep(result);
        logObject("cleanedResult", cleanedResult);
        let filter = cleanedResult.filter;

        modifiedFilter["$or"] = [
          { "values.time": { $ne: filter["values.time"] } },
          { "values.device": { $ne: filter.device } },
          { "values.frequency": { $ne: filter["values.frequency"] } },
          { "values.device_id": { $ne: filter.device_id } },
          { "values.site_id": { $ne: filter.site_id } },
          { day: { $ne: filter.day } },
        ];
        modifiedFilter["day"] = filter.day;
        modifiedFilter["nValues"] = filter.nValues;
        modifiedFilter["device_id"] = filter.device_id;
        modifiedFilter["site_id"] = filter.site_id;

        cleanedResult["modifiedFilter"] = modifiedFilter;

        return {
          success: true,
          message: "successfully transformed the json request",
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
        error: error.message,
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

      logger.info(
        `the request being sent to list device details -- ${JSON.stringify(
          request
        )}`
      );

      const responseFromGetDeviceDetails = await createDeviceUtil.list(request);
      logger.info(
        `responseFromGetDeviceDetails ${JSON.stringify(
          responseFromGetDeviceDetails
        )}`
      );
      if (responseFromGetDeviceDetails.success === true) {
        logger.info(
          `responseFromGetDeviceDetails ${responseFromGetDeviceDetails}`
        );
        let deviceDetails = responseFromGetDeviceDetails.data[0];
        logger.info(
          `the retrieved device details -- ${JSON.stringify(deviceDetails)}`
        );
        enrichedEvent["is_test_data"] = deviceDetails.isActive
          ? !deviceDetails.isActive
          : false;
        enrichedEvent["is_device_primary"] = deviceDetails.isPrimaryInLocation
          ? deviceDetails.isPrimaryInLocation
          : true;
        logger.info(`enriched event -- ${JSON.stringify(enrichedEvent)}`);
        return {
          success: true,
          message: "successfully enriched",
          data: enrichedEvent,
        };
      }
      if (responseFromGetDeviceDetails.success === false) {
        let errors = responseFromGetDeviceDetails.errors
          ? responseFromGetDeviceDetails.errors
          : "";
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
        error: error.message,
      };
    }
  },
  transformManyEvents: async (request) => {
    try {
      /**
       * transform the events util just adds the day
       * insert event util just creates the event body and options
       * ..........field for the update procedure.
       */
      let { tenant } = request.query;
      logger.info(`the tenant being sent for transformation -- ${tenant}`);
      let { body } = request;
      logger.info(
        `the body received for transformation -- ${JSON.stringify(body)}`
      );
      logger.info(`the tenant received for transformation -- ${tenant}`);
      let promises = body.map(async (event) => {
        let data = event;
        data["tenant"] = tenant;
        let map = constants.EVENT_MAPPINGS;
        let context = event;
        context["tenant"] = tenant;
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
        }

        if (responseFromTransformEvent.success === false) {
          let errors = responseFromTransformEvent.errors
            ? responseFromTransformEvent.errors
            : "";
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
        if (results.every((res) => res.success)) {
          logger.info(`success tranformEvents -- ${JSON.stringify(results)}`);
          for (const result of results) {
            transforms.push(result.data);
          }
          return {
            success: true,
            data: transforms,
            message: "successful transformations",
          };
        }

        if (results.every((res) => !res.success)) {
          for (const result of results) {
            let error = result.errors ? result.errors : "";
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
        errors: error.message,
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
      logObject("responseFromTransformEvents", responseFromTransformEvents);
      logger.info(
        `responseFromTransformEvents -- ${JSON.stringify(
          responseFromTransformEvents
        )}`
      );
      if (responseFromTransformEvents.success === false) {
        logElement("responseFromTransformEvents was false?", true);
        let errors = responseFromTransformEvents.errors
          ? responseFromTransformEvents.errors
          : "";
        return {
          success: false,
          message: responseFromTransformEvents.message,
          errors,
        };
      }

      if (responseFromTransformEvents.success === true) {
        let transformedMeasurements = responseFromTransformEvents.data;
        let responseFromInsertEvents = await createEvent.insertTransformedEvents(
          tenant,
          transformedMeasurements
        );

        logObject("responseFromInsertEvents", responseFromInsertEvents);

        if (responseFromInsertEvents.success) {
          return {
            success: true,
            message: responseFromInsertEvents.message,
            data: responseFromInsertEvents.data,
          };
        }

        if (!responseFromInsertEvents.success) {
          let error = responseFromInsertEvents.error
            ? responseFromInsertEvents.error
            : "";
          return {
            success: false,
            message: responseFromInsertEvents.message,
            error,
          };
        }
      }
    } catch (error) {
      logger.error(`the server side error -- addEvents -- ${error.message}`);
      return {
        success: false,
        message: "server side error",
        errors: error.message,
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
      logObject("the transformed events received", events);
      for (const event of events) {
        logObject("the event in events", event);
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
          logObject("the value", value);

          update["$push"] = { values: value };
          logger.info(`the update -- ${JSON.stringify(update)}`);

          logger.info(`the options -- ${JSON.stringify(options)}`);

          const addedEvents = await EventModel(tenant).updateOne(
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
          logObject;
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
          error: errors,
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
        error: error.message,
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
    }

    if (responseFromFilter.success === false) {
      let error = responseFromFilter.error ? responseFromFilter.error : "";
      return {
        success: false,
        message: responseFromFilter.message,
        error,
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
      let error = responseFromListEvents.error
        ? responseFromListEvents.error
        : "";
      return {
        success: false,
        message: responseFromListEvents.message,
        error,
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
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success == true) {
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        return {
          success: false,
          message: responseFromFilter.message,
          error,
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
          : "";

        return {
          success: false,
          message: responseFromClearEvents.message,
          error: responseFromClearEvents.error,
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
        // logObject("the measurement in the insertion process", measurement);
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

        const eventsUpdate = {
          $push: { values: measurement },
          $min: { first: measurement.time },
          $max: { last: measurement.time },
          $inc: { nValues: 1 },
        };

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
        logObject("the detailed duplicate error", e);
        logger.error(`internal server serror ${e.message}`);
        eventsRejected.push(measurement);
        let errMsg = {
          msg: "duplicate record",
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
      };
    } else {
      return {
        success: true,
        message: "successfully added all the events",
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
        console.log("the error: ", e.message);
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
          console.log("the error: ", e.message);
          return {
            success: false,
            message: "server side error",
            error: e.message,
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
        error: error.message,
      };
    }
  },
  transformField: (field) => {
    try {
      switch (field) {
        case "pm2_5":
          return "field1";
        case "pm10":
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
      console.log(e.message);
    }
  },
  transformMeasurementFields: async (measurements) => {
    try {
      logObject("the measurements", measurements);
      let transform = [];
      measurements.forEach((field, value) => {
        transform[transformField(field)] = value;
      });
      return transform;
    } catch (e) {
      console.log(e.message);
    }
  },

  deleteValuesOnThingspeak: async (req, res) => {
    try {
      const { device, tenant, chid, name, device_number } = req.query;

      let request = {};
      request["query"] = {};
      request["query"]["name"] = device;
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;
      request["query"]["device_number"] = chid;
      request["query"]["device_number"] = device_number;

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
        const channelID = await getChannelID(
          req,
          res,
          device,
          tenant.toLowerCase()
        );
        logText("...................................");
        logText("clearing the Thing....");
        logElement("url", constants.CLEAR_THING_URL(channelID));
        await axios
          .delete(constants.CLEAR_THING_URL(channelID))
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
