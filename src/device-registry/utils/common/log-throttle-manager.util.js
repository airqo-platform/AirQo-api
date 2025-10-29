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
      }
      // If incrementCount failed (e.g., due to a race condition),
      // we must re-check the current state to make a definitive decision.
    } catch (error) {
      logger.warn(
        `Initial lock acquisition for ${logType} failed with error: ${error.message}. Re-checking state.`
      );
    }

    // Fallback check: If the atomic increment failed, another instance might have already run.
    // Let's find out for sure.
    try {
      const current = await this.model.getCurrentCount({
        date: today,
        logType: logType,
        environment: this.environment,
      });
      // If a document exists and its count is >= 1, another pod has the lock.
      return !(
        current.success &&
        current.data.exists &&
        current.data.count >= 1
      );
    } catch (checkError) {
      logger.error(
        `Failed to re-check lock state for ${logType}: ${checkError.message}`
      );
      return false;
    }
  }
}

module.exports = LogThrottleManager;
