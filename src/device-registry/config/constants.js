const environments = require("./environments");
const global = require("./global");

function envConfig(env) {
  return { ...global, ...environments[env] };
}

module.exports = envConfig(process.env.NODE_ENV);
