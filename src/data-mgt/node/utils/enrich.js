const constants = require("../config/constants");
const axios = require("axios");
const { logElement, logText, logObject } = require("./log");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

const calibrate = (value) => {
  try {
    let url = constants.GET_CALIBRATION(value);
    logElement("the url", url);
    axios
      .get(url)
      .then((response) => {
        const { data } = response;
        logObject("the data from axios in calibrate", data);
        const { calibratedValue, PerformanceEvaluation } = data;
        logElement("calibratedValue from axios", calibratedValue);
        return calibratedValue[0];
      })
      .catch((e) => {
        logElement("API request error", e.message);
      });
  } catch (e) {
    logElement("server error", e.message);
  }
};

module.exports = { calibrate };
