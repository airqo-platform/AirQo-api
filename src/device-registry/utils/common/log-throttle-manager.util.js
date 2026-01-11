const constants = require("@config/constants");
const LogThrottleModel = require("@models/LogThrottle");
const moment = require("moment-timezone");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- log-throttle-manager`
);

class LogThrottleManager {
  constructor(cooldownMinutes = 5) {
    this.environment = constants.ENVIRONMENT;
    this.model = LogThrottleModel(constants.DEFAULT_TENANT);
    // Backward compatibility:
    // Handle being called with the old `timezone` string parameter.
    if (
      typeof cooldownMinutes === "number" &&
      Number.isFinite(cooldownMinutes)
    ) {
      this.cooldownMinutes = cooldownMinutes;
    } else {
      this.cooldownMinutes = 5; // Default to 5 minutes if input is invalid
    }
  }

  async shouldAllowLog(logType) {
    const lockKey = `${this.environment}:${logType}`;
    const now = new Date();
    const cooldownPeriod = new Date(
      now.getTime() - this.cooldownMinutes * 60000
    );

    try {
      // Atomically find and update the lock only if the cooldown has passed.
      const result = await this.model.findOneAndUpdate(
        {
          lock_key: lockKey,
          $or: [
            { last_run_at: { $lt: cooldownPeriod } },
            { last_run_at: { $exists: false } },
          ],
        },
        {
          $set: {
            last_run_at: now,
            environment: this.environment,
            logType: logType,
          },
        },
        { upsert: true, new: true }
      );

      // If the update was successful (result is not null), this instance acquired the lock.
      return !!result;
    } catch (error) {
      logger.error(`Error in shouldAllowLog for ${logType}: ${error.message}`);
      // Fail-safe: if the throttle mechanism fails, allow the log to proceed
      // to avoid blocking important jobs due to a throttle error.
      return true;
    }
  }
}

module.exports = LogThrottleManager;
