const httpStatus = require("http-status");
const fetch = require("node-fetch");
const axios = require("axios").default;
const redis = require("../config/redis");
const isEmpty = require("is-empty");
const { generateDateFormat, isDate } = require("../utils/date");
const constants = require("../config/constants");
const transformUtil = require("../utils/transform");
const { logObject, logElement, logText } = require("../utils/log");
const cleanDeep = require("clean-deep");
const log4js = require("log4js");
const stringify = require("@utils/stringify");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transform-controller`
);
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");

const isGasDevice = (description) => {
  return description.toLowerCase().includes("gas");
};

const categorizeOutput = (input) => {
  try {
    if (!input || typeof input !== "object") {
      throw new Error("Invalid input: expected an object");
    }

    if (!input.hasOwnProperty("description")) {
      return "lowcost";
    }

    return isGasDevice(input.description) ? "gas" : "lowcost";
  } catch (error) {
    return {
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const getChannelApiKey = async (channel) => {
  try {
    const result = await transformUtil.getAPIKey(channel);
    if (result.success) {
      return result.data;
    } else {
      logger.error(`Error in getAPIKey: ${stringify(result)}`);
      throw new Error(result.message);
    }
  } catch (error) {
    logger.error(`Error in getChannelApiKey: ${stringify(error)}`);
    throw error;
  }
};

const fetchThingspeakData = async (request) => {
  const url = transformUtil.readRecentDeviceMeasurementsFromThingspeak({
    request,
  });
  const response = await axios.get(url);
  return response.data;
};

const handleThingspeakResponse = (data) => {
  const readings = data.feeds[0];
  if (isEmpty(readings)) {
    return {
      status: httpStatus.NOT_FOUND,
      data: {
        success: true,
        message: "No recent measurements for this device",
      },
    };
  }
  return { status: httpStatus.OK, data: { isCache: false, ...readings } };
};

const processDeviceMeasurements = async (readings, metadata) => {
  if (isEmpty(readings)) {
    return {
      status: httpStatus.NOT_FOUND,
      data: {
        success: true,
        message: "no recent measurements for this device",
      },
    };
  }

  let cleanedDeviceMeasurements = transformUtil.clean(readings);
  const fieldOneValue = cleanedDeviceMeasurements.field1 || null;

  if (isEmpty(fieldOneValue)) {
    return {
      status: httpStatus.INTERNAL_SERVER_ERROR,
      data: {
        success: false,
        message: "unable to categorise device",
        errors: {
          message:
            "please crosscheck device on thingSpeak, it is not sending field1",
        },
      },
    };
  }

  const deviceCategory = isDate(fieldOneValue)
    ? "reference"
    : categorizeOutput(metadata);
  cleanedDeviceMeasurements.field9 = deviceCategory;

  let transformedData = await transformUtil.transformMeasurement(
    cleanedDeviceMeasurements
  );
  let transformedField = {};

  if (transformedData.other_data) {
    transformedField = await transformUtil.trasformFieldValues({
      otherData: transformedData.other_data,
      deviceCategory,
    });
    delete transformedData.other_data;
  }

  let cleanedFinalTransformation = transformUtil.clean({
    ...transformedData,
    ...transformedField,
  });

  if (cleanedFinalTransformation.ExternalPressure) {
    const pressureConversionResult =
      transformUtil.convertFromHectopascalsToKilopascals(
        cleanedFinalTransformation.ExternalPressure
      );
    if (pressureConversionResult.success) {
      cleanedFinalTransformation.ExternalPressure =
        pressureConversionResult.data;
    } else {
      return {
        status:
          pressureConversionResult.status || httpStatus.INTERNAL_SERVER_ERROR,
        data: pressureConversionResult,
      };
    }
  }

  return {
    status: httpStatus.OK,
    data: { isCache: false, ...cleanedFinalTransformation },
  };
};

const data = {
  getChannels: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      let ts = Date.now();
      let day = await generateDateFormat(ts);
      let cacheID = `get_channels_${day}`;

      redis.get(cacheID, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(httpStatus.OK).json(resultJSON);
        } else if (err) {
          let message = err;
          let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
          let error = err;
          logger.error(`🐛🐛 Internal Server Error ${error.message}`);
          next(new HttpError(message, statusCode, err));
          return;
        } else {
          axios
            .get(constants.GET_CHANNELS, {
              headers: {
                Authorization: `JWT ${constants.JWT_TOKEN}`,
              },
            })
            .then((response) => {
              const responseJSON = response.data;
              redis.set(cacheID, stringify({ isCache: true, ...responseJSON }));
              redis.expire(cacheID, constants.GET_CHANNELS_CACHE_EXPIRATION);
              return res
                .status(httpStatus.OK)
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

              let statusCode = httpStatus.INTERNAL_SERVER_ERROR;

              logger.error(`🐛🐛 Internal Server Error ${error.message}`);
              next(new HttpError(message, statusCode, error));
              return;
            });
        }
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getFeeds: async (req, res, next) => {
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      return;
    }

    logText("getting feeds..............  ");
    const fetch_response = await fetch(constants.GET_FEEDS(req.params.ch_id));
    const json = await fetch_response.json();
    res.status(200).send(json);
  },
  getLastFeed: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const { start, end, ch_id } = { ...req.query, ...req.params };
      const channel = ch_id;

      try {
        const api_key = await getChannelApiKey(channel);
        const request = { channel, api_key, start, end };
        const thingspeakData = await fetchThingspeakData(request);
        const { status, data } = handleThingspeakResponse(thingspeakData);
        return res.status(status).json(data);
      } catch (error) {
        logger.error(`🐛🐛 Error in getLastFeed: ${error.message}`);
        const message = error.response
          ? error.response.data
          : "Internal Server Error";
        const statusCode = error.response
          ? error.response.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(new HttpError(message, statusCode, { message: error.message }));
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getLastEntry: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const { ch_id } = req.params;
      if (ch_id) {
        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheID = `last_entry_${ch_id.trim()}_${day}`;
        redis.get(cacheID, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(httpStatus.OK).json(resultJSON);
          } else {
            let channel = ch_id;
            axios
              .get(constants.READ_DEVICE_FEEDS({ channel }), {
                headers: {
                  Authorization: `JWT ${constants.JWT_TOKEN}`,
                },
              })
              .then(async (response) => {
                let readings = response.data;

                let lastEntryId = readings.channel.last_entry_id;
                let recentReadings = await readings.feeds.filter((item) => {
                  return item.entry_id === lastEntryId;
                });
                let responseData = recentReadings[0];
                redis.set(
                  cacheID,
                  stringify({ isCache: true, ...responseData })
                );
                redis.expire(
                  cacheID,
                  constants.GET_LAST_ENTRY_CACHE_EXPIRATION
                );

                return res.status(httpStatus.OK).json({
                  isCache: false,
                  ...responseData,
                });
              })
              .catch((err) => {
                logObject("the err", err);
                let error = {};
                if (err.response) {
                  error["response"] = err.response.data;
                } else if (err.request) {
                  error["request"] = err.request;
                } else if (err.config) {
                  error["config"] = err.config;
                }
                const message = err.response
                  ? err.response.data
                  : "Internal Server Error";
                const statusCode = httpStatus.INTERNAL_SERVER_ERROR;

                logger.error(`🐛🐛 Internal Server Error ${error.message}`);
                next(
                  new HttpError(message, statusCode, { message: error.message })
                );
                return;
              });
          }
        });
      } else {
        let message = "missing some request parameters";
        let statusCode = httpStatus.BAD_REQUEST;
        let error = {};

        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(new HttpError(message, statusCode, err));
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  hourly: async (req, res, next) => {
    logText("getting hourly..............  ");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const { channel } = req.query;

      if (channel) {
        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheID = `get_hourly_${day}`;

        redis.get(cacheID, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(httpStatus.OK).json(resultJSON);
          } else if (err) {
            let message = err;
            let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
            let error = err;
            logger.error(`🐛🐛 Internal Server Error ${error.message}`);
            next(new HttpError(message, statusCode, error));
            return;
          } else {
            axios
              .get(constants.GET_HOURLY_FEEDS(Number(channel)), {
                headers: {
                  Authorization: `JWT ${constants.JWT_TOKEN}`,
                },
              })
              .then((response) => {
                const responseJSON = response.data;
                redis.set(
                  cacheID,
                  stringify({ isCache: true, ...responseJSON })
                );
                redis.expire(cacheID, constants.GET_HOURLY_CACHE_EXPIRATION);
                return res
                  .status(httpStatus.OK)
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

                let statusCode = httpStatus.INTERNAL_SERVER_ERROR;

                logger.error(`🐛🐛 Internal Server Error ${error.message}`);
                next(new HttpError(message, statusCode, error));
                return;
              });
          }
        });
        // let fetch_response = await fetch(
        //   constants.GET_HOURLY_FEEDS(req.params.ch_id)
        // );
        // let json = await fetch_response.json();
        // res.status(httpStatus.OK).send(json);
      } else {
        let message = "missing some request parameters";
        let statusCode = httpStatus.BAD_REQUEST;
        let error = {};

        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(new HttpError(message, statusCode, error));
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  readBAM: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  generateDescriptiveLastEntry: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const { channel, start, end } = req.query;

      try {
        const api_key = await getChannelApiKey(channel);
        const request = { channel, api_key, start, end };
        const thingspeakData = await fetchThingspeakData(request);

        const { status, data } = await processDeviceMeasurements(
          thingspeakData.feeds[0],
          thingspeakData.channel
        );
        return res.status(status).json(data);
      } catch (error) {
        logger.error(
          `🐛🐛 an error in generateDescriptiveLastEntry: ${stringify(error)}`
        );
        const message = error.response
          ? error.response.data
          : "Internal Server Error";
        const statusCode = error.response
          ? error.response.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(new HttpError(message, statusCode, error));
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getChannelLastEntryAge: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const { channel } = req.query;
      logElement("the channel ID:", channel);
      let ts = Date.now();
      let day = await generateDateFormat(ts);
      let cacheID = `entry_age_${channel.trim()}_${day}`;
      logElement("the cache ID", cacheID);
      return redis.get(cacheID, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(httpStatus.OK).json({
            ...resultJSON,
          });
        } else {
          return axios
            .get(constants.GET_CHANNEL_LAST_ENTRY_AGE(channel), {
              headers: {
                Authorization: `JWT ${constants.JWT_TOKEN}`,
              },
            })
            .then((response) => {
              const responseJSON = response.data;
              redis.set(
                cacheID,
                stringify({
                  isCache: true,
                  channel: channel,
                  ...responseJSON,
                })
              );
              redis.expire(
                cacheID,
                constants.GET_CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION
              );
              return res.status(httpStatus.OK).json({
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

              let statusCode = httpStatus.INTERNAL_SERVER_ERROR;

              logger.error(`🐛🐛 Internal Server Error ${error.message}`);
              next(new HttpError(message, statusCode, error));
              return;
            });
        }
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getLastFieldEntryAge: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const { channel, sensor } = req.query;

      if (channel && sensor) {
        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheID = `entry_age_${channel.trim()}_${sensor.trim()}_${day}`;
        logElement("the cache value: ", cacheID);

        return redis.get(`${cacheID}`, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res.status(httpStatus.OK).json({ ...resultJSON });
          } else {
            /**
             * we can trasform the field
             */
            let field = transformUtil.getFieldByLabel(sensor);
            return axios
              .get(constants.GET_LAST_FIELD_ENTRY_AGE(channel, field), {
                headers: {
                  Authorization: `JWT ${constants.JWT_TOKEN}`,
                },
              })
              .then((response) => {
                const responseJSON = response.data;
                redis.set(
                  cacheID,
                  stringify({ isCache: true, ...responseJSON })
                );
                redis.expire(
                  cacheID,
                  constants.GET_CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION
                );

                return res.status(httpStatus.OK).json({
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

                let statusCode = httpStatus.INTERNAL_SERVER_ERROR;

                logger.error(`🐛🐛 Internal Server Error ${error.message}`);
                next(new HttpError(message, statusCode, error));
                return;
              });
          }
        });
      } else {
        return res.status(httpStatus.BAD_REQUEST).json({
          message: "missing request parameters, please check documentation",
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getDeviceCount: async (req, res, next) => {
    logText(" getDeviceCount..............  ");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      let ts = Date.now();
      let day = await generateDateFormat(ts);
      let cacheID = `device_count_${day}`;
      logElement("the cache value: ", cacheID);
      return redis.get(`${cacheID}`, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(200).json(resultJSON);
        } else {
          return axios
            .get(constants.API_URL_CHANNELS, {
              headers: {
                Authorization: `JWT ${constants.JWT_TOKEN}`,
              },
            })
            .then((response) => {
              const responseJSON = response.data;
              let count = Object.keys(responseJSON).length;
              redis.set(`${cacheID}`, stringify({ isCache: true, count }));
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

              let statusCode = httpStatus.INTERNAL_SERVER_ERROR;

              logger.error(`🐛🐛 Internal Server Error ${error.message}`);
              next(new HttpError(message, statusCode, error));
              return;
            });
        }
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = data;
