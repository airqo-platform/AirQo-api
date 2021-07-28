const logText = (message) => {
  if (process.env.NODE_ENV === "development") {
    console.log(message);
  }
  return "log deactivated in prod and stage";
};

const logElement = (message, body) => {
  if (process.env.NODE_ENV === "development") {
    console.log(message + ": " + body);
  }
  return "log deactivated in prod and stage";
};

const logObject = (message, object) => {
  if (process.env.NODE_ENV === "development") {
    console.log(message + ": ");
    console.dir(object);
  }
  return "log deactivated in prod and stage";
};

module.exports = { logText, logElement, logObject };
