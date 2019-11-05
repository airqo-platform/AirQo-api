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


    },

    feeds: (req, res) => {


    }
}

module.exports = forecast;