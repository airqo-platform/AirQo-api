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

// Fixed hybrid logObject function
const logObject = (message, object) => {
  if (
    constants.ENVIRONMENT &&
    constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT"
  ) {
    // Check if we have only one meaningful parameter
    // (either 1 argument OR 2 arguments but second is undefined/null)
    if (arguments.length === 1 || object == null) {
      console.log(message);
    }
    // If two parameters provided AND second parameter has a meaningful value
    else {
      console.log(message + ": ");
      console.dir(object);
    }
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
