const HTTPStatus = require('http-status');
const fetch = require('node-fetch');
const request = require('request');
const Channels = require('../models/Channel');
const Feed = require('../models/Feed');

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
        //there is no need to create a new database
        //just query data from the databse and then make the possible happen.
        const api_url = `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`;
        const fetch_response = await fetch(api_url);
        const json = await fetch_response.json();
        //store these values in a database or memory
        res.status(200).send(json)

    },

    storeFeeds: async (req, res) => {
        const channel_ids = [];
        //carry out the following for each array element
        const api_url = `https://api.thingspeak.com/channels/${req.params.id}/feeds.json`;
        const fetch_response = await fetch(api_url);
        const json = await fetch_response.json();
        res.status(200).send(json);
    }
}

module.exports = forecast;