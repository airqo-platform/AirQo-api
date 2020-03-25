const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channels = require("../models/Channel");
const Feed = require("../models/Feed");
const DeviceGPS = require("../models/DeviceGPSValues");

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const data = {
  getLocationDetails: async (req, res) => {
    try {
      const cods = await DeviceGPS.find({ channel_id: req.params.id });
      return res.status(HTTPStatus.OK).json(cods);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  updateLocationDetails: async (req, res) => {
    try {
      let filter = { channel_id: req.params.id };
      let update = {
        latitude: req.params.latitude,
        longitude: req.params.longitude
      };
      let feedback = await DeviceGPS.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        rawResult: true
      });

      return res.status(HTTPStatus.OK).json();
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  insertLocationDetails: async (req, res) => {
    try {
      const cods = new DeviceGPS(req.body);
      cods.save((error, savedData) => {
        if (error) {
          return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json(error);
        } else {
          return res.status(HTTPStatus.OK).json(savedData);
        }
      });
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  deleteLocationDetails: async (req, res) => {
    try {
      let filter = { channel_id: req.params.id };
      DeviceGPS.deleteOne(filter, err => {
        if (err) {
          return handleError(err);
        } else {
          return res.status(HTTPStatus.OK);
        }
      });
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  storeChannels: async (req, res) => {
    const api_url_channels = `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`;
    let fetch_response = await fetch(api_url_channels);
    let json = await fetch_response.json();
    res.status(200).send(json);
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
      let entry = json.channel.last_entry_id;
      let feed = await json.feeds.filter(obj => {
        return obj.entry_id === entry;
      });

      if (feed[0].field5 === 0.0 || feed[0].field6 === 0.0) {
        //get the device's stored GPS values and return them
      } else {
        res.status(200).json(feed[0]);
      }
    } catch (e) {
      res.status(501).send(e.message);
    }
  },

  weatherForecasts: async (req, res) => {
    const lat = req.params.lat;
    const lon = req.params.lon;

    try {
    } catch (error) {}
  }
};

module.exports = data;
