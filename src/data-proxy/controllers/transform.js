const httpStatus = require("http-status");
const fetch = require("node-fetch");
const axios = require("axios").default;
const redis = require("@config/redis");
const isEmpty = require("is-empty");
const { generateDateFormat, isDate } = require("@utils/date");
const constants = require("@config/constants");
const transformUtil = require("@utils/transform");
const { logObject, logElement, logText } = require("@utils/log");
const cleanDeep = require("clean-deep");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transform-controller`
);
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");

const transform = {
  getChannels: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
          errorsUtil.errorResponse({ res, message, statusCode, error });
        } else {
          axios
            .get(constants.GET_CHANNELS, {
              headers: {
                Authorization: `JWT ${constants.JWT_TOKEN}`,
              },
            })
            .then((response) => {
              const responseJSON = response.data;
              redis.set(
                cacheID,
                JSON.stringify({ isCache: true, ...responseJSON })
              );
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
              errorsUtil.errorResponse({ res, message, statusCode, error });
            });
        }
      });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      logText("getting feeds..............  ");
      const fetch_response = await fetch(constants.GET_FEEDS(req.params.ch_id));
      const json = await fetch_response.json();
      res.status(200).send(json);
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
                  JSON.stringify({ isCache: true, ...responseData })
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
                errorsUtil.errorResponse(
                  ({ res, message, statusCode, error } = {})
                );
              });
          }
        });
      } else {
        let message = "missing some request parameters";
        let statusCode = httpStatus.BAD_REQUEST;
        let error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
            errorsUtil.errorResponse({ res, message, statusCode, error });
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
                  JSON.stringify({ isCache: true, ...responseJSON })
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
                errorsUtil.errorResponse({ res, message, statusCode, error });
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
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
  readFeeds: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
              return res.status(httpStatus.OK).json(resultJSON);
            } else if (err) {
              return res
                .status(httpStatus.INTERNAL_SERVER_ERROR)
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
                  }),
                  {
                    headers: {
                      Authorization: `JWT ${constants.JWT_TOKEN}`,
                    },
                  }
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

                  return res.status(httpStatus.OK).json({
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

                  let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
                  errorsUtil.errorResponse({ res, message, statusCode, error });
                });
            }
          });
        } else if (result.success === false) {
          logText("Not able to get the API key");
          const errors = result.errors
            ? result.errors
            : { message: "Internal Server Error" };
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          return res.status(status).json({
            message: result.message,
            errors,
            success: false,
          });
        }
      });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
  readMostRecentFeeds: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
              return res.status(httpStatus.OK).json(resultJSON);
            } else if (err) {
              return res
                .status(httpStatus.INTERNAL_SERVER_ERROR)
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
                  }),
                  {
                    headers: {
                      Authorization: `JWT ${constants.JWT_TOKEN}`,
                    },
                  }
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

                  return res.status(httpStatus.OK).json({
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

                  let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
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
          return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: result.message,
            errors,
            success: false,
          });
        }
      });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      if (extractErrorsFromRequest(req)) {
        next(
          new HttpError(
            "bad request errors",
            httpStatus.BAD_REQUEST,
            extractErrorsFromRequest(req)
          )
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { channel, start, end } = req.query;
      let deviceCategory = "";
      let api_key = "";
      let errors = [];
      await transformUtil.getAPIKey(channel, (result) => {
        if (result.success === true) {
          api_key = result.data;
          // let ts = Date.now();
          // let day = await generateDateFormat(ts);
          // let cacheID = `descriptive_last_entry_${channel.trim()}_${day}`;
          // redis.get(cacheID, (err, result) => {
          //   if (result) {
          //     const resultJSON = JSON.parse(result);
          //     return res.status(httpStatus.OK).json(resultJSON);
          //   } else {
          //   }
          // });
          let request = {};
          request["channel"] = channel;
          request["api_key"] = api_key;
          request["start"] = start;
          request["end"] = end;
          return axios
            .get(
              transformUtil.readRecentDeviceMeasurementsFromThingspeak({
                request,
              })
            )
            .then(async (response) => {
              logObject("the response man", response);
              const readings = response.data;
              if (isEmpty(readings)) {
                return res.status(httpStatus.NOT_FOUND).json({
                  success: true,
                  message: "no recent measurements for this device",
                });
              } else if (!isEmpty(readings)) {
                let cleanedDeviceMeasurements = transformUtil.clean(readings);
                const fieldOneValue = cleanedDeviceMeasurements.field1
                  ? cleanedDeviceMeasurements.field1
                  : null;

                if (isEmpty(fieldOneValue)) {
                  return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    message: "unable to categorise device",
                    errors: {
                      message:
                        "please crosscheck device on thingSpeak, it is not sending field1",
                    },
                  });
                } else if (!isEmpty(fieldOneValue)) {
                  const isProvidedDateReal = isDate(fieldOneValue);
                  if (isProvidedDateReal) {
                    cleanedDeviceMeasurements.field9 = "reference";
                    deviceCategory = "reference";
                  } else {
                    cleanedDeviceMeasurements.field9 = "lowcost";
                    deviceCategory = "lowcost";
                  }
                  let transformedData =
                    await transformUtil.transformMeasurement(
                      cleanedDeviceMeasurements
                    );
                  let transformedField = {};
                  let otherData = transformedData.other_data;

                  if (otherData) {
                    transformedField = await transformUtil.trasformFieldValues({
                      otherData,
                      deviceCategory,
                    });
                    delete transformedData.other_data;
                  }

                  let newResp = {
                    success: true,
                    ...transformedData,
                    ...transformedField,
                    errors,
                  };
                  let cleanedFinalTransformation = transformUtil.clean(newResp);

                  if (cleanedFinalTransformation.ExternalPressure) {
                    const responseFromConvertFromHectopascalsToKilopascals =
                      transformUtil.convertFromHectopascalsToKilopascals(
                        cleanedFinalTransformation.ExternalPressure
                      );

                    if (
                      responseFromConvertFromHectopascalsToKilopascals.success ===
                      true
                    ) {
                      cleanedFinalTransformation.ExternalPressure =
                        responseFromConvertFromHectopascalsToKilopascals.data;
                    } else if (
                      responseFromConvertFromHectopascalsToKilopascals.success ===
                      false
                    ) {
                      const status =
                        responseFromConvertFromHectopascalsToKilopascals.status
                          ? responseFromConvertFromHectopascalsToKilopascals.status
                          : httpStatus.INTERNAL_SERVER_ERROR;
                      return res
                        .status(status)
                        .json(responseFromConvertFromHectopascalsToKilopascals);
                    }
                  }

                  // redis.set(
                  //   cacheID,
                  //   JSON.stringify({
                  //     isCache: true,
                  //     ...cleanedFinalTransformation,
                  //   })
                  // );

                  // redis.expire(
                  //   cacheID,
                  //   constants.GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION
                  // );

                  return res.status(httpStatus.OK).json({
                    isCache: false,
                    ...cleanedFinalTransformation,
                  });
                }
              }
            })
            .catch((err) => {
              let error = {};
              logObject("err", err);
              if (err.response) {
                error["response"] = err.response.data;
              } else if (err.request) {
                error["request"] = err.request;
              } else if (err.config) {
                error["config"] = err.config;
              } else {
                error["message"] =
                  "unclear error as trying to get measurements from ThingSpeak";
              }
              let message = err.response
                ? err.response.data
                : "Internal Server Error";
              let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
              errorsUtil.errorResponse({ res, message, statusCode, error });
            });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            message: result.message ? result.message : "internal server error",
            errors: result.errors ? result.errors : { message: "" },
            success: result.success ? result.success : false,
          });
        }
      });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
              errorsUtil.errorResponse({ res, message, statusCode, error });
            });
        }
      });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
                  JSON.stringify({ isCache: true, ...responseJSON })
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
                errorsUtil.errorResponse({ res, message, statusCode, error });
              });
          }
        });
      } else {
        return res.status(httpStatus.BAD_REQUEST).json({
          message: "missing request parameters, please check documentation",
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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

              let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
              errorsUtil.errorResponse({ res, message, statusCode, error });
            });
        }
      });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
  getOutOfRange: (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
  getIncorrectValues: (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
  getThingsOff: (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
  getDueMaintenance: (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

module.exports = transform;
