const Forecast = require('../models/Forecast');
const HTTPStatus = require('http-status');
const fetch = require('node-fetch');
const getData = require('../utils/get-data');
const request = require('request');
const Channels = require('../models/Channel');

const headers = {
    "Content-Type": "application/json",
}

const forecast = {

    forecast: (req, res) => {

        let payload = req.body;

        let forecast = {
            "PM2.5": 132,
            "pm10": 234,
            "longitude": payload.location.longitude,
            "latitude": payload.location.latitude,
            "type": payload.type,
            "units": payload.units
        }

        res.json(forecast);
    },

    channels: (req, res) => {

        var headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        var dataString = {
        };

        jsonData = JSON.stringify(dataString);

        var options = {
            url: `https://api.thingspeak.com/channels.json?api_key=${process.env.THINGSPEAK_API}`,
            method: 'GET',
            headers: headers,
        };

        function callback(error, response, body) {
            if (error) {
                throw error;
            } else {
                let resp = {};
                console.log(body);
                console.log(response);
                resp.success = true;
                resp.message = "Payment Initited"
                res.status(200).send(resp);
            }
        }
        request(options, callback);
    },

    feeds: (req, res) => {
        //get the feed of a channel.
        fetch(url, { method: 'GET', headers: headers })
            .then((res))

    }
}

module.exports = forecast;