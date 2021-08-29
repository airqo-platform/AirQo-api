const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channel = require("../models/Channel");
const Feed = require("../models/Feed");
const axios = require("axios");
const redis = require("../config/redis");
const MaintenanceLog = require("../models/MaintenanceLogs");
const Issue = require("../models/Issue");
const isEmpty = require("is-empty");
const cleanMeasurements = require("../utils/clean-measurements");
const {
  getFieldLabel,
  getPositionLabel,
  transformMeasurement,
  trasformFieldValues,
  getFieldByLabel,
} = require("../utils/mappings");
const { generateDateFormat } = require("../utils/date");
const constants = require("../config/constants");
const { gpsCheck, getGPSFromDB } = require("../utils/gps-check");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const {
  GET_CHANNELS_CACHE_EXPIRATION,
  GET_LAST_ENTRY_CACHE_EXPIRATION,
  GET_HOURLY_CACHE_EXPIRATION,
  GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION,
  GET_CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION,
  GET_LAST_FIELD_ENTRY_AGE_CACHE_EXPIRATION,
  GET_DEVICE_COUNT_CACHE_EXPIRATION,
} = require("../config/constants");
const { logObject, logElement } = require("../utils/log");

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const data = {
  getChannels: async (req, res) => {
    try {
      let ts = Date.now();
      let day = await generateDateFormat(ts);
      let cacheID = `get_channels_${day}`;

      redis.get(cacheID, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(HTTPStatus.OK).json(resultJSON);
        } else if (err) {
          callbackErrors(err, req, res);
        } else {
          axios
            .get(constants.GET_CHANNELS)
            .then((response) => {
              const responseJSON = response.data;
              redis.set(
                cacheID,
                JSON.stringify({ isCache: true, ...responseJSON })
              );
              redis.expire(cacheID, GET_CHANNELS_CACHE_EXPIRATION);
              return res
                .status(HTTPStatus.OK)
                .json({ isCache: false, ...responseJSON });
            })
            .catch((err) => {
              axiosError({ error, res });
            });
        }
      });
    } catch (e) {
      tryCatchErrors(e, req, res);
    }
  },
  getFeeds: async (req, res) => {
    console.log("getting feeds..............  ");
    const fetch_response = await fetch(constants.GET_FEEDS(req.params.ch_id));
    const json = await fetch_response.json();
    res.status(200).send(json);
  },

  getLastEntry: async (req, res) => {
    try {
      const { ch_id } = req.params;
      if (ch_id) {
        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheID = `last_entry_${ch_id.trim()}_${day}`;
        redis.get(cacheID, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(HTTPStatus.OK).json(resultJSON);
          } else {
            let channel = ch_id;
            axios
              .get(constants.GENERATE_LAST_ENTRY({ channel }))
              .then(async (response) => {
                let readings = response.data;

                let lastEntryId = readings.channel.last_entry_id;
                let recentReadings = await readings.feeds.filter((item) => {
                  return item.entry_id === lastEntryId;
                });
                let responseData = recentReadings[0];

                let referenceForRefactor =
                  "https://docs.google.com/document/d/163T5dZj_FaDHJ_sBAmKamqGN2PSuaZdBEirx-Kz-80Q/edit?usp=sharing";

                redis.set(
                  cacheID,
                  JSON.stringify({ isCache: true, ...responseData })
                );
                redis.expire(cacheID, GET_LAST_ENTRY_CACHE_EXPIRATION);

                return res.status(HTTPStatus.OK).json({
                  isCache: false,
                  ...responseData,
                });
              })
              .catch((error) => {
                axiosError({ error, res });
              });
          }
        });
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(e, req, res);
    }
  },

  hourly: async (req, res) => {
    console.log("getting hourly..............  ");
    try {
      const { channel } = req.query;

      if (channel) {
        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheID = `get_hourly_${day}`;

        redis.get(cacheID, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(HTTPStatus.OK).json(resultJSON);
          } else if (err) {
            callbackErrors(err, req, res);
          } else {
            axios
              .get(constants.GET_HOURLY_FEEDS(Number(channel)))
              .then((response) => {
                const responseJSON = response.data;
                redis.set(
                  cacheID,
                  JSON.stringify({ isCache: true, ...responseJSON })
                );
                redis.expire(cacheID, GET_HOURLY_CACHE_EXPIRATION);
                return res
                  .status(HTTPStatus.OK)
                  .json({ isCache: false, ...responseJSON });
              })
              .catch((err) => {
                axiosError({ error, res });
              });
          }
        });
        // let fetch_response = await fetch(
        //   constants.GET_HOURLY_FEEDS(req.params.ch_id)
        // );
        // let json = await fetch_response.json();
        // res.status(HTTPStatus.OK).send(json);
      } else {
        missingQueryParams(req, res);
      }
    } catch (error) {
      tryCatchErrors(error, req, res);
    }
  },

  generateDescriptiveLastEntry: async (req, res) => {
    try {
      const { channel, device } = req.query;
      if (channel) {
        let api_key = "";
        let errors = [];
        let responseFromGetAPIKey = await constants.GET_API_KEY(channel);
        logObject("responseFromGetAPIKey", responseFromGetAPIKey);
        if (responseFromGetAPIKey.success === true) {
          api_key = responseFromGetAPIKey.data;
        }

        if (responseFromGetAPIKey.success === false) {
          if (responseFromGetAPIKey.error) {
            errors.push(responseFromGetAPIKey.error);
            errors.push(responseFromGetAPIKey.message);
          } else {
            errors.push(responseFromGetAPIKey.message);
          }
        }
        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheID = `descriptive_last_entry_${channel.trim()}_${day}`;
        redis.get(cacheID, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(HTTPStatus.OK).json(resultJSON);
          } else {
            axios
              .get(constants.GENERATE_LAST_ENTRY({ channel, api_key }))
              .then(async (response) => {
                let readings = response.data;
                let lastEntryId = readings.channel.last_entry_id;

                let recentReadings = await readings.feeds.filter((item) => {
                  return item.entry_id === lastEntryId;
                });
                let responseData = recentReadings[0];

                delete responseData.entry_id;

                let cleanedDeviceMeasurements = cleanMeasurements(responseData);
                logObject("cleanedMeasurement", cleanedDeviceMeasurements);

                let transformedData = await transformMeasurement(
                  cleanedDeviceMeasurements
                );
                let transformedField = {};
                let otherData = transformedData.other_data;

                if (otherData) {
                  transformedField = await trasformFieldValues(otherData);
                  delete transformedData.other_data;
                }

                let newResp = {
                  success: true,
                  ...transformedData,
                  ...transformedField,
                  errors,
                };

                let cleanedFinalTransformation = cleanMeasurements(newResp);

                logObject(
                  "cleanedTransformedMeasurement",
                  cleanedFinalTransformation
                );
                redis.set(
                  cacheID,
                  JSON.stringify({
                    isCache: true,
                    ...cleanedFinalTransformation,
                  })
                );

                redis.expire(
                  cacheID,
                  GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION
                );

                return res.status(HTTPStatus.OK).json({
                  isCache: false,
                  ...cleanedFinalTransformation,
                });
              })
              .catch((error) => {
                let extra = errors;
                axiosError({ error, res, extra });
              });
          }
        });
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(e, req, res);
    }
  },
  getChannelLastEntryAge: async (req, res) => {
    try {
      const { channel } = req.query;
      console.log("the channel ID:", channel);
      let ts = Date.now();
      let day = await generateDateFormat(ts);
      let cacheID = `entry_age_${channel.trim()}_${day}`;
      console.log("the cache ID", cacheID);
      return redis.get(cacheID, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(HTTPStatus.OK).json({
            ...resultJSON,
          });
        } else {
          return axios
            .get(constants.GET_CHANNEL_LAST_ENTRY_AGE(channel))
            .then((response) => {
              const responseJSON = response.data;
              redis.set(
                cacheID,
                JSON.stringify({
                  isCache: true,
                  channel: channel,
                  ...responseJSON,
                })
              );
              redis.expire(
                cacheID,
                GET_CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION
              );
              return res.status(HTTPStatus.OK).json({
                isCache: false,
                ...responseJSON,
              });
            })
            .catch((err) => {
              return res.json({
                error: err.message,
                message: "Server Error",
              });
            });
        }
      });
    } catch (e) {
      res
        .status(HTTPStatus.BAD_GATEWAY)
        .json({ error: e.message, message: "Server Error" });
    }
  },

  getLastFieldEntryAge: async (req, res) => {
    try {
      const { channel, sensor } = req.query;

      if (channel && sensor) {
        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheID = `entry_age_${channel.trim()}_${sensor.trim()}_${day}`;
        console.log("the cache value: ", cacheID);

        return redis.get(`${cacheID}`, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(HTTPStatus.OK).json({ ...resultJSON });
          } else {
            /**
             * we can trasform the field
             */
            let field = getFieldByLabel(sensor);
            return axios
              .get(constants.GET_LAST_FIELD_ENTRY_AGE(channel, field))
              .then((response) => {
                const responseJSON = response.data;
                redis.set(
                  cacheID,
                  JSON.stringify({ isCache: true, ...responseJSON })
                );
                redis.expire(
                  cacheID,
                  GET_LAST_FIELD_ENTRY_AGE_CACHE_EXPIRATION
                );

                return res.status(HTTPStatus.OK).json({
                  isCache: false,
                  ...responseJSON,
                });
              })
              .catch((err) => {
                return res.json({
                  error: err.message,
                  message: "Server Error",
                });
              });
          }
        });
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          message: "missing request parameters, please check documentation",
        });
      }
    } catch (e) {
      res
        .status(HTTPStatus.BAD_GATEWAY)
        .json({ error: e.message, message: "server error" });
    }
  },

  getDeviceCount: async (req, res) => {
    console.log(" getDeviceCount..............  ");
    try {
      let ts = Date.now();
      let day = await generateDateFormat(ts);
      let cacheID = `device_count_${day}`;
      console.log("the cache value: ", cacheID);
      return redis.get(`${cacheID}`, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(200).json(resultJSON);
        } else {
          return axios
            .get(constants.API_URL_CHANNELS)
            .then((response) => {
              const responseJSON = response.data;
              let count = Object.keys(responseJSON).length;
              redis.set(`${cacheID}`, JSON.stringify({ isCache: true, count }));
              redis.expire(cacheID, GET_DEVICE_COUNT_CACHE_EXPIRATION);
              // Send JSON response to redis
              return res.status(200).json({ isCache: false, count });
            })
            .catch((err) => {
              return res.json(err);
            });
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message, message: "Server Error" });
    }
  },

  getOutOfRange: () => {},

  getIncorrectValues: () => {},

  getThingsOff: () => {},

  getDueMaintenance: () => {},
};

module.exports = data;
