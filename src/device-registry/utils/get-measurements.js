const EventSchema = require("../models/Event");
const HTTPStatus = require("http-status");
const { getModelByTenant } = require("./multitenancy");
const redis = require("../config/redis");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

const { logObject, logElement, logText } = require("./log");
const {
  generateEventsFilter,
  generateDeviceFilter,
} = require("./generate-filter");

const { generateDateFormat, generateDateFormatWithoutHrs } = require("./date");

const getMeasurements = async (
  res,
  recent,
  startTime,
  endTime,
  device,
  skip,
  limit,
  tenant
) => {
  try {
    const currentTime = new Date().toISOString();
    const day = generateDateFormatWithoutHrs(currentTime);
    let cacheID = `get_events_device_${device ? device : "noDevice"}_${day}_${
      startTime ? startTime : "noStartTime"
    }_${endTime ? endTime : "noEndTime"}_${tenant}_${skip ? skip : 0}_${
      limit ? limit : 0
    }_${recent ? recent : "noRecent"}`;

    redis.get(cacheID, async (err, result) => {
      try {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(HTTPStatus.OK).json(resultJSON);
        } else if (err) {
          callbackErrors(err, req, res);
        } else {
          const filter = generateEventsFilter(startTime, endTime, device);
          let skipInt = skip ? skip : 0;
          let limitInt = limit ? limit : 50;

          let allEvents = await getModelByTenant(
            tenant,
            "event",
            EventSchema
          ).list({ skipInt, limitInt, filter });

          let recentEvents = await getModelByTenant(
            tenant,
            "event",
            EventSchema
          ).listRecent({ skipInt, limitInt, filter });

          let events = recent ? recentEvents : allEvents;

          redis.set(
            cacheID,
            JSON.stringify({
              isCache: true,
              success: true,
              message: `successfully listed the Events`,
              measurements: events,
            })
          );
          redis.expire(cacheID, 30);
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
};

module.exports = {
  getMeasurements,
};
