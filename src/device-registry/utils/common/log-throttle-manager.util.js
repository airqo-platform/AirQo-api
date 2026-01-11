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
    const cooldownTime = new Date(now.getTime() - this.cooldownMinutes * 60000);

    try {
      // Step 1: Attempt to insert a new lock if it doesn't exist.
      // This is the most common case for the first run.
      await this.model.create({
        lock_key: lockKey,
        last_run_at: now,
        environment: this.environment,
        logType: logType,
      });
      // If creation is successful, this instance has the lock.
      return true;
    } catch (error) {
      // If the error is a duplicate key error (E11000), it means another instance
      // created the lock just before this one. This is an expected race condition.
      if (error.code === 11000) {
        // Step 2: The lock exists, so try to update it atomically.
        // This update will only succeed if the `last_run_at` is older than the cooldown time.
        const result = await this.model.findOneAndUpdate(
          {
            lock_key: lockKey,
            last_run_at: { $lt: cooldownTime },
          },
          { $set: { last_run_at: now } },
          { new: true }
        );

        // If `result` is not null, the update was successful, and this instance acquired the lock.
        // If `result` is null, it means another instance has already updated the lock within the cooldown period.
        return !!result;
      }

      // For any other unexpected errors, log it and fail-safe by allowing the job to run.
      logger.error(`Error in shouldAllowLog for ${logType}: ${error.message}`);
      // Fail-safe: if the throttle mechanism fails, allow the log to proceed
      // to avoid blocking important jobs due to a throttle error.
      return true;
    }
  }
}

module.exports = LogThrottleManager;
