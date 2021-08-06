const EventSchema = require("../models/Event");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const { getModelByTenant } = require("./multitenancy");
const redis = require("../config/redis");
const constants = require("../config/constants");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

const { logObject, logElement, logText } = require("./log");
const generateFilter = require("./generate-filter");

const { generateDateFormat, generateDateFormatWithoutHrs } = require("./date");

const getDetail = require("../utils/get-device-details");

const isRecentTrue = (recent) => {
  let isRecentEmpty = isEmpty(recent);
  if (isRecentEmpty == true) {
    return true;
  }
  if (recent.toLowerCase() == "yes" && isRecentEmpty == false) {
    return true;
  } else if (recent.toLowerCase() == "no" && isRecentEmpty == false) {
    return false;
  }
};

const getDevicesCount = async (tenant) => {
  let deviceDetail = await getDetail(tenant);
  logElement("number of devices", deviceDetail.length);
  return deviceDetail.length;
};

const generateCacheID = (
  device,
  device_id,
  site,
  site_id,
  day,
  tenant,
  skip,
  limit,
  frequency,
  recent,
  startTime,
  endTime
) => {
  return `get_events_device_${device ? device : "noDevice"}_${tenant}_${
    skip ? skip : 0
  }_${limit ? limit : 0}_${recent ? recent : "noRecent"}_${
    frequency ? frequency : "noFrequency"
  }_${endTime ? endTime : "noEndTime"}_${
    startTime ? startTime : "noStartTime"
  }_${device_id ? device_id : "noDeviceId"}_${site ? site : "noSite"}_${
    site_id ? site_id : "noSiteId"
  }_${day ? day : "noDay"}`;
};

const getEvents = async (tenant, recentFlag, skipInt, limitInt, filter) => {
  let allEvents = await getModelByTenant(tenant, "event", EventSchema).list({
    skipInt,
    limitInt,
    filter,
  });

  let recentEvents = await getModelByTenant(
    tenant,
    "event",
    EventSchema
  ).listRecent({ skipInt, limitInt, filter });

  let events = recentFlag ? recentEvents : allEvents;

  return events;
};

const getMeasurements = async (
  res,
  recent,
  device,
  device_id,
  site,
  site_id,
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
      device_id,
      site,
      site_id,
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
            device_id,
            site,
            site_id,
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
};

module.exports = {
  getMeasurements,
};
