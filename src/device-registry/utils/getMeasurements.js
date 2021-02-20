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

const getMeasurements = async (res, filter, skip, limit, tenant) => {
  try {
    let ts = Date.now();
    let day = await generateDateFormat(ts);
    let more_params = {
      skip,
      limit,
    };

    let cacheID = `get_events_device_${filter.device}_${day}`;
    logElement("cacheID", cacheID);

    redis.get(cacheID, async (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return res.status(HTTPStatus.OK).json(resultJSON);
      } else if (err) {
        callbackErrors(err, req, res);
      } else {
        console.log("the filter: ", filter);
        const events = await getModelByTenant(tenant, "event", EventSchema)
          .find(filter)
          .exec();
        console.log("the events: ", events[0].values);

        redis.set(
          cacheID,
          JSON.stringify({
            isCache: true,
            success: true,
            message: `successfully listed the Events for the device ${filter.device}`,
            measurements: events[0].values,
          })
        );
        redis.expire(cacheID, 86400);
        let measurements = events[0].values;
        return res.status(HTTPStatus.OK).json({
          success: true,
          isCache: false,
          message: `successfully listed the Events for the device ${filter.device}`,
          measurements: measurements,
        });
      }
    });
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

module.exports = {
  getMeasurements,
};
