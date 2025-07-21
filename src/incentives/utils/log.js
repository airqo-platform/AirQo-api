const logText = (message) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(message);
  }
  return;
};

const logElement = (message, body) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(message + ": " + body);
  }
  return;
};

const logObject = (message, object) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(message + ": ");
    console.dir(object);
  }
  return;
};

module.exports = { logText, logElement, logObject };
