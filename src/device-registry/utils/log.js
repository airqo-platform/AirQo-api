const logObject = (text, body) => {
  console.log(text + ":");
  console.dir(body);
};

const logText = (text, body) => {
  console.log(text + ": " + body);
};

const logSingleText = (text) => {
  console.log(text);
};

module.exports = { logObject, logText, logSingleText };
