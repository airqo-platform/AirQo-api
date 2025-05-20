// bin/jobs/health-tip-checker.job.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/health-tip-checker-job`
);
const HealthTipModel = require("@models/HealthTips");
const cron = require("node-cron");
const { logObject, logText } = require("@utils/shared");
const moment = require("moment-timezone");
const TIMEZONE = moment.tz.guess();

const checkHealthTipsCoverage = async () => {
  try {
    logText("Checking for AQI categories without health tips...");

    // Get valid AQI ranges from the configuration
    const validAqiRanges = Object.values(constants.AQI_INDEX);

    // Check each AQI category for tips
    const categoriesWithoutTips = [];

    for (const range of validAqiRanges) {
      const filter = {
        "aqi_category.min": range.min,
      };

      if (range.max === null) {
        filter["aqi_category.max"] = null;
      } else {
        filter["aqi_category.max"] = range.max;
      }

      const tenant = constants.DEFAULT_TENANT || "airqo";
      const count = await HealthTipModel(tenant)
        .countDocuments(filter)
        .exec();

      if (count === 0) {
        // Get category name (like "good", "moderate", etc.)
        const categoryName = Object.keys(constants.AQI_INDEX).find((key) => {
          const r = constants.AQI_INDEX[key];
          return (
            Math.abs(r.min - range.min) < 0.001 &&
            ((r.max === null && range.max === null) ||
              (r.max !== null &&
                range.max !== null &&
                Math.abs(r.max - range.max) < 0.001))
          );
        });

        categoriesWithoutTips.push({
          name: categoryName || "unknown",
          min: range.min,
          max: range.max,
        });
      }
    }

    if (categoriesWithoutTips.length > 0) {
      // Log alerts for missing health tips
      const alertMessage = `⚠️ Health tip coverage alert: Found ${categoriesWithoutTips.length} AQI categories without health tips`;
      logText(alertMessage);
      logger.warn(alertMessage);

      categoriesWithoutTips.forEach((category) => {
        const rangeDesc =
          category.max === null
            ? `${category.min}+`
            : `${category.min}-${category.max}`;

        const categoryMsg = `🔍 Missing health tips for AQI category "${category.name}" (${rangeDesc})`;
        logText(categoryMsg);
        logger.warn(categoryMsg);
      });
    } else {
      const successMsg = "✅ All AQI categories have health tips";
      logText(successMsg);
      logger.info(successMsg);
    }
  } catch (error) {
    const errorMsg = `🐛🐛 Error checking health tip coverage: ${error.message}`;
    logText(errorMsg);
    logger.error(errorMsg);
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
};

logText("Health tip coverage checker job is now running...");

// Run every 2 hours
const schedule = "0 */2 * * *"; // At minute 0 of every 2nd hour
cron.schedule(schedule, checkHealthTipsCoverage, {
  scheduled: true,
  timezone: TIMEZONE,
});

// Run initial check on startup
checkHealthTipsCoverage();
