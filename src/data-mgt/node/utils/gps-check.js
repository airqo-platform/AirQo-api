const redis = require("../config/redis");
const Channel = require("../models/Channel");
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

async function gpsCheck(data, req, res) {
  try {
    let ts = Date.now();
    let day = await generateDateFormat(ts);
    let cacheID = `gpsCheck_${day}`;
    // console.log("the cache value: ", cacheID);

    // console.log("the data: ", data);
    // console.log("the field6: ", data.field6);
    // console.log("the field5: ", data.field5);

    let field5 = data.field5;
    let field6 = data.field6;

    if (field5 == 0.0 && field6 == 0.0) {
      let gpsCods = handleInaccurate(cacheID, req, res);
      // console.log("the gpsCods for Innacurate: ", typeof gpsCods);
      console.dir(gpsCods);
      return gpsCods;
    } else if (field5 == 1000.0 && field6 == 1000.0) {
      let gpsCods = handleInaccurate(cacheID, req, res);
      // console.log("the gpsCods for Innacurate: ", gpsCods);
      return gpsCods;
    } else {
      let gpsCods = handleAccurate(cacheID, data, req, res);
      // console.log("the gpsCods for accurate: ", gpsCods);
      return gpsCods;
    }
  } catch (error) {
    res.status(HTTPStatus.BAD_GATEWAY).send({
      success: false,
      message: `Server Error`,
      error: error.message,
    });
  }
}

/**
 * for cases where the GPS coords are accurate
 */

function handleAccurate(cacheID, data, req, res) {
  try {
    redis.get(cacheID, (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return resultJSON;
      } else {
        let gpsCods = {};
        gpsCods.latitude = data.field5;
        gpsCods.longitude = data.field6;
        redis.set(cacheID, JSON.stringify({ ...gpsCods }));
        return gpsCods;
      }
    });
  } catch (e) {
    tryCatchErrors(e, req, res);
  }
}

/**
 * for cases where the GPS coords are NOT accurate
 */
function handleInaccurate(cacheID, req, res) {
  try {
    console.log("inside the innnacurate function....");
    redis.get(cacheID, (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return resultJSON;
      } else if (err) {
        callbackErrors(err, req, res);
      } else {
        let gpsCods = {};
        gpsCods.latitude = null;
        gpsCods.longitude = null;
        // console.log("the innacurate logs: ", { ...gpsCods });
        return "me";
      }
    });
  } catch (e) {
    tryCatchErrors(e, req, res);
  }
}

function getGPSFromDB(channel, data, req, res) {
  console.log("channel ID from request: ", req.params.ch_id);
  let modifiedResponse = data;
  if (data.field6 == 0.0 || data.field5 == 0.0) {
    if (channel) {
      console.log("the channel details: ", channel._doc);
      console.log("type of channel: ", typeof channel._doc);
      modifiedResponse.field5 = channel._doc.latitude.toString();
      console.log("latitude: ", channel._doc.latitude.toString());
      modifiedResponse.field6 = channel._doc.longitude.toString();
      console.log("longitude: ", channel._doc.longitude.toString());
      return modifiedResponse;
    } else {
      res.status(HTTPStatus.BAD_REQUEST).send({
        success: false,
        message: `Innacurate GPS sensor readings and there are no recorded cordinates to use`,
      });
    }
  } else if (data.field6 == 1000.0 || data.field5 == 1000.0) {
    if (channel) {
      console.log("the channel details: ", channel._doc);
      console.log("type of channel: ", typeof channel._doc);
      modifiedResponse.field5 = channel._doc.latitude.toString();
      console.log("latitude: ", channel._doc.latitude.toString());
      modifiedResponse.field6 = channel._doc.longitude.toString();
      console.log("longitude: ", channel._doc.longitude.toString());
      return modifiedResponse;
    } else {
      res.status(HTTPStatus.BAD_REQUEST).send({
        success: false,
        message: `Innacurate GPS sensor readings and there are no recorded cordinates to use`,
      });
    }
  } else {
    return modifiedResponse;
  }
}

module.exports = { gpsCheck, getGPSFromDB };
