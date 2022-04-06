const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const axios = require("axios").default;
const redis = require("../config/redis");
const isEmpty = require("is-empty");
const { generateDateFormat } = require("../utils/date");
const constants = require("../config/constants");
const transformUtil = require("../utils/transform");
const { logObject, logElement, logText } = require("../utils/log");
const errorsUtil = require("../utils/errors");
const { validationResult } = require("express-validator");
const cleanDeep = require("clean-deep");

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
          let message = err;
          let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
          let error = err;
          errorsUtil.errorResponse({ res, message, statusCode, error });
        } else {
          axios
            .get(constants.GET_CHANNELS)
            .then((response) => {
              const responseJSON = response.data;
              redis.set(
                cacheID,
                JSON.stringify({ isCache: true, ...responseJSON })
              );
              redis.expire(cacheID, constants.GET_CHANNELS_CACHE_EXPIRATION);
              return res
                .status(HTTPStatus.OK)
                .json({ isCache: false, ...responseJSON });
            })
            .catch((err) => {
              let error = {};
              if (err.response) {
                error["response"] = err.response.data;
              } else if (err.request) {
                error["request"] = err.request;
              } else {
                error["config"] = err.config;
              }
              let message = err.response
                ? err.response.data
                : "Internal Server Error";

              let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
              errorsUtil.errorResponse({ res, message, statusCode, error });
            });
        }
      });
    } catch (error) {
      let message = error.message;
      let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      errorsUtil.errorResponse({ res, message, statusCode, error });
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
                redis.expire(
                  cacheID,
                  constants.GET_LAST_ENTRY_CACHE_EXPIRATION
                );

                return res.status(HTTPStatus.OK).json({
                  isCache: false,
                  ...responseData,
                });
              })
              .catch((err) => {
                let error = {};
                if (err.response) {
                  error["response"] = err.response.data;
                } else if (err.request) {
                  error["request"] = err.request;
                } else {
                  error["config"] = err.config;
                }
                let message = err.response
                  ? err.response.data
                  : "Internal Server Error";

                let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
                errorsUtil.errorResponse(
                  ({ res, message, statusCode, error } = {})
                );
              });
          }
        });
      } else {
        let message = "missing some request parameters";
        let statusCode = HTTPStatus.BAD_REQUEST;
        let error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
    } catch (error) {
      let message = error.message;
      let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      errorsUtil.errorResponse({ res, message, statusCode, error });
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
            let message = err;
            let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
            let error = err;
            errorsUtil.errorResponse({ res, message, statusCode, error });
          } else {
            axios
              .get(constants.GET_HOURLY_FEEDS(Number(channel)))
              .then((response) => {
                const responseJSON = response.data;
                redis.set(
                  cacheID,
                  JSON.stringify({ isCache: true, ...responseJSON })
                );
                redis.expire(cacheID, constants.GET_HOURLY_CACHE_EXPIRATION);
                return res
                  .status(HTTPStatus.OK)
                  .json({ isCache: false, ...responseJSON });
              })
              .catch((err) => {
                let error = {};
                if (err.response) {
                  error["response"] = err.response.data;
                } else if (err.request) {
                  error["request"] = err.request;
                } else {
                  error["config"] = err.config;
                }
                let message = err.response
                  ? err.response.data
                  : "Internal Server Error";

                let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
                errorsUtil.errorResponse({ res, message, statusCode, error });
              });
          }
        });
        // let fetch_response = await fetch(
        //   constants.GET_HOURLY_FEEDS(req.params.ch_id)
        // );
        // let json = await fetch_response.json();
        // res.status(HTTPStatus.OK).send(json);
      } else {
        let message = "missing some request parameters";
        let statusCode = HTTPStatus.BAD_REQUEST;
        let error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
    } catch (error) {
      let message = error.message;
      let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },

  readBAM: async (req, res) => {
    try {
    } catch (error) {}
  },

  readFeeds: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        let message = "bad request errors";
        let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
        let error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { channel, device_number, start, end } = req.query;
      let api_key = "";
      let deviceNumber = channel || device_number;
      await transformUtil.getAPIKey(channel, async (result) => {
        if (result.success === true) {
          api_key = result.data;
          let ts = Date.now();
          let day = await generateDateFormat(ts);
          let startTime = start ? start : "no_start";
          let endTime = end ? end : "no_end";
          let device = deviceNumber ? deviceNumber : "no_device_number";
          let cacheID = `feeds_${device.trim()}_${day}_${startTime}_${endTime}`;
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
              request["channel"] = deviceNumber;
              request["api_key"] = api_key;
              request["start"] = start;
              request["end"] = end;
              request["path"] = "feeds";

              axios
                .get(
                  transformUtil.readDeviceMeasurementsFromThingspeak({
                    request,
                  })
                )
                .then(async (response) => {
                  const readings = response.data;
                  const { feeds } = readings;

                  let measurements = [];

                  for (const feed of feeds) {
                    delete feed.entry_id;
                    let transformedField = {};
                    let transformedData =
                      await transformUtil.transformMeasurement(feed);
                    if (transformedData.other_data) {
                      transformedField =
                        await transformUtil.trasformFieldValues(
                          transformedData.other_data
                        );
                      delete transformedData.other_data;
                    }
                    let data = { ...transformedData, ...transformedField };
                    measurements.push({
                      ...data,
                    });
                  }

                  redis.set(
                    cacheID,
                    JSON.stringify({
                      isCache: true,
                      success: true,
                      measurements: cleanDeep(measurements),
                    })
                  );

                  redis.expire(
                    cacheID,
                    parseInt(
                      constants.GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION
                    )
                  );

                  return res.status(HTTPStatus.OK).json({
                    isCache: false,
                    success: true,
                    measurements: cleanDeep(measurements),
                  });
                })
                .catch((err) => {
                  let error = {};
                  if (err.response) {
                    error["response"] = err.response.data;
                  } else if (err.request) {
                    error["request"] = err.request;
                  } else {
                    error["config"] = err.config;
                  }
                  let message = err.response
                    ? err.response.data
                    : "Internal Server Error";

                  let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
                  errorsUtil.errorResponse({ res, message, statusCode, error });
                });
            }
          });
        } else if (result.success === false) {
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

  readMostRecentFeeds: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        let message = "bad request errors";
        let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
        let error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { channel, device_number, start, end } = req.query;
      let api_key = "";
      const deviceNumber = channel || device_number;

      await transformUtil.getAPIKey(channel, async (result) => {
        if (result.success === true) {
          api_key = result.data;
          let ts = Date.now();
          let day = await generateDateFormat(ts);
          let startTime = start ? start : "no_start";
          let endTime = end ? end : "no_end";
          let device = deviceNumber ? deviceNumber : "no_device_number";
          let cacheID = `recent_feeds_${device.trim()}_${day}_${startTime}_${endTime}`;
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
              request["channel"] = deviceNumber;
              request["api_key"] = api_key;
              request["start"] = start;
              request["end"] = end;
              request["path"] = "last";

              axios
                .get(
                  transformUtil.readDeviceMeasurementsFromThingspeak({
                    request,
                  })
                )
                .then(async (response) => {
                  let measurements = [];

                  let lastEntryId = response.data.channel.last_entry_id;

                  let extractedRecentReadings =
                    await response.data.feeds.filter((item) => {
                      return item.entry_id === lastEntryId;
                    });

                  logObject(
                    "extractedRecentReadings[0]",
                    extractedRecentReadings[0]
                  );

                  let transformedData =
                    await transformUtil.transformMeasurement(
                      extractedRecentReadings[0]
                    );
                  let transformedField = {};

                  if (transformedData.other_data) {
                    transformedField = await transformUtil.trasformFieldValues(
                      transformedData.other_data
                    );
                    delete transformedData.other_data;
                  }

                  let data = { ...transformedData, ...transformedField };
                  measurements.push({
                    ...data,
                  });

                  redis.set(
                    cacheID,
                    JSON.stringify({
                      isCache: true,
                      success: true,
                      measurements: cleanDeep(measurements),
                    })
                  );

                  redis.expire(
                    cacheID,
                    parseInt(
                      constants.GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION
                    )
                  );

                  return res.status(HTTPStatus.OK).json({
                    isCache: false,
                    success: true,
                    measurements: cleanDeep(measurements),
                  });
                })
                .catch((err) => {
                  let error = {};
                  logObject("err", err);
                  if (err.response) {
                    error["response"] = err.response.data;
                  } else if (err.request) {
                    error["request"] = err.request;
                  } else {
                    error["others"] = err;
                  }
                  let message = err.response
                    ? err.response.data
                    : "Internal Server Error";

                  let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
                  errorsUtil.errorResponse({
                    res,
                    message,
                    statusCode,
                    error,
                  });
                });
            }
          });
        } else if (result.success === false) {
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
        await transformUtil.getAPIKey(channel, (result) => {
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
              .get(
                transformUtil.readDeviceMeasurementsFromThingspeak({ request })
              )
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

                let cleanedDeviceMeasurements =
                  transformUtil.clean(responseData);

                let transformedData = await transformUtil.transformMeasurement(
                  cleanedDeviceMeasurements
                );
                let transformedField = {};
                let otherData = transformedData.other_data;

                if (otherData) {
                  transformedField = await transformUtil.trasformFieldValues(
                    otherData
                  );
                  delete transformedData.other_data;
                }

                let newResp = {
                  success: true,
                  ...transformedData,
                  ...transformedField,
                  errors,
                };

                let cleanedFinalTransformation = transformUtil.clean(newResp);

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
                  constants.GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION
                );

                return res.status(HTTPStatus.OK).json({
                  isCache: false,
                  ...cleanedFinalTransformation,
                });
              })
              .catch((err) => {
                let error = {};
                if (err.response) {
                  error["response"] = err.response.data;
                } else if (err.request) {
                  error["request"] = err.request;
                } else {
                  error["config"] = err.config;
                }
                let message = err.response
                  ? err.response.data
                  : "Internal Server Error";

                let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
                errorsUtil.errorResponse({ res, message, statusCode, error });
              });
          }
        });
      } else {
        let message = "missing some request parameters";
        let statusCode = HTTPStatus.BAD_REQUEST;
        let error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
    } catch (error) {
      let message = error.message;
      let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      errorsUtil.errorResponse({ res, message, statusCode, error });
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
                constants.GET_CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION
              );
              return res.status(HTTPStatus.OK).json({
                isCache: false,
                ...responseJSON,
              });
            })
            .catch((err) => {
              let error = {};
              if (err.response) {
                error["response"] = err.response.data;
              } else if (err.request) {
                error["request"] = err.request;
              } else {
                error["config"] = err.config;
              }
              let message = err.response
                ? err.response.data
                : "Internal Server Error";

              let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
              errorsUtil.errorResponse({ res, message, statusCode, error });
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
            let field = transformUtil.getFieldByLabel(sensor);
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
                  constants.GET_CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION
                );

                return res.status(HTTPStatus.OK).json({
                  isCache: false,
                  ...responseJSON,
                });
              })
              .catch((err) => {
                let error = {};
                if (err.response) {
                  error["response"] = err.response.data;
                } else if (err.request) {
                  error["request"] = err.request;
                } else {
                  error["config"] = err.config;
                }
                let message = err.response
                  ? err.response.data
                  : "Internal Server Error";

                let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
                errorsUtil.errorResponse({ res, message, statusCode, error });
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
              redis.expire(
                cacheID,
                constants.GET_DEVICE_COUNT_CACHE_EXPIRATION
              );
              // Send JSON response to redis
              return res.status(200).json({ isCache: false, count });
            })
            .catch((err) => {
              let error = {};
              if (err.response) {
                error["response"] = err.response.data;
              } else if (err.request) {
                error["request"] = err.request;
              } else {
                error["config"] = err.config;
              }
              let message = err.response
                ? err.response.data
                : "Internal Server Error";

              let statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
              errorsUtil.errorResponse({ res, message, statusCode, error });
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
