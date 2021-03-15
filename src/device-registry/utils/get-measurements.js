const EventSchema = require("models/Event");
const HTTPStatus = require("http-status");
const { getModelByTenant } = require("utils/multitenancy");
const isEmpty = require("is-empty");
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
    // logElement("startTime ", startTime);
    // logElement("endTime ", endTime);
    // logElement("device ", device);
    // logElement("tenant ", tenant);

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
          logObject("filter", filter);
          logElement("skip ", skip);
          logElement("limit ", limit);

          let events = await getModelByTenant(tenant, "event", EventSchema)
            .list(skip, limit, filter)
            .exec();
          redis.set(
            cacheID,
            JSON.stringify({
              isCache: true,
              success: true,
              message: `successfully listed the Events`,
              measurements: events,
            })
          );
          redis.expire(cacheID, 0);
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
