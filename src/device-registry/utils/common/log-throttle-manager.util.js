const constants = require("@config/constants");
const LogThrottleModel = require("@models/LogThrottle");
const moment = require("moment-timezone");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- log-throttle-manager`
);

class LogThrottleManager {
  constructor(timezone) {
    this.environment = constants.ENVIRONMENT;
    this.model = LogThrottleModel("airqo");
    this.timezone = timezone;
  }

  async shouldAllowLog(logType) {
    const today = moment()
      .tz(this.timezone)
      .format("YYYY-MM-DD");
    const maxLogsPerDay = 1;

    try {
      const result = await this.model.incrementCount({
        date: today,
        logType: logType,
        environment: this.environment,
      });

      if (result.success) {
        const currentCount = result.data?.count || 1;
        return currentCount <= maxLogsPerDay;
      } else {
        // If increment fails, check current count to decide
        const current = await this.model.getCurrentCount({
          date: today,
          logType: logType,
          environment: this.environment,
        });
        if (current.success && current.data.exists) {
          return current.data.count < maxLogsPerDay;
        }
        // Fail safe: If we can't determine the count, don't log.
        logger.warn(
          `Log throttle check failed for ${logType}, but could not get current count. Suppressing log.`
        );
        return false;
      }
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error means another instance is running.
        // Immediately re-check the count to make a definitive decision.
        try {
          const current = await this.model.getCurrentCount({
            date: today,
            logType: logType,
            environment: this.environment,
          });
          if (current.success && current.data.exists) {
            // If another instance has already logged, its count will be >= 1.
            // This instance should only log if the count is still less than the max.
            return current.data.count < maxLogsPerDay;
          } else {
            // If re-check fails, something is wrong. Don't log to be safe.
            return false;
          }
        } catch (retryError) {
          logger.warn(`Log throttle retry failed: ${retryError.message}`);
          // Fail safe: do not log if the retry check fails.
          return false;
        }
      } else {
        logger.warn(`Log throttle check failed: ${error.message}`);
      }

      // In case of unexpected errors, default to NOT logging to prevent spam.
      return false;
    }
  }
}

module.exports = LogThrottleManager;
