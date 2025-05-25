const {
  HttpError,
  extractErrorsFromRequest,
  BadRequestError,
} = require("./errors");
const {
  logElement,
  logText,
  logObject,
  logTextWithTimestamp,
} = require("./log");

const {
  EnvironmentDetector,
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironment,
  getDetailedInfo,
  resetCache,
} = require("./environment.util");

module.exports = {
  EnvironmentDetector,
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironment,
  getDetailedInfo,
  resetCache,
  HttpError,
  extractErrorsFromRequest,
  logElement,
  BadRequestError,
  logTextWithTimestamp,
  logText,
  logObject,
};
