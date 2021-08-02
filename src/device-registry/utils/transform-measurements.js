const { generateDateFormat, generateDateFormatWithoutHrs } = require("./date");
const { logElement, logObject, logText } = require("./log");

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

const transformMeasurements_v2 = async (measurements) => {
  try {
    logText("we are transforming version 2....");
    let promises = measurements.map(async (measurement) => {
      try {
        let time = measurement.time;
        const day = generateDateFormatWithoutHrs(time);
        let data = {
          day: day,
          ...measurement,
        };
        return data;
      } catch (e) {
        console.log("the error: ", e.message);
        return {
          success: false,
          message: "server side error",
          error: e.message,
        };
      }
    });
    return Promise.all(promises).then((results) => {
      if (results.every((res) => res.success)) {
        return {
          success: true,
          data: results,
        };
      } else {
        return {
          success: true,
          data: results,
        };
      }
    });
  } catch (error) {
    return {
      success: false,
      message: "unable to transform measurement",
      error: error.message,
    };
  }
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

// ref : https://gist.github.com/JamieMason/0566f8412af9fe6a1d470aa1e089a752
const groupMeasurementsBy = key => array =>
  array.reduce(
      (objectsByKeyValue, obj) => ({
        ...objectsByKeyValue,
        [obj[key]]: (objectsByKeyValue[obj[key]] || []).concat(obj)
      }), {});

module.exports = {
  transformMeasurements,
  transformMeasurementFields,
  transformMeasurements_v2,
  groupMeasurementsBy
};
