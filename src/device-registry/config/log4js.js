const { isDevelopment } = require("@utils/shared");
const constants = require("./constants");

if (isDevelopment()) {
  console.log("🚫 Log4js running in silent mode (development)");

  module.exports = {
    appenders: {
      console: { type: "console" },
    },
    categories: {
      default: { appenders: ["console"], level: "off" }, // Silent
      error: { appenders: ["console"], level: "off" }, // Silent
      http: { appenders: ["console"], level: "off" }, // Silent
    },
  };
} else {
  console.log(
    "📝 [DEVICE-REGISTRY] Log4js configured (Slack alerts for ERROR only when configured)",
  );

  const hasSlackConfig =
    constants.SLACK_TOKEN &&
    constants.SLACK_CHANNEL &&
    constants.SLACK_USERNAME;

  if (!hasSlackConfig) {
    console.warn(
      "⚠️  Slack configuration incomplete - some alerts may be disabled",
    );
  }

  const config = {
    appenders: {
      access: {
        type: "dateFile",
        filename: "log/access.log",
        pattern: "-yyyy-MM-dd",
        category: "http",
      },
      app: {
        type: "file",
        filename: "log/app.log",
        maxLogSize: 10485760,
        numBackups: 3,
      },
      errorFile: {
        type: "file",
        filename: "log/errors.log",
      },
      errors: {
        type: "logLevelFilter",
        level: "ERROR",
        appender: "errorFile",
      },
    },
    categories: {
      // "app" is always present so INFO and WARN logs are written to file
      // regardless of whether the Slack appender is configured. Previously
      // default only received slackErrors (filtered at ERROR), meaning all
      // INFO and WARN logs were silently discarded.
      default: { appenders: ["app"], level: "info" },
      error: { appenders: ["errors"], level: "error" },
      http: { appenders: ["access"], level: "DEBUG" },
      "api-usage-logger": { appenders: [], level: "info" },

      // Dedicated category for operational jobs that need INFO/WARN visibility
      // in Slack — e.g. network status checks, unassigned sites alerts, and
      // daily activity summaries. These jobs produce actionable operational
      // messages at INFO/WARN level that should reach Slack, unlike the
      // default category which is restricted to ERROR only for Slack.
      // Usage: const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- ops-alerts`);
      "ops-alerts": { appenders: ["app"], level: "info" },
    },
  };

  // log4js uses exact or dot-hierarchical category matching — it does NOT
  // do suffix matching. Job files use the naming pattern:
  //   `${ENVIRONMENT} -- <job-name> -- ops-alerts`
  // which never resolves to the "ops-alerts" category above. Register each
  // full category name explicitly. Always include the "app" appender so
  // INFO/WARN messages reach the log file regardless of environment;
  // slackWarn is added later only for production.
  const OPS_ALERTS_JOB_NAMES = [
    "network-status-check-job",
    "daily-activity-summary-job",
    "check-unassigned-sites-job",
    "backfill-site-metadata-job",
    "/bin/jobs/check-unassigned-devices-job",
    "/bin/jobs/check-active-statuses-job",
    "/bin/jobs/check-duplicate-site-fields-job",
    "/bin/jobs/private-cohort-alert-job",
    "/bin/jobs/events-health-check-job",
    "/bin/jobs/health-tip-checker-job",
    "/bin/jobs/store-readings-job",
    "/bin/jobs/network-uptime-analysis-job",
    "/bin/jobs/device-status-check-job",
    "/bin/jobs/device-status-hourly-check-job",
    "/bin/jobs/check-primary-device-job",
    "/bin/jobs/device-uptime-job",
  ];
  const env = constants.ENVIRONMENT;
  OPS_ALERTS_JOB_NAMES.forEach((jobName) => {
    config.categories[`${env} -- ${jobName} -- ops-alerts`] = {
      appenders: ["app"],
      level: "info",
    };
  });

  if (hasSlackConfig) {
    try {
      config.appenders.slack = {
        type: "@log4js-node/slack",
        token: constants.SLACK_TOKEN,
        channel_id: constants.SLACK_CHANNEL,
        username: constants.SLACK_USERNAME,
      };

      // slackErrors — ERROR and above only. Used by default and error categories.
      // Keeps routine INFO/WARN logs out of Slack for the general codebase.
      config.appenders.slackErrors = {
        type: "logLevelFilter",
        level: "ERROR",
        appender: "slack",
      };

      // slackWarn — WARN and above. Used only by the ops-alerts category so
      // specific operational jobs can send WARNING and higher to Slack without
      // opening up the entire codebase to warn-level Slack noise.
      config.appenders.slackWarn = {
        type: "logLevelFilter",
        level: "WARN",
        appender: "slack",
      };

      config.categories.default.appenders.push("slackErrors");
      config.categories.error.appenders.push("slackErrors");

      // Production: WARN and above → Slack for ops-alerts jobs.
      // Non-production: only ERROR → Slack (same as default), WARN is silent.
      // In both cases ops-alerts categories already have "app" for file logging.
      const opsAlertsSlackAppender =
        env === "PRODUCTION ENVIRONMENT" ? "slackWarn" : "slackErrors";
      config.categories["ops-alerts"].appenders.push(opsAlertsSlackAppender);
      OPS_ALERTS_JOB_NAMES.forEach((jobName) => {
        config.categories[
          `${env} -- ${jobName} -- ops-alerts`
        ].appenders.push(opsAlertsSlackAppender);
      });

      console.log(
        "✅ Slack appender configured successfully (ERROR and above only, WARN and above for ops-alerts)",
      );
    } catch (error) {
      console.error("❌ Failed to configure Slack appender:", error.message);
      console.log("📝 Continuing without Slack notifications");
    }
  }

  // API Usage logger should only go to stdout (no Slack)
  config.appenders.stdout = { type: "stdout" };
  config.categories["api-usage-logger"].appenders = ["stdout"];

  module.exports = config;
}
