const dbProjections = require("./db-projections");
const envs = require("./envs");
const mappings = require("./mappings");
const numericals = require("./numericals");
const queryLimits = require("./query-limits");
const regexPatterns = require("./regex-patterns");
const staticLists = require("./static-lists");
const strings = require("./strings");
const urls = require("./urls");
const slack = require("./slack");
const xente = require("./xente");

const configurations = {
  ...dbProjections,
  ...envs,
  ...mappings,
  ...numericals,
  ...queryLimits,
  ...regexPatterns,
  ...staticLists,
  ...strings,
  ...urls,
  ...slack,
  ...xente,
};

module.exports = configurations;
