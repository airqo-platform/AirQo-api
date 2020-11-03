const { Schema, model } = require('mongoose');
const ObjectId = Schema.Types.ObjectId;

const hourSchema = new Schema(
    {
        time: { type: Date },
        summary: { type: String },
        icon: { type: String },
        precipIntensity: { type: Number },
        precipProbability: { type: Number },
        precipType: { type: String },
        temperature: { type: Number },
        apparentTemperature: { type: Number },
        dewPoint: { type: Number },
        humidity: { type: Number },
        pressure: { type: Number },
        windSpeed: { type: Number },
        windGust: { type: Number },
        windBearing: { type: Number },
        cloudCover: { type: Number },
        uvIndex: { type: Number },
        visibility: { type: Number },
        ozone: { type: Number }
    }
);

const hour = model("hour", hourSchema);

const daySchema = newSchema(
    {
        time: { type: Date },
        summary: { type: String },
        icon: { type: String },
        sunriseTime: { type: Number },
        sunsetTime: { type: Number },
        moonPhase: { type: Number },
        precipIntensity: { type: Number },
        precipIntensityMax: { type: Number },
        precipIntensityMaxTime: { type: Number },
        precipProbability: { type: Number },
        precipType: { type: Number },
        temperatureHigh: { type: Number },
        temperatureHighTime: { type: Number },
        temperatureLow: { type: Number },
        temperatureLowTime: { type: Number },
        apparentTemperatureHigh: { type: Number },
        apparentTemperatureHighTime: { type: Number },
        apparentTemperatureLow: { type: Number },
        apparentTemperatureLowTime: { type: Number },
        dewPoint: { type: Number },
        humidity: { type: Number },
        pressure: { type: Number },
        windSpeed: { type: Number },
        windGust: { type: Number },
        windGustTime: { type: Number },
        windBearing: { type: Number },
        cloudCover: { type: Number },
        uvIndex: { type: Number },
        uvIndexTime: { type: Number },
        visibility: { type: Number },
        ozone: { type: Number },
        temperatureMin: { type: Number },
        temperatureMinTime: { type: Number },
        temperatureMax: { type: Number },
        temperatureMaxTime: { type: Number },
        apparentTemperatureMin: { type: Number },
        apparentTemperatureMinTime: { type: Number },
        apparentTemperatureMax: { type: Number },
        apparentTemperatureMaxTime: { type: Number }

    });

const day = model("day", daySchema);

const weatherSchema = new Schema({
    created_at: { type: Date },
    longitude: {},
    latitude: {},
    historical: {
        hourly: [{ type: ObjectId, ref: 'hour' }],
        daily: [{ type: ObjectId, ref: 'day' }]
    }
});

const weather = model("weather", weatherSchema);

module.exports = { weather: weather, hour: hour, day: day };