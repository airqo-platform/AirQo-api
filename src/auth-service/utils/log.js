const logText = (message) => {
  console.log(message);
};

const logLongText = (message, body) => {
  console.log(`${message}` + ": " + `${body}`);
};

const logObject = (message, object) => {
  console.log(`${message} +": "`);
  console.log(`${object}`);
};

module.exports = { logText, logLongText, logObject };
