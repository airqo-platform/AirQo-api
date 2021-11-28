const eventModel = require("../models/Event");
const { logObject, logElement, logText } = require("./log");
const constants = require("../config/constants");
const generateFilter = require("./generate-filter");
const { utillErrors } = require("./errors");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger("create-event-util");
const { generateDateFormatWithoutHrs } = require("./date");
const { transform } = require("node-json-transform");
const Dot = require("dot-object");
const cleanDeep = require("clean-deep");
const { registerDeviceUtil } = require("./create-device");
const HTTPStatus = require("http-status");
const redis = require("../config/redis");
const { findLastIndex } = require("underscore");

const createEvent = {
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
  list: async (request, callback) => {
    try {
      const { query } = request;
      let { recent, tenant, limit, skip } = query;
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
          let devicesCount = 2000;
          await registerDeviceUtil.getDevicesCount(request, async (result) => {
            if (result.success === true) {
              devicesCount = result.data;
            }
            if (result.success === false) {
              logText(result.message);
            }
            if (recent === "yes") {
              limit = devicesCount;
            }

            const responseFromListEvents = await eventModel(tenant).list({
              skip,
              limit,
              filter,
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
      const { query, body } = request;
      /**
       * transform the events before insertion
       */
      const responseFromRegisterEvent = await eventModel(tenant).createEvent(
        body
      );
      if (responseFromRegisterEvent.success === true) {
      }
      if (responseFromRegisterEvent.success === false) {
      }
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
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
        result["update"]["is_device_primary"] = result["is_device_primary"];
        dot.delete("is_device_primary", result);
      }

      if (responseFromEnrichOneEvent.success === false) {
        return {
          success: false,
          message: "unable to enrich event",
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
          { device: { $ne: filter.device } },
          { "values.frequency": { $ne: filter["values.frequency"] } },
          { device_id: { $ne: filter.device_id } },
          { site_id: { $ne: filter.site_id } },
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

      const responseFromGetDeviceDetails = await registerDeviceUtil.list(
        request
      );
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
        let error = responseFromGetDeviceDetails.error
          ? responseFromGetDeviceDetails.error
          : "";
        logger.error(
          `responseFromGetDeviceDetails was not a success -- ${responseFromGetDeviceDetails.message} -- ${error}`
        );
        return {
          success: false,
          message: responseFromGetDeviceDetails.message,
          error,
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
          let error = responseFromTransformEvent.error
            ? responseFromTransformEvent.error
            : "";
          logger.error(
            `responseFromTransformEvent is not a success -- unable to transform -- ${error}`
          );
          return {
            success: false,
            error,
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
            let error = result.error ? result.error : "";
            errors.push(error);
          }
          logger.error(
            `unsuccessful tranformEvents -- ${JSON.stringify(errors)}}`
          );
          return {
            success: false,
            error: errors,
            message: "failed transformations",
          };
        }
      });
    } catch (error) {
      logger.error(`transformEvents -- ${error.message}`);
      return {
        success: false,
        message: "server side error - transformEvents ",
        error: e.message,
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
        let error = responseFromTransformEvents.error
          ? responseFromTransformEvents.error
          : "";
        return {
          success: false,
          message: responseFromTransformEvents.message,
          error,
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

          const addedEvents = await eventModel(tenant).updateOne(
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
    let responseFromListEvents = await eventModel(tenant).view({
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
  getValues: (req, res) => {
    try {
      const {
        device,
        tenant,
        limit,
        skip,
        key,
        recent,
        frequency,
        startTime,
        endTime,
      } = req.query;
      if (Array.isArray(req.query.device)) {
        return badRequest(
          res,
          "multiple Device query params not supported, please use one comma separated one",
          []
        );
      }
      const limitInt = parseInt(limit, 0);
      const skipInt = parseInt(skip, 0);
      logText(".......getting values.......");
      if (tenant) {
        getMeasurements(
          res,
          recent,
          device,
          skipInt,
          limitInt,
          frequency,
          tenant,
          startTime,
          endTime
        );
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
  getMeasurements: async (
    res,
    recent,
    device,
    skip,
    limit,
    frequency,
    tenant,
    startTime,
    endTime
  ) => {
    try {
      const currentTime = new Date().toISOString();
      const day = generateDateFormatWithoutHrs(currentTime);
      let cacheID = generateCacheID(
        device,
        day,
        tenant,
        skip,
        limit,
        frequency,
        recent,
        startTime,
        endTime
      );

      redis.get(cacheID, async (err, result) => {
        try {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(HTTPStatus.OK).json(resultJSON);
          } else if (err) {
            callbackErrors(err, req, res);
          } else {
            const filter = generateFilter.events(
              device,
              frequency,
              startTime,
              endTime
            );

            let request = {};
            request["query"] = {};
            request["query"]["tenant"] = tenant;
            let devicesCount = 1000;
            await registerDeviceUtil.getDevicesCount(request, (result) => {
              if (result.success === true) {
                devicesCount = result.data;
              }
              if (result.success === false) {
                logText(result.message);
              }
            });

            let _skip = skip ? skip : 0;
            let _limit = limit
              ? limit
              : parseInt(constants.DEFAULT_EVENTS_LIMIT);
            let options = {
              skipInt: _skip,
              limitInt: _limit,
            };

            if (!device) {
              options["skipInt"] = 0;
              options["limitInt"] = devicesCount;
            }

            let recentFlag = isRecentTrue(recent);

            let events = await getEvents(
              tenant,
              recentFlag,
              options.skipInt,
              options.limitInt,
              filter
            );

            redis.set(
              cacheID,
              JSON.stringify({
                isCache: true,
                success: true,
                message: `successfully listed the Events`,
                events: events,
              })
            );
            redis.expire(cacheID, parseInt(constants.EVENTS_CACHE_LIMIT));
            return res.status(HTTPStatus.OK).json({
              success: true,
              isCache: false,
              message: `successfully listed the Events`,
              events: events,
            });
          }
        } catch (e) {
          tryCatchErrors(res, e);
        }
      });
    } catch (e) {
      tryCatchErrors(res, e);
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
      utillErrors.tryCatchErrors("clearEventsOnPlatform util", e.message);
    }
  },
};

module.exports = createEvent;
