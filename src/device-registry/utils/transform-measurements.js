const { generateDateFormat, generateDateFormatWithoutHrs } = require("./date");
const { logElement, logObject } = require("./log");

const transformMeasurements = (device, measurements) => {
  let promises = measurements.map(async (measurement) => {
    try {
      let time = measurement.time;
      const day = generateDateFormatWithoutHrs(time);
      return {
        device: device,
        day: day,
        ...measurement,
        success: true,
      };
    } catch (e) {
      console.log("the error: ", e.message);
      return {
        device: device,
        success: false,
        message: e.message,
      };
    }
  });
  return Promise.all(promises).then((results) => {
    if (results.every((res) => res.success)) {
      return results;
    } else {
      console.log("the results for no success", results);
    }
  });
};

const createString = () => {};

const transformField = (field) => {
  try {
    switch (field) {
      case "pm2_5":
        return "field1";
      case "pm10":
        return "field2";
      case "s2_pm2_5":
        return "field3";
      case "s2_pm10":
        return "field4";
      case "latitude":
        return "field5";
      case "longitude":
        return "field6";
      case "battery":
        return "field7";
      case "others":
        return "field8";
      case "time":
        return "created_at";
      case "elevation":
        return "elevation";
      case "status":
        return "status";
      default:
        return field;
    }
  } catch (e) {
    console.log(e.message);
  }
};

const transformMeasurementFields = async (measurements) => {
  try {
    logObject("the measurements", measurements);
    let transform = [];
    measurements.forEach((field, value) => {
      transform[transformField(field)] = value;
    });
    return transform;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = { transformMeasurements, transformMeasurementFields };
