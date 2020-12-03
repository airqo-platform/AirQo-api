const logObject = (text, body) => {
  console.log(text + ":");
  console.dir(body);
};

const logElement = (text, body) => {
  console.log(text + ": " + body);
};

const logText = (text) => {
  console.log(text);
};

module.exports = { logObject, logText, logElement };
