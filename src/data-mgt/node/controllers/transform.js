const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channel = require("../models/Channel");
const Feed = require("../models/Feed");
const axios = require("axios");
const redis = require("../config/redis");
const MaintenanceLog = require("../models/MaintenanceLogs");
const Issue = require("../models/Issue");
const { getFieldLabel } = require("../utils/mappings");
const { generateDateFormat } = require("../utils/date");
const constants = require("../config/constants");
const { gpsCheck } = require("../utils/gps-check");

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const data = {
  getChannels: async (req, res) => {
    console.log("getting channels..............  ");
    let ts = Date.now();
    let day = await generateDateFormat(ts);
    let cacheID = `channels_${day}`;
    console.log("the cache ID ", cacheID);

    redis.get(cacheID, (err, result) => {
      if (result) {
        const resultJSON = JSON.parse(result);
        return res.status(HTTPStatus.OK).json(resultJSON);
      } else {
        axios
          .get(constants.GET_CHANNELS)
          .then((response) => {
            const responseJSON = response.data;
            redis.set(
              cacheID,
              JSON.stringify({ message: "from the cache", ...responseJSON })
            );
            return res
              .status(HTTPStatus.OK)
              .json({ message: "from the API", ...responseJSON });
          })
          .catch((err) => {
            return res.json(err);
          });
      }
    });
  },
  getFeeds: async (req, res) => {
    console.log("getting feeds..............  ");
    const fetch_response = await fetch(constants.GET_FEEDS(req.params.ch_id));
    const json = await fetch_response.json();
    res.status(200).send(json);
  },

  getLastEntry: async (req, res) => {
    console.log("getting last entry..............  ");
    try {
      const fetch_response = await fetch(
        constants.GENERATE_LAST_ENTRY(channel)
      );

      console.log(
        "the symbols attached to this object ",
        Object.getOwnPropertySymbols(fetch_response)
      );

      console.log(
        `the content of the "Response internals" Symbol `,
        fetch_response[Object.getOwnPropertySymbols(fetch_response)[1]]
      );

      const response_internals =
        fetch_response[Object.getOwnPropertySymbols(fetch_response)[1]];

      /****
       * if the status from TS is not 200, please return appropriate error response
       */
      if (response_internals.status !== 200) {
        res.status(response_internals.status).send({
          success: false,
          message: `no events/feeds are present for this device`,
          statusText: response_internals.statusText,
        });
      } else {
        let json = await fetch_response.json();
        let response = {};
        response.metadata = json.channel;
        let entry = json.channel.last_entry_id;
        let feed = await json.feeds.filter((obj) => {
          return obj.entry_id === entry;
        });
        response = feed[0];
        const channel = await Channel.findOne({
          channel_id: Number(req.params.ch_id),
        }).exec();
        console.log("feeds from TS: ", response);
        console.log("channel ID from request: ", req.params.ch_id);
        if (feed[0].field6 == 0.0 || feed[0].field5 == 0.0) {
          if (channel) {
            console.log("the channel details: ", channel._doc);
            console.log("type of channel: ", typeof channel._doc);
            response.field5 = channel._doc.latitude.toString();
            console.log("latitude: ", channel._doc.latitude.toString());
            response.field6 = channel._doc.longitude.toString();
            console.log("longitude: ", channel._doc.longitude.toString());
          } else {
            res.status(401).send({
              success: false,
              message: `Innacurate GPS sensor readings and there are no recorded cordinates to use`,
            });
          }
        } else if (feed[0].field6 == 1000.0 || feed[0].field5 == 1000.0) {
          if (channel) {
            console.log("the channel details: ", channel._doc);
            console.log("type of channel: ", typeof channel._doc);
            response.field5 = channel._doc.latitude.toString();
            console.log("latitude: ", channel._doc.latitude.toString());
            response.field6 = channel._doc.longitude.toString();
            console.log("longitude: ", channel._doc.longitude.toString());
          } else {
            res.status(HTTPStatus.BAD_REQUEST).send({
              success: false,
              message: `Innacurate GPS sensor readings and there are no recorded cordinates to use`,
            });
          }
        }
        res.status(200).json(response);
      }
    } catch (e) {
      res
        .status(501)
        .send({ success: false, message: "server error", error: e.message });
    }
  },

  hourly: async (req, res) => {
    console.log("getting hourly..............  ");
    try {
      let fetch_response = await fetch(
        constants.GET_HOURLY_FEEDS(req.params.ch_id)
      );
      let json = await fetch_response.json();
      res.status(HTTPStatus.OK).send(json);
    } catch (error) {
      res.status(HTTPStatus.BAD_GATEWAY).send(error.message);
    }
  },

  generateDescriptiveLastEntry: async (req, res) => {
    console.log("generateDescriptiveLastEntry..............  ");
    try {
      const { chid } = req.query;
      console.log("the channel ID:", chid);
      if (chid) {
        axios
          .get(constants.GENERATE_LAST_ENTRY(chid))
          .then(async (response) => {
            let readings = response.data;

            let lastEntryId = readings.channel.last_entry_id;
            let recentReadings = await readings.feeds.filter((item) => {
              return item.entry_id === lastEntryId;
            });

            //check the GPS values
            let { lat, lon } = gpsCheck(...recentReadings[0], req, res);
            let responseData = {
              ...recentReadings[0],
            };
            responseData.field5 = lat;
            responseData.field6 = long;

            //  * afterwards, transform its content to something more relatable using the ctypes

            // transformedData = {
            //   getFieldLabel(`${responseData.field1}`): `${responseData.field1}`
            // }

            res.status(HTTPStatus.OK).json({
              ...responseData,
            });
          })
          .catch((error) => {
            if (error.response) {
              // that falls out of the range of 2xx
              console.log(error.response.data);
              console.log(error.response.status);
              console.log(error.response.headers);
              res.status(HTTPStatus.BAD_GATEWAY).json({
                success: false,
                error: error.response.data,
              });
            } else if (error.request) {
              // The request was made but no response was received
              console.log(error.request);
              res.status(HTTPStatus.BAD_GATEWAY).json({
                success: false,
                error: error.request,
              });
            } else {
              // Something happened in setting up the request that triggered an Error
              console.log("Error", error.message);
              res.status(HTTPStatus.BAD_GATEWAY).json({
                success: false,
                error: error.message,
              });
            }
            console.log(error.config);
          });
      } else {
        res.status(HTTPStatus.BAD_REQUEST).send({
          success: false,
          message: "misssing request parameters, please check documentation",
        });
      }
    } catch (e) {
      res
        .status(HTTPStatus.BAD_GATEWAY)
        .send({ success: false, message: "server error", error: e.message });
    }
  },
  getChannelLastEntryAge: async (req, res) => {
    console.log(" getChannelLastEntryAge..............  ");
    try {
      const { channel } = req.query;
      console.log("the channel ID:", channel);
      let ts = Date.now();
      let day = await generateDateFormat(ts);
      let cacheID = `${channel.trim()}_${day}`;
      console.log("the cache ID", cacheID);
      return redis.get(cacheID, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(HTTPStatus.OK).json({
            message: "from the cache",
            ...resultJSON,
          });
        } else {
          return axios
            .get(constants.GET_CHANNEL_LAST_ENTRY_AGE(channel))
            .then((response) => {
              const responseJSON = response.data;
              redis.set(
                cacheID,
                JSON.stringify({ channel: channel, ...responseJSON })
              );
              return res.status(HTTPStatus.OK).json({
                message: "from the API",
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
    console.log(" getLastFieldEntryAge..............  ");
    try {
      const { channel, field } = req.query;

      if (channel && field) {
        let ts = Date.now();
        let day = await generateDateFormat(ts);
        let cacheValue = `${channel.trim()}_${field.trim()}_${day}`;
        console.log("the cache value: ", cacheValue);

        return redis.get(`${cacheValue}`, (err, result) => {
          if (result) {
            const resultJSON = JSON.parse(result);
            return res
              .status(HTTPStatus.OK)
              .json({ message: "from the cache", ...resultJSON });
          } else {
            return axios
              .get(constants.GET_LAST_FIELD_ENTRY_AGE(channel, field))
              .then((response) => {
                const responseJSON = response.data;
                redis.set(`${cacheValue}`, JSON.stringify({ ...responseJSON }));
                return res.status(HTTPStatus.OK).json({
                  message: "from the API",
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
      let cacheValue = `device_count_${day}`;
      console.log("the cache value: ", cacheValue);
      return redis.get(`${cacheValue}`, (err, result) => {
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(200).json(resultJSON);
        } else {
          return axios
            .get(constants.API_URL_CHANNELS)
            .then((response) => {
              const responseJSON = response.data;
              let count = Object.keys(responseJSON).length;
              redis.set(
                `${cacheValue}`,
                JSON.stringify({ message: "from the cache", count })
              );
              // Send JSON response to redis
              return res.status(200).json({ message: "from the API", count });
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
