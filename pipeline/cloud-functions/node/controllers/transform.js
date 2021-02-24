const axios = require("axios");

const constants = ({
  GET_CHANNELS_TS_URI,
  MOST_RECENT_FEEDS_API,
  SINGLE_INSERT_PARTIAL_API,
  DEVICE_REGITRY_BASE_URL,
  SAMPLE_FILE,
  SINGLE_INSERT_PARTIAL,
  DEVICE_REGISTRY_PROD_BASE_URI,
  DEVICE_REGISTRY_STAGE_BASE_UR,
  GET_RECENT_FEEDS,
} = require("../config/constants"));

const transformField = (field) => {
  try {
    switch (field) {
      case "field1":
        return "pm2_5";
      case "field2":
        return "pm10";
      case "field3":
        return "s2_pm2_5";
      case "field4":
        return "s2_pm10";
      case "field5":
        return "latitude";
      case "field6":
        return "longitude";
      case "field7":
        return "battery";
      case "field8":
        return "GpsData";
      default:
        return field;
    }
  } catch (e) {
    console.log(e.message);
  }
};

const transformMeasurements = (measurement) => {
  try {
    Object.entries(measurement).map(([field, value]) => {
      console.log(`${transformField(field)} : ${value}`);
    });
  } catch (e) {
    console.log(e.message);
  }
};

const generateMeasurementUnit = (key) => {
  try {
    switch (key) {
      case "humidity":
        return "grams per kg";
      case "temperature":
        return "degree celsius";
      case "battery":
        return "volts";
      case "s2_pm10":
        return "ug/m3";
      case "s2_pm2_5":
        return "ug/m3";
      case "pm10":
        return "ug/m3";
      case "pm2_5":
        return "ug/m3";
      default:
        return "unknown";
    }
  } catch (e) {
    console.log(e.message);
  }
};

const generateQuantityKind = (key) => {
  try {
    switch (key) {
      case "humidity":
        return "humidity";
      case "temperature":
        return "temperature";
      case "battery":
        return "voltage";
      case "s2_pm10":
        return "particulate matter";
      case "s2_pm2_5":
        return "particulate matter";
      case "pm10":
        return "particulate matter";
      case "pm2_5":
        return "particulate matter";
      default:
        return "unknown";
    }
  } catch (e) {
    console.log(e.message);
  }
};

const prepareRequest = (ctype, value, frequency, time) => {
  try {
    const deviceValue = {
      value: value,
      raw: value,
      weight: 1,
      frequency: frequency,
      calibratedValue: 24,
      time: time,
      uncertaintyValue: 23,
      standardDeviationValue: 23,
      measurement: {
        quantityKind: generateQuantityKind(ctype),
        measurementUnit: generateMeasurementUnit(ctype),
      },
    };
    return deviceValue;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = {
  prepareRequest,
  generateMeasurementUnit,
  generateQuantityKind,
  transformMeasurements,
  transformField,
};
