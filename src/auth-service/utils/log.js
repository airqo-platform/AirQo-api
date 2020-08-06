const logText = (message) => {
  console.log(message);
};

const logElement = (message, body) => {
  console.log(`${message}` + ": " + `${body}`);
};

const logObject = (message, object) => {
  console.log(`${message} +": "`);
  console.dir(`${object}`);
};

module.exports = { logText, logElement, logObject };
