const constants = require("@config/constants");
const LogThrottleModel = require("@models/LogThrottle");
const moment = require("moment-timezone");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- log-throttle-manager`
);

class LogThrottleManager {
  constructor(coolDownMinutes = 5) {
    this.environment = constants.ENVIRONMENT;
    this.model = LogThrottleModel(constants.DEFAULT_TENANT);
    this.coolDownMinutes = coolDownMinutes;
  }

  async shouldAllowLog(logType) {
    const now = moment();
    const lockKey = `${this.environment}:${logType}`;

    try {
      const lastRun = await this.model.findOne({ lock_key: lockKey }).lean();

      if (lastRun) {
        const minutesSinceLastRun = now.diff(
          moment(lastRun.last_run_at),
          "minutes"
        );
        if (minutesSinceLastRun < this.coolDownMinutes) {
          // It's too soon to run again.
          return false;
        }
      }

      // It's been long enough, or this is the first run. Update the timestamp.
      await this.model.findOneAndUpdate(
        { lock_key: lockKey },
        {
          $set: {
            last_run_at: now.toDate(),
            environment: this.environment,
            log_type: logType,
          },
        },
        { upsert: true, new: true }
      );

      return true;
    } catch (error) {
      logger.error(`Error in shouldAllowLog for ${logType}: ${error.message}`);
      // Fail-safe: if the throttle mechanism fails, allow the log to proceed
      // to avoid blocking important jobs due to a throttle error.
      return true;
    }
  }
}

module.exports = LogThrottleManager;
