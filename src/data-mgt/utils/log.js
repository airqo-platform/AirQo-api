const logText = (message) => {
  // console.log(message);
  if (process.env.NODE_ENV !== "production") {
    console.log(message);
  }
  return "log deactivated in prod and stage";
};

const logElement = (message, body) => {
  // console.log(message + ": " + body);
  if (process.env.NODE_ENV !== "production") {
    console.log(message + ": " + body);
  }
  return "log deactivated in prod and stage";
};

const logObject = (message, object) => {
  // console.log(message + ": ");
  // console.dir(object);
  if (process.env.NODE_ENV !== "production") {
    console.log(message + ": ");
    console.dir(object);
  }
  return "log deactivated in prod and stage";
};

const logError = (error) => {
  // console.log("an unhandled promise rejection" + ": ");
  // console.error(e);
  if (process.env.NODE_ENV !== "production") {
    console.log("an unhandled promise rejection" + ": ");
    console.error(error);
  }
  return "log deactivated in prod and stage";
};

module.exports = { logText, logElement, logObject, logError };
