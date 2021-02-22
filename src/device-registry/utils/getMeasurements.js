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
const { generateFilter } = require("./generateFilter");

const { generateDateFormat, generateDateFormatWithoutHrs } = require("./date");

const getMeasurements = async (res, startTime, endTime, device, tenant) => {
  try {
    const currentTime = new Date().toISOString();
    logElement("currentTime ", currentTime);
    const day = await generateDateFormat(currentTime);
    const dayWithoutHours = await generateDateFormatWithoutHrs(currentTime);
    logElement("startTime ", startTime);
    logElement("endTime ", endTime);
    logElement("device ", device);
    logElement("tenant ", tenant);

    let cacheID = `get_events_device_${device}_${day}_${
      startTime ? startTime : "noStartTime"
    }_${endTime ? endTime : "noEndTime"}_${tenant}`;

    logElement("cacheID", cacheID);

    redis.get(cacheID, async (err, result) => {
      try {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(HTTPStatus.OK).json(resultJSON);
        } else if (err) {
          callbackErrors(err, req, res);
        } else {
          let queryEndTime = isEmpty(endTime) ? "" : endTime;
          let queryStartTime = isEmpty(startTime) ? "" : startTime;
          const filter = generateFilter(queryStartTime, queryEndTime);
          let events = await getModelByTenant(tenant, "event", EventSchema)
            .find(filter)
            .exec();
          redis.set(
            cacheID,
            JSON.stringify({
              isCache: true,
              success: true,
              message: `successfully listed the Events for the device ${device}`,
              measurements: events,
            })
          );
          redis.expire(cacheID, 86400);
          return res.status(HTTPStatus.OK).json({
            success: true,
            isCache: false,
            message: `successfully listed the Events for the device ${device}`,
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
