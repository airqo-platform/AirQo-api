const eventSchema = require("../models/Event");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const constants = require("../config/constants");
const generateFilter = require("./generate-filter");
const { utillErrors } = require("./errors");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger("create-event-util");
const { generateDateFormatWithoutHrs } = require("./date");
const jsonify = require("../utils/jsonify");
const { transform } = require("node-json-transform");
const dot = require("dot-object");
const cleanDeep = require("clean-deep");

const createEvent = {
  transformOneEvent: ({ data = {}, map = {}, context = {} } = {}) => {
    try {
      let modifiedFilter = {};
      const result = transform(data, map, context);
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
  transformManyEvents: async (events) => {
    try {
      let promises = events.map(async (event) => {
        let data = event;
        let map = constants.EVENT_MAPPINGS;
        let context = event;
        let responseFromTransformEvent = createEvent.transformOneEvent({
          data,
          map,
          context,
        });
        logger.info(
          `responseFromTransformEvent -- ${responseFromTransformEvent}`
        );
        if (responseFromTransformEvent.success) {
          logger.info(`responseFromTransformEvent is a success`);
          return {
            success: true,
            data: responseFromTransformEvent.data,
            message: responseFromTransformEvent.message,
          };
        }

        if (!responseFromTransformEvent.success) {
          let error = responseFromTransformEvent.error
            ? responseFromTransformEvent.error
            : "";
          logger.error(
            `responseFromTransformEvent is not a success -- ${error}`
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
          logger.info(`success tranformEvents -- ${results}`);
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
          logger.error(`unsuccessful tranformEvents -- ${results}`);
          for (const result of results) {
            let error = result.error ? result.error : "";
            errors.push(error);
          }
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
        body
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

          dot.delete(["filter", "update", "options"], value);
          logger.info(`the values -- ${JSON.stringify(value)}`);

          update["$push"] = { values: value };
          logger.info(`the update -- ${JSON.stringify(update)}`);

          logger.info(`the options -- ${JSON.stringify(options)}`);

          const addedEvents = await getModelByTenant(
            tenant.toLowerCase(),
            "event",
            eventSchema
          ).updateOne(modifiedFilter, update, options);

          logger.info(`addedEvents -- ${JSON.stringify(addedEvents)}`);

          dot.delete("nValues", filter);
          if (!isEmpty(addedEvents)) {
            logger.info(`successfuly added the event`);
            let insertion = {
              msg: "successfuly added the event",
              event_details: filter,
            };
            data.push(insertion);
          }

          if (isEmpty(addedEvents)) {
            let errMsg = {
              msg: "unable to add the event",
              event_details: filter,
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
  getEvents: async (request) => {
    let { tenant } = request.query;

    let responseFromFilter = generateFilter.events(request);
    let filter = {};
    if (responseFromFilter.success) {
      filter = responseFromFilter.data;
    }

    if (!responseFromFilter.success) {
      let error = responseFromFilter.error ? responseFromFilter.error : "";
      return {
        success: false,
        message: responseFromFilter.message,
        error,
      };
    }

    let responseFromListEvents = {};
    if (responseFromListEvents.success) {
      return {
        success: true,
        message: responseFromListEvents.message,
        data: responseFromListEvents.data,
      };
    }

    if (!responseFromListEvents.success) {
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

            let devicesCount = await getDevicesCount(tenant);

            let _skip = skip ? skip : 0;
            let _limit = limit ? limit : constants.DEFAULT_EVENTS_LIMIT;
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
            redis.expire(cacheID, constants.EVENTS_CACHE_LIMIT);
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
