const cron = require("node-cron");
const constants = require("@config/constants");
const mailer = require("@utils/common/mailer.util");
const log4js = require("log4js");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/feedback-reminder-job`,
);

// Items must be older than this many days to appear in the digest.
const STALE_THRESHOLD_DAYS = constants.FEEDBACK_REMINDER_THRESHOLD_DAYS;

// Cap the digest at this many items to keep the email readable.
const MAX_ITEMS_PER_DIGEST = 50;

const sendFeedbackReminderDigest = async () => {
  // Require the model here (not at module load) so the DB connection is ready.
  const FeedbackModel = require("@models/Feedback");
  const tenant = constants.DEFAULT_TENANT || "airqo";

  if (!constants.SUPPORT_EMAIL) {
    logger.warn("SUPPORT_EMAIL not configured — skipping feedback reminder job");
    return;
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_THRESHOLD_DAYS);

    const result = await FeedbackModel(tenant).list({
      skip: 0,
      limit: MAX_ITEMS_PER_DIGEST,
      filter: {
        tenant,
        actionable: true,
        status: "pending",
        createdAt: { $lt: cutoff },
      },
    });

    if (!result || !result.success || !result.data || result.data.length === 0) {
      logger.info("Feedback reminder job: no stale actionable items found");
      return;
    }

    const items = result.data;
    const count = result.meta ? result.meta.total : items.length;

    try {
      await mailer.feedbackWeeklyDigest({
        to: constants.SUPPORT_EMAIL,
        count,
        items,
      });
      logger.info(
        `Feedback reminder digest sent: ${items.length} items (${count} total pending)`,
      );
    } catch (emailError) {
      logger.error(`Feedback reminder email failed: ${emailError.message}`);
      return;
    }

    // Mark all items in this batch as reminded so the job can track recurrence.
    const ids = items.map((i) => i._id);
    await FeedbackModel(tenant).bulkUpdateReminderState(ids, new Date());
  } catch (error) {
    logger.error(`Feedback reminder job error: ${error.message}`);
  }
};

global.cronJobs = global.cronJobs || {};
// Every Monday at 8 AM Nairobi time
const schedule = "0 8 * * 1";
const jobName = "feedback-reminder-job";
global.cronJobs[jobName] = cron.schedule(
  schedule,
  sendFeedbackReminderDigest,
  { scheduled: true, timezone: "Africa/Nairobi" },
);

module.exports = { sendFeedbackReminderDigest };
