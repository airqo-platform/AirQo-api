const cron = require("node-cron");
const constants = require("@config/constants");
const billingUtil = require("@utils/billing.util");
const { acquireCronLock } = require("@utils/common/cron-lock.util");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/invoice-reminder-job script`,
);

const jobName = "invoice-reminder-job";

/**
 * Emails "due soon" and "overdue" reminders for unpaid invoices, following
 * the reminder days in billing settings. Only invoices known to have reached
 * the customer are reminded, and each reminder is sent at most once.
 */
const runInvoiceReminders = async ({ tenant, useLock = true } = {}) => {
  const activeTenant = (tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase();
  try {
    if (useLock && !(await acquireCronLock(activeTenant, jobName))) return null;
    const result = await billingUtil.runInvoiceReminders(activeTenant);
    logger.info(`invoice reminders finished: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.error(`invoice reminders failed: ${error.message}`);
    return null;
  }
};

global.cronJobs = global.cronJobs || {};

if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
  // 09:00 Africa/Nairobi: reminders land at the start of the working day.
  global.cronJobs[jobName] = cron.schedule("0 9 * * *", () => runInvoiceReminders(), {
    scheduled: true,
    timezone: "Africa/Nairobi",
  });
}

module.exports = { runInvoiceReminders };
