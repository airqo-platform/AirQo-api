const EventSchema = require("../models/Event");
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

const createEvent = {
  transformEvents: async (measurements) => {
    let promises = measurements.map(async (measurement) => {
      try {
        let time = measurement.time;
        const day = generateDateFormatWithoutHrs(time);
        return {
          day: day,
          ...measurement,
          success: true,
        };
      } catch (e) {
        logger.error(`transformEvents -- ${e.message}`);
        let device = measurement.device;
        return {
          device,
          success: false,
          message: e.message,
        };
      }
    });
    return Promise.all(promises).then((results) => {
      if (results.every((res) => res.success)) {
        return {
          success: true,
          data: results,
          message: "successfully transformed all",
        };
      } else {
        logger.error(`the results for no success -- ${results}`);
      }
    });
  },
  addEvents: async (request) => {
    try {
      logger.info(`adding events in the util.....`);
      let { tenant } = request.query;
      let { body } = request;
      let responseFromTransformEvents = await createEvent.transformEvents(body);
      logger.info(
        `responseFromTransformEvents -- ${JSON.stringify(
          responseFromTransformEvents
        )}`
      );
      if (!responseFromTransformEvents.success) {
        let error = responseFromTransformEvents.error
          ? responseFromTransformEvents.error
          : "";
        return {
          success: false,
          message: responseFromTransformEvents.message,
          error,
        };
      }
      let transformedMeasurements = responseFromTransformEvents.data;
      let nAdded = 0;
      let eventsAdded = [];
      let eventsRejected = [];
      let errors = [];

      for (const measurement of transformedMeasurements) {
        try {
          logger.info(`the measurement -- ${JSON.stringify(measurement)}`);
          const event = {
            day: measurement.day,
            nValues: { $lt: constants.N_VALUES },
            $or: [
              { "values.time": { $ne: measurement.time } },
              { "values.device": { $ne: measurement.device } },
              { "values.frequency": { $ne: measurement.frequency } },
              { "values.device_id": { $ne: measurement.device_id } },
              { "values.site_id": { $ne: measurement.site_id } },
              { day: { $ne: measurement.day } },
            ],
          };
          const options = {
            $addToSet: { values: measurement },
            $min: { first: measurement.time },
            $max: { last: measurement.time },
            $inc: { nValues: 1 },
          };
          const addedEvents = await getModelByTenant(
            tenant.toLowerCase(),
            "event",
            EventSchema
          ).updateOne(event, options, {
            upsert: true,
          });
          if (addedEvents) {
            nAdded += 1;
            eventsAdded.push(measurement);
          } else if (!addedEvents) {
            eventsRejected.push(measurement);
            errors.push("unable to add the events ");
          } else {
            eventsRejected.push(measurement);
            errors.push("unable to add the events ");
          }
        } catch (e) {
          eventsRejected.push(measurement);
          errors.push(e.message);
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          message: "finished the operation with some errors",
          errors: errors,
          rejectedCount: `${eventsRejected.length}`,
          addedCount: `${eventsAdded.length}`,
          valuesRejected: eventsRejected,
          valuesAdded: eventsAdded,
        };
      } else {
        return {
          success: true,
          message: "successfully added all the events",
          valuesAdded: eventsAdded,
          addedCount: `${eventsAdded.length}`,
        };
      }
    } catch (error) {
      logger.error(`the server side error -- ${error.message}`);
      return {
        success: false,
        message: "server side error",
        errors: error.message,
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
                measurements: events,
              })
            );
            redis.expire(cacheID, constants.EVENTS_CACHE_LIMIT);
            return res.status(HTTPStatus.OK).json({
              success: true,
              isCache: false,
              message: `successfully listed the Events`,
              measurements: events,
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
