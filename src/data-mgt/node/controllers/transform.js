const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channel = require("../models/Channel");
const Feed = require("../models/Feed");
const axios = require("axios").default;
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
const getDevice = require("../utils/get-device");
const getFeed = require("../utils/get-feed");
const { gpsCheck, getGPSFromDB } = require("../utils/gps-check");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
  badRequest,
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
const { logObject, logElement, logText } = require("../utils/log");
const manipulateArraysUtil = require("../utils/manipulate-arrays");
const { validationResult } = require("express-validator");

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
              .get(constants.READ_DEVICE_FEEDS({ channel }))
              .then(async (response) => {
                let readings = response.data;

                let lastEntryId = readings.channel.last_entry_id;
                let recentReadings = await readings.feeds.filter((item) => {
                  return item.entry_id === lastEntryId;
                });
                let responseData = recentReadings[0];
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

  readBAM: async (req, res) => {
    try {
    } catch (error) {}
  },

  readDataRangeOfEvents: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { channel, start, end } = req.query;
      let api_key = "";
      let errors = [];
      let lastPath = "";

      if (req.path) {
        logElement("the path is alive!", req.path);
        let arrayOfPaths = req.path.split("/");
        let lastPathIndex = arrayOfPaths.length - 1;
        lastPath = arrayOfPaths[lastPathIndex];
        logElement("lastPath", lastPath);
      }

      await getDevice.getAPIKey(channel, async (result) => {
        if (result.success === true) {
          api_key = result.data;
          let ts = Date.now();
          let day = await generateDateFormat(ts);
          let cacheID = `descriptive_last_entry_${channel.trim()}_${day}`;
          redis.get(cacheID, (err, result) => {
            if (result) {
              const resultJSON = JSON.parse(result);
              return res.status(HTTPStatus.OK).json(resultJSON);
            } else if (err) {
              return res
                .status(HTTPStatus.INTERNAL_SERVER_ERROR)
                .json({ error: err, message: "Internal Server Error" });
            } else {
              let request = {};
              request["channel"] = channel;
              request["api_key"] = api_key;
              request["start"] = start;
              request["end"] = end;
              request["path"] = lastPath;

              axios
                .get(getFeed.readDeviceMeasurementsFromThingspeak({ request }))
                .then(async (response) => {
                  const readings = response.data;
                  const { feeds } = readings;

                  let measurements = [];

                  if (lastPath === "last") {
                    let lastEntryId = readings.channel.last_entry_id;
                    let recentReadings = await readings.feeds.filter((item) => {
                      return item.entry_id === lastEntryId;
                    });

                    delete recentReadings[0].entry_id;

                    let transformedData = await transformMeasurement(
                      recentReadings[0]
                    );
                    let transformedField = {};

                    if (transformedData.other_data) {
                      transformedField = await trasformFieldValues(
                        transformedData.other_data
                      );
                      delete transformedData.other_data;
                    }
                    let data = { ...transformedData, ...transformedField };

                    let newResp = {
                      ...data,
                      errors,
                    };
                    measurements.push(newResp);
                  }

                  if (lastPath === "feeds") {
                    for (const feed of feeds) {
                      delete feed.entry_id;
                      let transformedField = {};
                      let transformedData = await transformMeasurement(feed);
                      if (transformedData.other_data) {
                        transformedField = await trasformFieldValues(
                          transformedData.other_data
                        );
                        delete transformedData.other_data;
                      }
                      let data = { ...transformedData, ...transformedField };
                      let newResp = {
                        ...data,
                        errors,
                      };
                      measurements.push(newResp);
                    }
                  }

                  redis.set(
                    cacheID,
                    JSON.stringify({
                      isCache: true,
                      success: true,
                      measurements,
                    })
                  );

                  redis.expire(
                    cacheID,
                    constants.GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION
                  );

                  return res.status(HTTPStatus.OK).json({
                    isCache: false,
                    success: true,
                    measurements,
                  });
                })
                .catch((error) => {
                  logObject("axios server error", error);
                  return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
                    errors: {
                      message: error,
                    },
                    message: "Internal Server Error",
                    success: false,
                  });
                });
            }
          });
        }
        if (result.success === false) {
          logText("Not able to get the API key");
          const errors = result.errors
            ? result.errors
            : { message: "Internal Server Error" };
          return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
            message: result.message,
            errors,
            success: false,
          });
        }
      });
    } catch (error) {
      logObject("Internal Server Error", error);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  generateDescriptiveLastEntry: async (req, res) => {
    try {
      const { channel, device, start, end } = req.query;
      if (channel) {
        let api_key = "";
        let errors = [];
        await getDevice.getAPIKey(channel, (result) => {
          if (result.success === true) {
            api_key = result.data;
          }
          if (result.success === false) {
            res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
              message: result.message,
              errors: result.errors,
            });
          }
        });

        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheID = `descriptive_last_entry_${channel.trim()}_${day}`;
        redis.get(cacheID, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(HTTPStatus.OK).json(resultJSON);
          } else {
            let request = {};
            request["channel"] = channel;
            request["api_key"] = api_key;
            request["start"] = start;
            request["end"] = end;
            axios
              .get(getFeed.readDeviceMeasurementsFromThingspeak({ request }))
              .then(async (response) => {
                const readings = response.data;
                const { feeds } = readings;
                let lastEntryId = readings.channel.last_entry_id;

                if (isEmpty(lastEntryId) && isEmpty(feeds)) {
                  return res.status(HTTPStatus.NOT_FOUND).json({
                    success: true,
                    message: "no recent measurements for this device",
                  });
                }

                let recentReadings = await readings.feeds.filter((item) => {
                  return item.entry_id === lastEntryId;
                });
                let responseData = recentReadings[0];

                delete responseData.entry_id;

                let cleanedDeviceMeasurements = cleanMeasurements(responseData);

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
                logObject("axios server error", error);
                let extra = errors;
                axiosError({ error, res, extra });
              });
          }
        });
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      logObject("error", e);
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
