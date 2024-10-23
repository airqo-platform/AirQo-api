const moment = require("moment");

const logText = (message) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(message);
  }
  return "log deactivated in prod and stage";
};

const logElement = (message, body) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(message + ": " + body);
  }
  return "log deactivated in prod and stage";
};

const logObject = (message, object) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(message + ": ");
    console.dir(object);
  }
  return "log deactivated in prod and stage";
};

const logError = (error) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("an unhandled promise rejection" + ": ");
    console.error(error);
  }
  return "log deactivated in prod and stage";
};

const logTextWithTimestamp = (message) => {
  console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] ${message}`);
};

module.exports = {
  logText,
  logTextWithTimestamp,
  logElement,
  logObject,
  logError,
};
