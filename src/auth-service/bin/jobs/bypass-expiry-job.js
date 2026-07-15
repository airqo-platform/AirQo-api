require("module-alias/register");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/bypass-expiry-job -- ops-alerts`,
);
const cron = require("node-cron");
const AccessTokenModel = require("@models/AccessToken");
const ClientModel = require("@models/Client");
const UserModel = require("@models/User");
const tokenUtil = require("@utils/token.util");
const { mailer } = require("@utils/common");
const { logText } = require("@utils/shared");

const TIMEZONE = constants.TIMEZONE || "Africa/Kampala";
const DAILY_SCHEDULE = "0 9 * * *"; // 9:00 AM every day
const WEEKLY_SCHEDULE = "0 8 * * 1"; // 8:00 AM every Monday

const BYPASS_LABELS = {
  bypass_anomaly_detection: "Behavioural anomaly detection bypass",
  bypass_compromise_detection: "High-compromise-activity auto-suspension bypass",
  bypass_ip_blacklist: "IP-blacklist request-blocking bypass",
};

const _getOwner = async (tenant, clientId) => {
  if (!clientId) return null;
  const client = await ClientModel(tenant)
    .findById(clientId)
    .select("user_id")
    .lean();
  if (!client || !client.user_id) return null;
  return UserModel(tenant)
    .findById(client.user_id)
    .select("email firstName lastName")
    .lean();
};

// Auto-clears any bypass_* flag whose bypass_*_expires_at has passed, and
// sends a one-time "bypassExpired" notice to the token owner so they aren't
// surprised if normal detection kicks back in. Each expiry can only fire this
// once — after the flag flips to false, the query below no longer matches it.
const revokeExpiredBypasses = async (tenant = "airqo") => {
  const now = new Date();
  for (const field of tokenUtil.BYPASS_BOOLEAN_FIELDS) {
    const expiresField = `${field}_expires_at`;
    const expired = await AccessTokenModel(tenant)
      .find({ [field]: true, [expiresField]: { $lte: now } })
      .select(`name token client_id ${expiresField}`)
      .lean();

    for (const doc of expired) {
      try {
        await AccessTokenModel(tenant).updateOne(
          { _id: doc._id },
          { $set: { [field]: false }, $unset: { [expiresField]: "" } },
        );
        logger.info(
          `Bypass expired and cleared — token=...${(doc.token || "").slice(-4)} field=${field}`,
        );

        const owner = await _getOwner(tenant, doc.client_id);
        if (owner && owner.email) {
          const result = await mailer.bypassExpired({
            email: owner.email,
            firstName: owner.firstName || "",
            lastName: owner.lastName || "",
            token: doc.token,
            tokenName: doc.name || "",
            bypassLabel: BYPASS_LABELS[field] || field,
          });
          if (result && result.success === false) {
            logger.error(
              `Failed to send bypassExpired email to ${owner.email}: ${result.message || "unknown error"}`,
            );
          }
        }
      } catch (error) {
        logger.error(
          `Failed to revoke expired bypass for token ...${(doc.token || "").slice(-4)}: ${error.message}`,
        );
      }
    }
  }
};

// Sends exactly one reminder per token+bypass per expiry cycle. The
// mailer.bypassExpiryReminder cooldown (BYPASS_EXPIRY_REMINDER_LEAD_DAYS,
// same window as the lookahead below) is what prevents the daily job run
// from re-sending the same reminder every day inside the lead window.
const sendUpcomingExpiryReminders = async (tenant = "airqo") => {
  const now = new Date();
  const leadDays = constants.BYPASS_EXPIRY_REMINDER_LEAD_DAYS;
  const windowEnd = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);

  for (const field of tokenUtil.BYPASS_BOOLEAN_FIELDS) {
    const expiresField = `${field}_expires_at`;
    const upcoming = await AccessTokenModel(tenant)
      .find({ [field]: true, [expiresField]: { $gt: now, $lte: windowEnd } })
      .select(`name token client_id ${expiresField}`)
      .lean();

    for (const doc of upcoming) {
      try {
        const owner = await _getOwner(tenant, doc.client_id);
        if (!owner || !owner.email) continue;
        const result = await mailer.bypassExpiryReminder({
          email: owner.email,
          firstName: owner.firstName || "",
          lastName: owner.lastName || "",
          token: doc.token,
          tokenName: doc.name || "",
          bypassLabel: BYPASS_LABELS[field] || field,
          expiresAt: doc[expiresField],
        });
        if (result && result.success === false) {
          logger.error(
            `Failed to send bypassExpiryReminder email to ${owner.email}: ${result.message || "unknown error"}`,
          );
        }
      } catch (error) {
        logger.error(
          `Failed to send bypass expiry reminder for token ...${(doc.token || "").slice(-4)}: ${error.message}`,
        );
      }
    }
  }
};

// Weekly, internal-only digest of every token with an active bypass right
// now. Deliberately low cadence (weekly, not daily) and skipped entirely when
// there is nothing to report, so admins are not nagged with empty summaries.
const sendWeeklyBypassDigest = async (tenant = "airqo") => {
  const bypasses = await tokenUtil.listActiveBypasses(tenant);
  if (!bypasses || bypasses.length === 0) {
    logText("No active security bypasses this week — skipping digest email.");
    return;
  }
  const recipients = constants.SUPER_ADMIN_EMAIL_ALLOWLIST || [];
  if (recipients.length === 0) {
    logger.warn(
      "SUPER_ADMIN_EMAIL_ALLOWLIST is empty — skipping weekly bypass digest.",
    );
    return;
  }
  const result = await mailer.bypassReportDigest({ recipients, bypasses });
  if (result && result.success === false) {
    logger.error(
      `Failed to send weekly bypass digest: ${result.message || "unknown error"}`,
    );
  }
};

const runDailyBypassMaintenance = async (tenant = "airqo") => {
  try {
    if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") return;
    await revokeExpiredBypasses(tenant);
    await sendUpcomingExpiryReminders(tenant);
  } catch (error) {
    logger.error(`bypass-expiry-job daily run failed: ${error.message}`);
  }
};

const runWeeklyBypassDigest = async (tenant = "airqo") => {
  try {
    if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") return;
    await sendWeeklyBypassDigest(tenant);
  } catch (error) {
    logger.error(`bypass-expiry-job weekly digest failed: ${error.message}`);
  }
};

const dailyJob = cron.schedule(
  DAILY_SCHEDULE,
  () => runDailyBypassMaintenance("airqo"),
  { scheduled: true, timezone: TIMEZONE },
);

const weeklyJob = cron.schedule(
  WEEKLY_SCHEDULE,
  () => runWeeklyBypassDigest("airqo"),
  { scheduled: true, timezone: TIMEZONE },
);

if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
  dailyJob.start();
  weeklyJob.start();
}

module.exports = {
  revokeExpiredBypasses,
  sendUpcomingExpiryReminders,
  sendWeeklyBypassDigest,
  runDailyBypassMaintenance,
  runWeeklyBypassDigest,
};
