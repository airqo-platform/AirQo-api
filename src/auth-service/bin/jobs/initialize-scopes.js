// @bin/jobs/initialize-scopes.js

const scopeUtil = require("@utils/scope.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- initialize-scopes-job`
);

(async () => {
  try {
    logger.info("Starting scope initialization job...");

    const tenant = constants.DEFAULT_TENANT || "airqo";
    const result = await scopeUtil.initializeDefaultScopes(tenant);

    if (result.success) {
      logger.info(`Scope initialization job completed: ${result.message}`);
    } else {
      logger.error(`Scope initialization job failed: ${result.message}`);
    }
  } catch (error) {
    logger.error(`Error in scope initialization job: ${error.message}`);
  }
})();

module.exports = {};
