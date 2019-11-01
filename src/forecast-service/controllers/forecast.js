const Forecast = require('../models/Forecast');
const HTTPStatus = require('http-status');

const manager = {

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
    }
}

module.exports = manager;