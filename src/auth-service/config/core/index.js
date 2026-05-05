const dbProjections = require("./db-projections");
const envs = require("./envs");
const mappings = require("./mappings");
const numericals = require("./numericals");
const staticLists = require("./static-lists");
const emailTemplates = require("./email-templates");
const permissions = require("./permissions");

const configurations = {
  ...dbProjections,
  ...permissions,
  ...envs,
  ...mappings,
  ...numericals,
  ...staticLists,
  ...emailTemplates,
};

module.exports = configurations;
