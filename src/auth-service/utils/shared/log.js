const constants = require("@config/constants");

const logText = (message) => {
  if (
    constants.ENVIRONMENT &&
    constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT"
  ) {
    console.log(message);
  }
  return;
};

const logElement = (message, body) => {
  if (
    constants.ENVIRONMENT &&
    constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT"
  ) {
    console.log(message + ": " + body);
  }
  return;
};

const logObject = (message, object) => {
  if (
    constants.ENVIRONMENT &&
    constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT"
  ) {
    console.log(message + ": ");
    console.dir(object);
  }
  return;
};

const logError = (error) => {
  if (
    constants.ENVIRONMENT &&
    constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT"
  ) {
    console.log("an unhandled promise rejection" + ": ");
    console.error(error);
  }
  return;
};

module.exports = { logText, logElement, logObject, logError };
