const appConstants = require("./app-constants");
const aqiConstants = require("./aqi");
const { getFlagUrl, countryCodes } = require("./country-flags");
const dbProjections = require("./db-projections");
const envs = require("./envs");
const mappings = require("./mappings");
const networksConfig = require("./networks");
const urls = require("./urls");

const configurations = {
  ...appConstants,
  ...aqiConstants,
  getFlagUrl,
  countryCodes,
  ...dbProjections,
  ...envs,
  ...mappings,
  ...networksConfig,
  ...urls,
};

module.exports = configurations;
