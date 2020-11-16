const HTTPStatus = require("http-status");
const axios = require("axios");
const redis = require("../config/redis");
const isEmpty = require("is-empty");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
  incorrectValue,
} = require("./errors");

const { calibrate } = require("./enrich");

const { gpsCheck, getGPSFromDB } = require("./gps-check");

const { generateDateFormat } = require("./date");
const constants = require("../config/constants");

const {
  getFieldLabel,
  getPositionLabel,
  transformMeasurement,
  trasformFieldValues,
  getFieldByLabel,
  availableMeasurements,
} = require("./mappings");

const { logElement, logText, logObject } = require("./log");

const getLastEntry = async (req, res, frequency) => {
  try {
    const { ch_id } = req.params;

    if (ch_id && frequency) {
      let url = getURL(req, res, frequency, ch_id);

      let cacheID = getCacheID(req, res, frequency, false, ch_id);

      redis.get(cacheID, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(HTTPStatus.OK).json(resultJSON);
        } else {
          logElement("the url", url);
          axios
            .get(url)
            .then(async (response) => {
              let { data } = response;

              let responseData = await retrieveEntryData(
                req,
                res,
                data,
                frequency
              );

              logObject("the response data", responseData);

              let referenceForRefactor =
                "https://docs.google.com/document/d/163T5dZj_FaDHJ_sBAmKamqGN2PSuaZdBEirx-Kz-80Q/edit?usp=sharing";

              redis.set(
                cacheID,
                JSON.stringify({ isCache: true, ...responseData })
              );
              redis.expire(cacheID, 86400);

              return res.status(HTTPStatus.OK).json({
                isCache: false,
                ...responseData,
              });
            })
            .catch((error) => {
              axiosError(error, req, res);
            });
        }
      });
    } else {
      missingQueryParams(req, res);
    }
  } catch (e) {
    tryCatchErrors(e, req, res);
  }
};

const getURL = (req, res, frequency, channelID) => {
  try {
    if (frequency == "hourly") {
      return constants.GENERATE_LAST_HOURLY_ENTRY(channelID);
    } else if (frequency == "raw") {
      return constants.GENERATE_LAST_ENTRY(channelID);
    } else {
      incorrectValue(req, res);
    }
  } catch (e) {
    tryCatchErrors(e, req, res);
  }
};

const getCacheID = (req, res, frequency, transformed, channelID) => {
  try {
    let ts = Date.now();
    let day = generateDateFormat(ts);

    if (transformed) {
      if (frequency == "hourly") {
        logElement("the channel ID", channelID);
        let cacheID = `descriptive_last_entry_hourly_${channelID.trim()}_${day}`;
        return cacheID;
      } else if (frequency == "raw") {
        let cacheID = `descriptive_last_entry_raw_${channelID.trim()}_${day}`;
        return cacheID;
      } else {
        incorrectValue(req, res);
      }
    } else {
      if (frequency == "hourly") {
        let cacheID = `last_entry_hourly_${channelID.trim()}_${day}`;
        return cacheID;
      } else if (frequency == "raw") {
        let cacheID = `last_entry_raw_${channelID.trim()}_${day}`;
        return cacheID;
      } else {
        incorrectValue(req, res);
      }
    }
  } catch (e) {
    tryCatchErrors(e, req, res);
  }
};

const retrieveEntryData = async (req, res, returnedData, frequency) => {
  try {
    if (frequency == "hourly") {
      let feedsArray = returnedData.feeds;

      if (isEmpty(feedsArray)) {
        res.status(HTTPStatus.BAD_GATEWAY).json({
          message: "no recent hourly data",
          success: false,
        });
      } else {
        let lastItem = feedsArray[feedsArray.length - 1];

        return lastItem;
      }
    } else if (frequency == "raw") {
      let lastEntryId = returnedData.channel.last_entry_id;
      let recentReadings = await returnedData.feeds.filter((item) => {
        return item.entry_id === lastEntryId;
      });
      return recentReadings[0];
    } else {
      incorrectValue(req, res);
    }
  } catch (e) {
    tryCatchErrors(e, req, res);
  }
};

const generateDescriptiveLastEntry = async (req, res, frequency) => {
  try {
    const { channel } = req.query;
    if (channel && frequency) {
      let url = getURL(req, res, frequency, channel);
      let cacheID = getCacheID(req, res, frequency, true, channel);
      redis.get(cacheID, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(HTTPStatus.OK).json(resultJSON);
        } else {
          axios
            .get(url)
            .then(async (response) => {
              let { data } = response;

              let responseData = await retrieveEntryData(
                req,
                res,
                data,
                frequency
              );
              //check the GPS values
              let gpsCods = gpsCheck(responseData, req, res);
              // responseData.field5 = gpsCods.latitude;
              // responseData.field6 = gpsCods.longitude;

              delete responseData.entry_id;

              let transformedData = await transform(responseData);

              redis.set(
                cacheID,
                JSON.stringify({ isCache: true, ...transformedData })
              );
              redis.expire(cacheID, 86400);
              return res.status(HTTPStatus.OK).json({
                isCache: false,
                ...transformedData,
              });
            })
            .catch((error) => {
              axiosError(error, req, res);
            });
        }
      });
    } else {
      missingQueryParams(req, res);
    }
  } catch (e) {
    tryCatchErrors(e, req, res);
  }
};

const transform = async (data) => {
  let measurements = availableMeasurements(data);
  let transformedData = await transformMeasurement(measurements);
  let { other_data } = transformedData;

  const { pm2_5, pm10, s2_pm2_5, s2_pm10 } = transformedData;
  logElement("pm2_5", pm2_5);
  let calibratedValue = calibrate(pm2_5);
  logElement("calibratedValue", calibratedValue);
  let newResp = {
    ...transformedData,
    ...{ pm2_5_calibrated: calibratedValue },
  };
  logObject("the retrieved entry data", newResp);

  if (isEmpty(other_data)) {
    return newResp;
  } else {
    let transformedField = await trasformFieldValues(other_data);
    delete transformedData.other_data;
    let newResp = { ...transformedData, ...transformedField };
    return newResp;
  }
};

module.exports = { getLastEntry, generateDescriptiveLastEntry };
