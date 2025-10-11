//src/device-registry/bin/jobs/site-categorization-notification-job.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/site-categorization-notification-job`
);
const SitesModel = require("@models/Site");
const cron = require("node-cron");
const moment = require("moment-timezone");
const { logObject, logText } = require("@utils/shared");

// Job configuration
const JOB_NAME = "site-categorization-notification-job";
const JOB_SCHEDULE = "15 */5 * * *"; // Every 5 hours at 15 minutes past (offset from categorization job)
const TIMEZONE = "Africa/Nairobi"; // East Africa Time

// Notification thresholds
const UNCATEGORIZED_THRESHOLD_PERCENTAGE = 5; // Alert if more than 5% uncategorized
const UNCATEGORIZED_THRESHOLD_COUNT = 10; // Alert if more than 10 sites uncategorized
const MAX_SITES_TO_LIST = 20; // Maximum number of sites to list in notification

// Global state management
let isJobRunning = false;
let currentJobPromise = null;

// Helper function to format site details for logging
function formatSiteForLogging(site) {
  return {
    id: site._id,
    name: site.name || "Unnamed",
    generated_name: site.generated_name || "Unknown",
    latitude: site.latitude,
    longitude: site.longitude,
    created_at: site.created_at,
    network: site.network || "airqo",
  };
}

// Helper function to validate coordinates
function validateCoordinates(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: "Invalid coordinate format" };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, error: "Coordinates out of valid range" };
  }

  return { valid: true, lat, lng };
}

// Check if site has proper categorization
function hasSiteCategory(site) {
  return (
    site.site_category &&
    typeof site.site_category === "object" &&
    site.site_category.category &&
    site.site_category.category !== "Unknown" &&
    site.site_category.category !== ""
  );
}

