const ActivityLogModel = require("@models/ActivityLog");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- activity-logger`);

const ActivityLogger = {
  /**
   * Fire-and-forget group-activity logging. Never blocks or throws for the
   * caller — a failure here must not fail the membership/role/manager change
   * it's recording.
   */
  logActivity({ tenant, group_id, activity_type, actor, target_user, details } = {}) {
    try {
      ActivityLogModel(tenant)
        .logActivity({ group_id, activity_type, actor, target_user, details, tenant })
        .catch((error) => {
          logger.warn(`Activity logging failed: ${error.message}`);
        });
    } catch (error) {
      logger.warn(`Activity logging failed: ${error.message}`);
    }
    return { success: true };
  },
};

module.exports = { ActivityLogger };
