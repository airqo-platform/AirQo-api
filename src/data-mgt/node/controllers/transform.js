const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channel = require("../models/Channel");
const Feed = require("../models/Feed");
const axios = require("axios");
const redis = require("../config/redis");
const {
  getLastEntry,
  generateDescriptiveLastEntry,
} = require("../utils/getLastEntry");
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
              redis.expire(cacheID, 86400);
              return res
                .status(HTTPStatus.OK)
                .json({ isCache: false, ...responseJSON });
            })
            .catch((err) => {
              axiosError(err, req, res);
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
    res.status(200).json(json);
  },

  getLastEntry: async (req, res) => {
    const { frequency } = req.query;
    getLastEntry(req, res, frequency);
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
                const { data } = response;
                redis.set(cacheID, JSON.stringify({ isCache: true, ...data }));
                redis.expire(cacheID, 86400);
                return res
                  .status(HTTPStatus.OK)
                  .json({ isCache: false, ...data });
              })
              .catch((err) => {
                axiosError(err, req, res);
              });
          }
        });
      } else {
        missingQueryParams(req, res);
      }
    } catch (error) {
      tryCatchErrors(error, req, res);
    }
  },

  generateDescriptiveLastEntry: async (req, res) => {
    const { frequency } = req.query;
    generateDescriptiveLastEntry(req, res, frequency);
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
              redis.expire(cacheID, 86400);
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
            let field = getFieldByLabel(sensor);
            return axios
              .get(constants.GET_LAST_FIELD_ENTRY_AGE(channel, field))
              .then((response) => {
                const responseJSON = response.data;
                redis.set(
                  cacheID,
                  JSON.stringify({ isCache: true, ...responseJSON })
                );
                redis.expire(cacheID, 86400);

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
              redis.expire(cacheID, 86400);
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
