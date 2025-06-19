const environments = require("./environments");
const global = require("./global");
const { EnvOnlyValidator } = require("../utils/validation-reporter");

const environment = process.env.NODE_ENV || "production";

function envConfig(env) {
  const config = { ...global, ...environments[env] };

  // Minimal validation - only shows problems
  const validator = new EnvOnlyValidator(env);

  if (env === "development") {
    console.log("🔍 Environment Validation Check...");
    validator.validateMinimal(config);
  } else {
    validator.validateMinimal(config);
  }

  return config;
}

module.exports = envConfig(environment);
