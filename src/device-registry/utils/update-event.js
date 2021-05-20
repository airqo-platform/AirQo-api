const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const axios = require("axios");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const EventSchema = require("../models/Event");
const { getModelByTenant } = require("./multitenancy");
const redis = require("../config/redis");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("./errors");
const { generateDateFormatWithoutHrs } = require("./date");

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

const clearData = async () => {};

const clearDataOnPlatform = async () => {};

const clearDataOnThingSpeak = async (req, res) => {
  try {
    const { device, tenant } = req.query;

    if (tenant) {
      if (!device) {
        res.status(HTTPStatus.BAD_REQUEST).json({
          message:
            "please use the correct query parameter, check API documentation",
          success: false,
        });
      }
      const deviceDetails = await getDetailsOnPlatform(tenant, device);
      const doesDeviceExist = !isEmpty(deviceDetails);
      logElement("isDevicePresent ?", doesDeviceExist);
      if (doesDeviceExist) {
        const channelID = deviceDetails[0].channelID;
        const deviceID = deviceDetails[0].id;
        logElement("the channel ID", channelID);
        logElement("the device ID", deviceID);
        logText("...................................");
        logText("clearing the Thing....");
        logElement("url", constants.CLEAR_THING_URL(channelID));
        await axios
          .delete(constants.CLEAR_THING_URL(channelID))
          .then(async (response) => {
            logText("successfully cleared the device in TS");
            logObject("response from TS", response.data);
            res.status(HTTPStatus.OK).json({
              message: `successfully cleared the data for device ${device}`,
              success: true,
              channelID,
              deviceID,
            });
          })
          .catch(function(error) {
            console.log(error);
            res.status(HTTPStatus.BAD_GATEWAY).json({
              message: `unable to clear the device data, device ${device} does not exist`,
              success: false,
            });
          });
      } else {
        logText(`device ${device} does not exist in the system`);
        res.status(HTTPStatus.OK).json({
          message: `device ${device} does not exist in the system`,
          success: false,
        });
      }
    } else {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "missing query params, please check documentation",
      });
    }
  } catch (e) {
    logText(`unable to clear device ${device}`);
    tryCatchErrors(res, e);
  }
};

module.exports = {
  clearDataOnThingSpeak,
  clearDataOnPlatform,
  clearData,
  transformMeasurements,
  transformMeasurementFields,
};
