const development = require("./development");
const production = require("./production");
const staging = require("./staging");

const configurations = {
  development,
  production,
  staging,
};

module.exports = configurations;
