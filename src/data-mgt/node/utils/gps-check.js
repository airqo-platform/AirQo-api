const redis = require("../config/redis");
const Channel = require("../models/Channel");
const HTTPStatus = require("http-status");
const { getFieldLabel } = require("../utils/mappings");
const { generateDateFormat } = require("../utils/date");
constants = require("../config/constants");
const Channel = require("../models/Channel");

const gpsCheck = async (data, req, res) => {
  try {
    let ts = Date.now();
    let day = await generateDateFormat(ts);
    let cacheID = `gpsCheck_${day}`;
    console.log("the cache value: ", cacheID);

    if (data.field6 !== (0.0 || 1000.0) || data.field5 !== (0.0 || 1000.0)) {
      handleAccurate(data, req, res);
    } else {
      handleInaccurate(data, req, res, next);
    }
  } catch (error) {
    res.status(HTTPStatus.BAD_GATEWAY).send({
      success: false,
      message: `Server Error`,
      error: error.message,
    });
  }
};

/**
 * for cases where the GPS coords are accurate
 */

const handleAccurate = async (data, req, res) => {
  redis.get(cacheID, async (err, result) => {
    if (result) {
      const resultJSON = JSON.parse(result);
      return res.status(HTTPStatus.OK).json({
        message: "from the cache",
        ...resultJSON,
      });
    } else {
      /**
       * just set up the result using the cache ID and send back response
       */
      let gpsCods = {};
      gpsCods.latitude = data.field5;
      gpdCods.longitude = data.field6;
      redis.set(cacheID, JSON.stringify({ ...gpsCods }));

      return res.status(HTTPStatus.OK).json({
        message: "from the API",
        ...gpsCods,
      });
    }
  });
};

/**
 * for cases where the GPS coords are NOT accurate
 */
const handleInaccurate = (data, req, res) => {
  redis.get(cacheID, async (err, result) => {
    if (result) {
      const resultJSON = JSON.parse(result);
      return res.status(HTTPStatus.OK).json({
        message: "from the cache",
        ...resultJSON,
      });
    } else {
      res.status(HTTPStatus.BAD_REQUEST).send({
        success: false,
        message: `Innacurate GPS sensor readings with NO records to use`,
      });
    }
  });
};

module.exports = { gpsCheck };