// Get uncategorized sites with detailed analysis
async function getUncategorizedSitesDetails() {
  try {
    logText("=== CHECKING UNCATEGORIZED SITES ===");

    // Get total count of all sites with performance optimization
    const totalSitesCount = await SitesModel("airqo").countDocuments({});

    // Get sites that need categorization (same criteria as categorization job)
    const uncategorizedSites = await SitesModel("airqo")
      .find(
        {
          $or: [
            { site_category: { $exists: false } },
            { site_category: null },
            { "site_category.category": { $exists: false } },
            { "site_category.category": null },
            { "site_category.category": "Unknown" },
            { "site_category.category": "" },
          ],
        },
        {
          _id: 1,
          name: 1,
          generated_name: 1,
          latitude: 1,
          longitude: 1,
          created_at: 1,
          network: 1,
          site_category: 1,
        }
      )
      .lean();

    // More detailed categorization of sites
    const sitesWithValidCoords = [];
    const sitesWithInvalidCoords = [];
    const sitesWithMissingCoords = [];

    uncategorizedSites.forEach((site) => {
      if (site.latitude == null || site.longitude == null) {
        sitesWithMissingCoords.push({
          ...site,
          invalidReason: "Missing coordinates",
        });
      } else {
        const validation = validateCoordinates(site.latitude, site.longitude);
        if (validation.valid) {
          sitesWithValidCoords.push(site);
        } else {
          sitesWithInvalidCoords.push({
            ...site,
            invalidReason: validation.error,
          });
        }
      }
    });

    const categorizedCount = totalSitesCount - uncategorizedSites.length;
    const uncategorizedPercentage =
      totalSitesCount > 0
        ? ((uncategorizedSites.length / totalSitesCount) * 100).toFixed(2)
        : 0;

    // More comprehensive stats
    const stats = {
      totalSites: totalSitesCount,
      categorizedSites: categorizedCount,
      uncategorizedSites: uncategorizedSites.length,
      uncategorizedPercentage: parseFloat(uncategorizedPercentage),
      sitesWithValidCoords: sitesWithValidCoords.length,
      sitesWithInvalidCoords: sitesWithInvalidCoords.length,
      sitesWithMissingCoords: sitesWithMissingCoords.length,
      // Additional metrics
      readyForProcessing: sitesWithValidCoords.length,
      needingAttention:
        sitesWithInvalidCoords.length + sitesWithMissingCoords.length,
      lastChecked: moment()
        .tz(TIMEZONE)
        .format(),
    };

    logObject("categorizationStats", stats);

    return {
      stats,
      uncategorizedSites,
      sitesWithValidCoords,
      sitesWithInvalidCoords,
      sitesWithMissingCoords,
    };
  } catch (error) {
    logger.error(`Error getting uncategorized sites details: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    throw error;
  }
}

// Generate more detailed notification message for Slack
function generateNotificationMessage(data) {
  const {
    stats,
    sitesWithValidCoords,
    sitesWithInvalidCoords,
    sitesWithMissingCoords,
  } = data;

  let message = `🏢 **Site Categorization Status Report**\n`;
  message += `📊 **Overall Statistics:**\n`;
  message += `• Total sites: ${stats.totalSites}\n`;
  message += `• Categorized: ${stats.categorizedSites}\n`;
  message += `• Uncategorized: ${stats.uncategorizedSites} (${stats.uncategorizedPercentage}%)\n`;
  message += `• Ready for processing: ${stats.readyForProcessing}\n`;
  message += `• Needing attention: ${stats.needingAttention}\n\n`;

  if (stats.uncategorizedSites === 0) {
    message += `✅ **Excellent!** All sites are properly categorized.\n`;
    message += `🎯 **Status**: Fully optimized - all ${stats.totalSites} sites have valid categories.\n`;
    return message;
  }

  // Sites ready for categorization
  if (sitesWithValidCoords.length > 0) {
    message += `🎯 **Sites Ready for Automatic Categorization:** ${sitesWithValidCoords.length}\n`;

    const sitesToList = sitesWithValidCoords.slice(0, MAX_SITES_TO_LIST);
    sitesToList.forEach((site, index) => {
      message += `${index + 1}. **${site.name ||
        site.generated_name ||
        "Unnamed"}** (ID: ${site._id})\n`;
      message += `   📍 Coordinates: ${site.latitude}, ${site.longitude}\n`;
      if (site.created_at) {
        message += `   📅 Created: ${moment(site.created_at).format(
          "YYYY-MM-DD"
        )}\n`;
      }
    });

    if (sitesWithValidCoords.length > MAX_SITES_TO_LIST) {
      message += `   ... and ${sitesWithValidCoords.length -
        MAX_SITES_TO_LIST} more sites\n`;
    }
    message += `\n`;
  }

  // Sites with coordinate issues
  if (sitesWithInvalidCoords.length > 0) {
    message += `⚠️ **Sites with Invalid Coordinates:** ${sitesWithInvalidCoords.length}\n`;

    const problematicSites = sitesWithInvalidCoords.slice(0, MAX_SITES_TO_LIST);
    problematicSites.forEach((site, index) => {
      message += `${index + 1}. **${site.name ||
        site.generated_name ||
        "Unnamed"}** (ID: ${site._id})\n`;
      message += `   ❌ Issue: ${site.invalidReason}\n`;
      message += `   📍 Current coordinates: ${site.latitude}, ${site.longitude}\n`;
    });

    if (sitesWithInvalidCoords.length > MAX_SITES_TO_LIST) {
      message += `   ... and ${sitesWithInvalidCoords.length -
        MAX_SITES_TO_LIST} more sites with invalid coordinates\n`;
    }
    message += `\n`;
  }

  // Sites with missing coordinates
  if (sitesWithMissingCoords.length > 0) {
    message += `❌ **Sites with Missing Coordinates:** ${sitesWithMissingCoords.length}\n`;

    const missingSites = sitesWithMissingCoords.slice(0, MAX_SITES_TO_LIST);
    missingSites.forEach((site, index) => {
      message += `${index + 1}. **${site.name ||
        site.generated_name ||
        "Unnamed"}** (ID: ${site._id})\n`;
      message += `   📍 Missing coordinate data\n`;
    });

    if (sitesWithMissingCoords.length > MAX_SITES_TO_LIST) {
      message += `   ... and ${sitesWithMissingCoords.length -
        MAX_SITES_TO_LIST} more sites missing coordinates\n`;
    }
    message += `\n`;
  }

  // Add actionable recommendations
  message += `💡 **Actionable Recommendations:**\n`;
  if (sitesWithValidCoords.length > 0) {
    message += `• ✅ ${sitesWithValidCoords.length} sites are ready for automatic categorization (next job run)\n`;
  }
  if (sitesWithInvalidCoords.length > 0) {
    message += `• 🔧 ${sitesWithInvalidCoords.length} sites need coordinate correction\n`;
  }
  if (sitesWithMissingCoords.length > 0) {
    message += `• 📍 ${sitesWithMissingCoords.length} sites need coordinate data entry\n`;
  }

  // Add performance metrics
  const processingEfficiency =
    stats.totalSites > 0
      ? ((stats.categorizedSites / stats.totalSites) * 100).toFixed(1)
      : 0;

  message += `\n📈 **Performance Metrics:**\n`;
  message += `• Processing efficiency: ${processingEfficiency}%\n`;
  message += `• Automation ready: ${sitesWithValidCoords.length}/${
    stats.uncategorizedSites
  } (${
    stats.uncategorizedSites > 0
      ? (
          (sitesWithValidCoords.length / stats.uncategorizedSites) *
          100
        ).toFixed(1)
      : 0
  }%)\n`;

  // Add timestamp
  message += `\n⏰ Report generated: ${moment()
    .tz(TIMEZONE)
    .format("YYYY-MM-DD HH:mm:ss")} EAT`;

  return message;
}

// Determine if notification should be sent based on thresholds
function shouldSendNotification(stats) {
  // Always notify if there are uncategorized sites above thresholds
  return (
    stats.uncategorizedSites > UNCATEGORIZED_THRESHOLD_COUNT ||
    stats.uncategorizedPercentage > UNCATEGORIZED_THRESHOLD_PERCENTAGE
  );
}

// Main notification job function with better error handling
const performSiteCategorizationNotification = async () => {
  // Prevent overlapping executions
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  const startTime = moment().tz(TIMEZONE);

  try {
    // Check if job should stop (for graceful shutdown)
    if (global.isShuttingDown) {
      logText(`${JOB_NAME} stopping due to application shutdown`);
      return;
    }

    logText(
      `🔔 Starting site categorization notification job at ${startTime.format(
        "YYYY-MM-DD HH:mm:ss"
      )} EAT`
    );

    // Get uncategorized sites details
    const data = await getUncategorizedSitesDetails();
    const {
      stats,
      sitesWithValidCoords,
      sitesWithInvalidCoords,
      sitesWithMissingCoords,
    } = data;

    // Generate notification message
    const notificationMessage = generateNotificationMessage(data);

    // Always log the current status
    logText("=== SITE CATEGORIZATION STATUS ===");
    logObject("currentStats", stats);

    // More sophisticated notification logic
    if (stats.uncategorizedSites === 0) {
      // All sites categorized - send positive notification
      logText("✅ All sites are properly categorized!");
      logText(notificationMessage);

      // Log success metrics for monitoring
      logObject("categorizationSuccess", {
        totalSites: stats.totalSites,
        successRate: "100%",
        timestamp: stats.lastChecked,
      });
    } else if (shouldSendNotification(stats)) {
      // Send alert notification - above thresholds
      const alertLevel = stats.uncategorizedPercentage > 20 ? "🚨" : "⚠️";
      const alertMessage = `${alertLevel} SITE CATEGORIZATION ALERT: ${stats.uncategorizedSites} sites (${stats.uncategorizedPercentage}%) need categorization`;

      logText(alertMessage);
      logText(notificationMessage);
      logger.warn(alertMessage);

      // Log detailed information about uncategorized sites for Slack integration
      if (sitesWithValidCoords.length > 0) {
        logText("🎯 Sites ready for categorization:");
        sitesWithValidCoords.slice(0, 10).forEach((site) => {
          const formattedSite = formatSiteForLogging(site);
          logObject("uncategorizedSite", formattedSite);
        });
      }

      if (sitesWithInvalidCoords.length > 0) {
        logText("⚠️ Sites with coordinate issues:");
        sitesWithInvalidCoords.slice(0, 5).forEach((site) => {
          const formattedSite = formatSiteForLogging(site);
          formattedSite.issue = site.invalidReason;
          logObject("problematicSite", formattedSite);
        });
      }

      // Log missing coordinate sites separately
      if (sitesWithMissingCoords.length > 0) {
        logText("❌ Sites with missing coordinates:");
        sitesWithMissingCoords.slice(0, 5).forEach((site) => {
          const formattedSite = formatSiteForLogging(site);
          formattedSite.issue = "Missing coordinates";
          logObject("missingCoordinatesSite", formattedSite);
        });
      }
    } else {
      // Below thresholds - just log status
      logText(
        `ℹ️ Site categorization status: ${stats.uncategorizedSites} sites (${stats.uncategorizedPercentage}%) need categorization (below alert threshold)`
      );
      logger.info(
        `Site categorization status: ${stats.uncategorizedSites} uncategorized sites (${stats.uncategorizedPercentage}%)`
      );

      // Still log some details for monitoring even if below threshold
      logObject("belowThresholdStatus", {
        uncategorizedCount: stats.uncategorizedSites,
        percentage: stats.uncategorizedPercentage,
        readyForProcessing: stats.readyForProcessing,
        needingAttention: stats.needingAttention,
      });
    }

    // Log comprehensive summary metrics for monitoring
    logText("=== NOTIFICATION SUMMARY ===");
    logObject("totalSitesChecked", stats.totalSites);
    logObject("uncategorizedCount", stats.uncategorizedSites);
    logObject("uncategorizedPercentage", stats.uncategorizedPercentage);
    logObject("sitesReadyForCategorization", sitesWithValidCoords.length);
    logObject("sitesWithCoordinateIssues", sitesWithInvalidCoords.length);
    logObject("sitesWithMissingCoordinates", sitesWithMissingCoords.length);
    logObject("notificationSent", shouldSendNotification(stats));
    logObject(
      "processingEfficiency",
      `${((stats.categorizedSites / stats.totalSites) * 100).toFixed(1)}%`
    );

    const endTime = moment().tz(TIMEZONE);
    const duration = moment.duration(endTime.diff(startTime));

    logText(
      `✅ Site categorization notification job completed in ${duration.humanize()}`
    );

    // Log performance metrics
    logObject("notificationJobPerformance", {
      duration: duration.asMilliseconds(),
      sitesAnalyzed: stats.totalSites,
      throughput: `${(stats.totalSites / duration.asSeconds()).toFixed(
        1
      )} sites/sec`,
    });
  } catch (error) {
    const errorMessage = `Site categorization notification job failed: ${error.message}`;
    logText(`🐛🐛 ${errorMessage}`);
    logger.error(`🐛🐛 ${errorMessage}`);
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);

    // Send detailed error notification
    logText(`💥 Site categorization monitoring encountered an error`);
    logObject("notificationJobError", {
      error: error.message,
      stack: error.stack,
      timestamp: moment()
        .tz(TIMEZONE)
        .format(),
      jobName: JOB_NAME,
      duration: moment
        .duration(
          moment()
            .tz(TIMEZONE)
            .diff(startTime)
        )
        .asSeconds(),
    });
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// Wrapper function for graceful shutdown handling
const jobWrapper = async () => {
  currentJobPromise = performSiteCategorizationNotification();
  await currentJobPromise;
};

// Create and start the cron job
const startSiteCategorizationNotificationJob = () => {
  try {
    // Create the cron job instance
    const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
      scheduled: true,
      timezone: TIMEZONE,
    });

    // Initialize global cronJobs if it doesn't exist
    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    // Register the job for cleanup
    global.cronJobs[JOB_NAME] = {
      job: cronJobInstance,
      name: JOB_NAME,
      schedule: JOB_SCHEDULE,
      stop: async () => {
        logText(`🛑 Stopping ${JOB_NAME}...`);

        try {
          // Stop the cron schedule
          cronJobInstance.stop();
          logText(`📅 ${JOB_NAME} schedule stopped`);

          // Wait for current execution to finish if running
          if (currentJobPromise) {
            logText(
              `⏳ Waiting for current ${JOB_NAME} execution to finish...`
            );
            await currentJobPromise;
            logText(`✅ Current ${JOB_NAME} execution completed`);
          }

          // Destroy the job
          if (typeof cronJobInstance.destroy === "function") {
            cronJobInstance.destroy();
          }
          logText(`💥 ${JOB_NAME} destroyed successfully`);

          // Remove from global registry
          delete global.cronJobs[JOB_NAME];
        } catch (error) {
          logger.error(`❌ Error stopping ${JOB_NAME}: ${error.message}`);
        }
      },
    };

    logText(
      `✅ ${JOB_NAME} registered and started (${JOB_SCHEDULE} ${TIMEZONE})`
    );
    logText(
      "Site categorization notification job is now running every 5 hours..."
    );

    return global.cronJobs[JOB_NAME];
  } catch (error) {
    logger.error(`❌ Failed to start ${JOB_NAME}: ${error.message}`);
    throw error;
  }
};

// Graceful shutdown handler
const handleShutdown = async (signal) => {
  logText(`📨 ${JOB_NAME} received ${signal} signal`);

  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    await global.cronJobs[JOB_NAME].stop();
  }

  logText(`👋 ${JOB_NAME} shutdown complete`);
};

// Register shutdown handlers if not already done globally
if (!global.jobShutdownHandlersRegistered) {
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  global.jobShutdownHandlersRegistered = true;
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error(`💥 Uncaught Exception in ${JOB_NAME}: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    `🚫 Unhandled Rejection in ${JOB_NAME} at:`,
    promise,
    "reason:",
    reason
  );
});

// Start the job
try {
  startSiteCategorizationNotificationJob();
  logText(`🎉 ${JOB_NAME} initialization complete`);
} catch (error) {
  logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  process.exit(1);
}

// Export for testing or manual control
module.exports = {
  JOB_NAME,
  JOB_SCHEDULE,
  UNCATEGORIZED_THRESHOLD_PERCENTAGE,
  UNCATEGORIZED_THRESHOLD_COUNT,
  startSiteCategorizationNotificationJob,
  performSiteCategorizationNotification,
  getUncategorizedSitesDetails,
  generateNotificationMessage,
  shouldSendNotification,
  formatSiteForLogging,
  validateCoordinates,
  stopJob: async () => {
    if (global.cronJobs && global.cronJobs[JOB_NAME]) {
      await global.cronJobs[JOB_NAME].stop();
    }
  },
};
