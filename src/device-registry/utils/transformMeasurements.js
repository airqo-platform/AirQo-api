const {
  getApiKeys,
  getArrayLength,
  generateDateFormat,
  doesDeviceExist,
  doesComponentExist,
  doesComponentTypeExist,
} = require("./componentControllerHelpers");

const transformMeasurements = (device, measurements) => {
  let promises = measurements.map(async (measurement) => {
    try {
      let time = measurement.time;
      const day = await generateDateFormat(time);
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

module.exports = transformMeasurements;
