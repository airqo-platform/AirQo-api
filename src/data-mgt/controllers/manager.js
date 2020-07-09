const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channels = require("../models/Channel");
const Feed = require("../models/Feed");
const axios = require("axios");
const redis = require("../config/redis");
const MaintenanceLog = require("../models/MaintenanceLogs");
const Issue = require("../models/Issue");

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const data = {
  getLocationDetails: (req, res) => {
    /*** we can check the entry age of this field
     * and then be able to send alerts accordingly
     */
  },

  storeChannels: async (req, res) => {
    const query = req.query.query.trim();
    const api_url_channels = `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`;

    return redis.get(`channels:${query}`, (err, result) => {
      // If that key exist in Redis store
      if (result) {
        const resultJSON = JSON.parse(result);
        return res.status(200).json(resultJSON);
      } else {
        // Key does not exist in Redis store
        return axios
          .get(api_url_channels)
          .then((response) => {
            const responseJSON = response.data;
            // Save the API response in Redis store
            redis.setex(
              `channels:${query}`,
              3600,
              JSON.stringify({ source: "Redis Cache", ...responseJSON })
            );
            // Send JSON response to redis
            return res
              .status(200)
              .json({ source: "Channels API", ...responseJSON });
          })
          .catch((err) => {
            return res.json(err);
          });
      }
    });
  },
  storeFeeds: async (req, res) => {
    const api_url = `https://api.thingspeak.com/channels/${req.params.ch_id}/feeds.json`;
    const fetch_response = await fetch(api_url);
    const json = await fetch_response.json();
    res.status(200).send(json);
  },

  getLastEntry: async (req, res) => {
    try {
      const api_url = `https://api.thingspeak.com/channels/${req.params.ch_id}/feeds.json`;
      let fetch_response = await fetch(api_url);
      let json = await fetch_response.json();
      let response = {};
      response.metadata = json.channel;
      let entry = json.channel.last_entry_id;
      let feed = await json.feeds.filter((obj) => {
        return obj.entry_id === entry;
      });
      response.feed = feed[0];
      res.status(200).json(response);
    } catch (e) {
      res.status(501).send(e.message);
    }
  },

  hourly: async (req, res) => {
    try {
      const api_url = `https://us-central1-airqo-250220.cloudfunctions.net/get_hourly_channel_data?channel_id=${req.params.ch_id}`;
      let fetch_response = await fetch(api_url);
      let json = await fetch_response.json();
      res.status(200).send(json);
    } catch (error) {
      res.status(501).send(error.message);
    }
  },

  storeAlerts: async (req, res) => {
    try {
    } catch (error) {}
  },

  getChannelLastEntryAge: async (req, res) => {
    try {
      const query = req.query.query.trim();
      const url = `https://api.thingspeak.com/channels/${req.query.channel}/feeds/last_data_age.json`;
      return redis.get(`channelLastEntryAge:${query}`, (err, result) => {
        // If that key exist in Redis store
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(200).json(resultJSON);
        } else {
          // Key does not exist in Redis store
          return axios
            .get(url)
            .then((response) => {
              const responseJSON = response.data;
              // Save the API response in Redis store
              redis.setex(
                `channelLastEntryAge:${query}`,
                3600,
                JSON.stringify({ source: "Redis Cache", ...responseJSON })
              );
              // Send JSON response to redis
              return res.status(200).json({
                source: "channel last entry age API",
                ...responseJSON,
              });
            })
            .catch((err) => {
              return res.json(err);
            });
        }
      });
    } catch (e) {
      res.status(500).json(e);
    }
  },

  getLastFieldEntryAge: async (req, res) => {
    try {
      const query = req.query.query.trim();
      const url = `https://api.thingspeak.com/channels/${req.query.channel}/fields/${req.query.field}/last_data_age.json`;
      return redis.get(`channelLastEntryAge:${query}`, (err, result) => {
        // If that key exist in Redis store
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(200).json(resultJSON);
        } else {
          // Key does not exist in Redis store
          return axios
            .get(url)
            .then((response) => {
              const responseJSON = response.data;
              // Save the API response in Redis store
              redis.setex(
                `channelLastEntryAge:${query}`,
                3600,
                JSON.stringify({ source: "Redis Cache", ...responseJSON })
              );
              // Send JSON response to redis
              return res.status(200).json({
                source: "channel last entry age API",
                ...responseJSON,
              });
            })
            .catch((err) => {
              return res.json(err);
            });
        }
      });
    } catch (e) {
      res.status(500).json(e);
    }
  },

  getDeviceCount: async (req, res) => {
    try {
      const query = req.query.query.trim();
      const api_url_channels = `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`;

      return redis.get(`channels:${query}`, (err, result) => {
        // If that key exist in Redis store
        if (result) {
          const resultJSON = JSON.parse(result);
          return res.status(200).json(resultJSON);
        } else {
          // Key does not exist in Redis store
          return axios
            .get(api_url_channels)
            .then((response) => {
              const responseJSON = response.data;
              /***lets get the count */
              let count = Object.keys(responseJSON).length;
              // Save the API response in Redis store
              redis.setex(
                `channels:${query}`,
                3600,
                JSON.stringify({ source: "Redis Cache", count })
              );
              // Send JSON response to redis
              return res.status(200).json({ source: "Channels API", count });
            })
            .catch((err) => {
              return res.json(err);
            });
        }
      });
    } catch (e) {
      res.status(500).json(e);
    }
  },

  maintain: async (req, res) => {
    try {
    } catch (e) {}
  },

  getMaintenanceLogs: async (req, res) => {
    try {
      const logs = await MaintenanceLog.find(req.query);
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: "Logs fetched successfully",
        logs,
      });
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ success: false, message: "Some Error" });
    }
  },

  addMaintenanceLog: async (req, res) => {
    const log = new MaintenanceLog(req.body);
    log.save((error, savedLog) => {
      if (error) {
        return console.log(error);
      } else {
        res.status(200).json({
          savedLog,
          success: true,
          message: "log added successfully",
        });
      }
    });
  },

  getIssues: async (req, res) => {
    try {
      const logs = await Issue.find(req.query);
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: "Issues fetched successfully",
        logs,
      });
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ success: false, message: "Some Error" });
    }
  },

  addIssue: async (req, res) => {
    const log = new Issue(req.body);
    log.save((error, savedIssue) => {
      if (error) {
        return console.log(error);
      } else {
        res.status(200).json({
          savedIssue,
          success: true,
          message: "issue added successfully",
        });
      }
    });
  },

  getOutOfRange: () => {},

  getIncorrectValues: () => {},

  getThingsOff: () => {},

  getDueMaintenance: () => {},
};

module.exports = data;
