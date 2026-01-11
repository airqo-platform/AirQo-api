const constants = require("@config/constants");
const LogThrottleModel = require("@models/LogThrottle");
const moment = require("moment-timezone");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- log-throttle-manager`
);

class LogThrottleManager {
  constructor(timezone, maxLogsPerDay = 1) {
    this.environment = constants.ENVIRONMENT;
    this.model = LogThrottleModel(constants.DEFAULT_TENANT);
    this.timezone = timezone || constants.TIMEZONE || "Africa/Kampala";
    this.maxLogsPerDay = maxLogsPerDay;
  }

  async shouldAllowLog(logType) {
    const today = moment()
      .tz(this.timezone)
      .format("YYYY-MM-DD");

    try {
      const result = await this.model.incrementCount({
        date: today,
        logType: logType,
        environment: this.environment,
      });

      if (result.success) {
        const currentCount = result.data?.count || 1;
        return currentCount <= this.maxLogsPerDay;
      } else {
        logger.debug(`Log throttle increment failed: ${result.message}`);
        // Fallback to true to avoid blocking jobs on throttle error
        return true;
      }
    } catch (error) {
      // Handle race condition where two pods try to upsert at the same time
      if (error.code === 11000) {
        try {
          // Retry the increment, which should now succeed on the existing document
          const retryResult = await this.model.incrementCount({
            date: today,
            logType: logType,
            environment: this.environment,
          });

          if (retryResult.success) {
            const currentCount = retryResult.data?.count || 1;
            return currentCount <= this.maxLogsPerDay;
          }
        } catch (retryError) {
          logger.warn(`Log throttle retry failed: ${retryError.message}`);
        }
      } else {
        logger.warn(`Log throttle check failed: ${error.message}`);
      }

      // Fail-safe: allow log if throttle mechanism has an unrecoverable error
      return true;
    }
  }
}

module.exports = LogThrottleManager;
