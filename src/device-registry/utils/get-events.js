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

const { generateDateFormat } = require("./date");

const responseDevice = async (res, filter, tenant) => {
  try {
    let ts = Date.now();
    let day = await generateDateFormat(ts);
    let cacheID = `get_events_device_${filter.deviceName}_${day}`;
    logElement("cacheID", cacheID);

    redis.get(cacheID, async (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return res.status(HTTPStatus.OK).json(resultJSON);
      } else if (err) {
        callbackErrors(err, req, res);
      } else {
        const events = await getModelByTenant(tenant, "event", EventSchema)
          .find(filter)
          .limit(100)
          .lean()
          .exec();
        if (!isEmpty(events)) {
          redis.set(
            cacheID,
            JSON.stringify({
              isCache: true,
              success: true,
              message: `successfully listed the Events for the device ${filter.deviceName}`,
              events,
            })
          );
          redis.expire(cacheID, 86400);
          return res.status(HTTPStatus.OK).json({
            success: true,
            isCache: false,
            message: `successfully listed the Events for the device ${filter.deviceName}`,
            events,
          });
        } else if (isEmpty(events)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find the Events for device ${device}`,
          });
        }
      }
    });
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

const responseComponent = async (res, filter, tenant) => {
  try {
    let ts = Date.now();
    let day = await generateDateFormat(ts);
    let cacheID = `get_events_component_${filter.componentName}_${day}`;
    logElement("cacheID", cacheID);

    redis.get(cacheID, async (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return res.status(HTTPStatus.OK).json(resultJSON);
      } else if (err) {
        callbackErrors(err, req, res);
      } else {
        const events = await getModelByTenant(tenant, "event", EventSchema)
          .find(filter)
          .limit(100)
          .lean()
          .exec();
        if (!isEmpty(events)) {
          redis.set(
            cacheID,
            JSON.stringify({
              isCache: true,
              success: true,
              message: `successfully listed the Events for the component ${filter.componentName}`,
              events,
            })
          );
          redis.expire(cacheID, 86400);
          return res.status(HTTPStatus.OK).json({
            success: true,
            isCache: false,
            message: `successfully listed the Events for the component ${filter.componentName}`,
            events,
          });
        } else if (isEmpty(events)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find the Events for the component ${filter.componentName}`,
          });
        }
      }
    });
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

const responseDeviceAndComponent = async (res, filter, tenant) => {
  try {
    let ts = Date.now();
    let day = await generateDateFormat(ts);
    let cacheID = `get_events_component_and_device_${filter.deviceName}_${filter.componentName}_${day}`;
    logElement("cacheID", cacheID);

    redis.get(cacheID, async (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return res.status(HTTPStatus.OK).json(resultJSON);
      } else if (err) {
        callbackErrors(err, req, res);
      } else {
        const events = await getModelByTenant(tenant, "event", EventSchema)
          .find(filter)
          .limit(100)
          .lean()
          .exec();
        if (!isEmpty(events)) {
          redis.set(
            cacheID,
            JSON.stringify({
              isCache: true,
              success: true,
              message: `successfully listed the Events for this device (${filter.deviceName}) component (${filter.componentName})`,
              events,
            })
          );
          redis.expire(cacheID, 86400);
          return res.status(HTTPStatus.OK).json({
            success: true,
            isCache: false,
            message: `successfully listed the Events for this device (${filter.deviceName}) component (${filter.componentName})`,
            events,
          });
        } else if (isEmpty(events)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find that Component ${filter.componentName} for device ${filter.deviceName}`,
          });
        }
      }
    });
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

const responseAll = async (req, res, tenant) => {
  try {
    let ts = Date.now();
    let day = await generateDateFormat(ts);
    let cacheID = `get_events_all_${day}`;
    logElement("cacheID", cacheID);

    redis.get(cacheID, async (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return res.status(HTTPStatus.OK).json(resultJSON);
      } else if (err) {
        callbackErrors(err, req, res);
      } else {
        // const limit = parseInt(req.query.limit, 0);
        const limit = 100;
        const skip = parseInt(req.query.skip, 0);
        const events = await getModelByTenant(
          tenant,
          "event",
          EventSchema
        ).list({
          limit,
          skip,
        });
        if (!isEmpty(events)) {
          redis.set(
            cacheID,
            JSON.stringify({
              isCache: true,
              success: true,
              tip:
                "use documented query parameters (device/comp) to filter your search results",
              message: "successfully listed all platform Events",
              events,
            })
          );
          redis.expire(cacheID, 86400);
          return res.status(HTTPStatus.OK).json({
            success: true,
            isCache: false,
            message: "successfully listed all platform Events",
            events,
          });
        } else if (isEmpty(events)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find all the platform Events`,
          });
        }
      }
    });
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

const responseDateRanges = () => {};

module.exports = {
  responseAll,
  responseDateRanges,
  responseDevice,
  responseDeviceAndComponent,
  responseComponent,
};
