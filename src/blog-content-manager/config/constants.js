const environments = require("./environments");
const global = require("./global");

function envConfig(env) {
  return { ...global, ...environments[env] };
}
const environment = process.env.NODE_ENV || "production";
module.exports = envConfig(environment);
