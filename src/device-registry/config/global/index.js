const dbProjections = require("./db-projections");
const envs = require("./envs");
const aqiConstants = require("./aqi");
const mappings = require("./mappings");
const numericals = require("./numericals");
const queryLimits = require("./query-limits");
const regexPatterns = require("./regex-patterns");
const staticLists = require("./static-lists");
const strings = require("./strings");
const urls = require("./urls");
const { getFlagUrl, countryCodes } = require("./country-flags");

const configurations = {
  ...dbProjections,
  getFlagUrl,
  countryCodes,
  ...envs,
  ...mappings,
  ...aqiConstants,
  ...numericals,
  ...queryLimits,
  ...regexPatterns,
  ...staticLists,
  ...strings,
  ...urls,
};

module.exports = configurations;
