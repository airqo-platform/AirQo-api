const redis = require("../config/redis");
const Channel = require("../models/Channel");
const Device = require("../models/Device");
const HTTPStatus = require("http-status");
const { getFieldLabel } = require("../utils/mappings");
const { generateDateFormat } = require("../utils/date");
constants = require("../config/constants");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

/**
 * for cases where the GPS coords are NOT accurate
 */
async function handleInaccurate(data, req, res) {
  try {
    /**
     * if the GPS coordinates are innacurate, please use the ones in the cache
     */
    let timeStamp = Date.now();
    let day = await generateDateFormat(timeStamp);
    let cacheID = `handle_inaccurate_gps_${day}`;
    console.log("inside the innnacurate function....");
    redis.get(cacheID, (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return resultJSON;
      } else if (err) {
        callbackErrors(err, req, res);
      } else {
        //we can use the ones from device registry
        let location = {};
        location.latitude = data.field5;
        location.longitude = data.field6;
        redis.set(cacheID, JSON.stringify(location));
        return location;
      }
    });
  } catch (e) {
    tryCatchErrors(e, req, res);
  }
}

module.exports = { handleInaccurate };
