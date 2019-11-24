const HTTPStatus = require('http-status');
const fetch = require('node-fetch');
const request = require('request');
const Channels = require('../models/Channel');
const Feed = require('../models/Feed');

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const forecast = {

    forecast: (req, res) => {
        let payload = req.body;
        let forecast = {
            "PM2.5": 132,
            "PM10": 234,
            "location": {
                "longitude": payload.location.longitude,
                "latitude": payload.location.latitude,
            },
            "type": payload.type,
            "units": payload.units
        }
        res.json(forecast);
    },

    getLocationDetails: (req, res) => {
        let lat = req.body.lat;
        let lon = req.body.lon;
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
            let feed = await json.feeds.filter((obj) => {
                return obj.entry_id === entry;
            });
            res.status(200).json(feed[0]);
        }
        catch (e) {
            res.status(501).send(e.message);
        }
    }
}

module.exports = forecast;