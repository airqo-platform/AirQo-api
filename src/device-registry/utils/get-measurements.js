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
  startTime,
  endTime,
  device,
  skip,
  limit,
  tenant
) => {
  try {
    const currentTime = new Date().toISOString();
    logElement("currentTime ", currentTime);
    const day = generateDateFormatWithoutHrs(currentTime);
    let cacheID = `get_events_device_${device ? device : "noDevice"}_${day}_${
      startTime ? startTime : "noStartTime"
    }_${endTime ? endTime : "noEndTime"}_${tenant}_${skip ? skip : 0}_${
      limit ? limit : 0
    }`;

    logElement("cacheID", cacheID);

    redis.get(cacheID, async (err, result) => {
      try {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(HTTPStatus.OK).json(resultJSON);
        } else if (err) {
          callbackErrors(err, req, res);
        } else {
          const filter = generateEventsFilter(startTime, endTime, device);
          let skipInt = skip ? 0 : skip;
          let limitInt = limit ? 50 : limit;
          let events = await getModelByTenant(
            tenant,
            "event",
            EventSchema
          ).list({ skipInt, limitInt, filter });
          redis.set(
            cacheID,
            JSON.stringify({
              isCache: true,
              success: true,
              message: `successfully listed the Events`,
              measurements: events,
            })
          );
          redis.expire(cacheID, 60);
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
