//src/device-registry/bin/jobs/site-categorization-job.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/site-categorization-job`
);
const SitesModel = require("@models/Site");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment-timezone");
const { logObject, logText } = require("@utils/shared");

// Job configuration
const JOB_NAME = "site-categorization-job";
const JOB_SCHEDULE = "0 */5 * * *"; // Every 5 hours starting at midnight EAT
const TIMEZONE = "Africa/Nairobi"; // East Africa Time

// Processing configuration
const BATCH_SIZE = 10;
const CATEGORIZATION_DELAY = 2000; // 2 seconds between requests
const BATCH_DELAY = 5000; // 5 seconds between batches
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

// Global state management
let isJobRunning = false;
let currentJobPromise = null;

// Validate required configuration
function validateConfiguration() {
  const missingConfigs = [];

  if (!constants.API_BASE_URL) {
    missingConfigs.push("API_BASE_URL");
  }

  if (!constants.API_TOKEN) {
    missingConfigs.push("API_TOKEN");
  }

  return {
    isValid: missingConfigs.length === 0,
    missingConfigs,
  };
}

// Initialize spatial API client only if configuration is valid
function initializeSpatialApiClient() {
  const configValidation = validateConfiguration();

  if (!configValidation.isValid) {
    logger.warn(
      `⚠️ Spatial API client not initialized. Missing configuration: ${configValidation.missingConfigs.join(
        ", "
      )}`
    );
    return null;
  }

  return axios.create({
    baseURL: constants.API_BASE_URL,
    timeout: 120000, // 2 minutes timeout for spatial API
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

// Spatial API configuration (only external API we need)
let spatialApiClient = initializeSpatialApiClient();

// Add request interceptor for spatial API authentication (only if client exists)
if (spatialApiClient) {
  spatialApiClient.interceptors.request.use(
    (config) => {
      // Add token as query parameter if available
      if (constants.API_TOKEN) {
        config.params = {
          ...config.params,
          token: constants.API_TOKEN,
        };
      }
      return config;
    },
    (error) => {
      logger.error("Spatial API request interceptor error:", error);
      return Promise.reject(error);
    }
  );

  // Add response interceptor for error handling
  spatialApiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === "ECONNABORTED") {
        logger.error("Spatial API request timeout:", error.config?.url);
      } else if (error.response?.status === 401) {
        logger.error("Spatial API authentication failed - check your token");
      } else if (error.response?.status >= 500) {
        logger.error(
          "Spatial API server error:",
          error.response?.status,
          error.response?.statusText
        );
      }
      return Promise.reject(error);
    }
  );
}

// Helper functions
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function hasSiteCategory(site) {
  return (
    site.site_category &&
    typeof site.site_category === "object" &&
    site.site_category.category &&
    site.site_category.category !== "Unknown"
  );
}

function extractTags(osmInfo) {
  if (!osmInfo || !Array.isArray(osmInfo)) {
    return [];
  }
  return osmInfo.map((line) => line.trim()).filter((line) => line.length > 0);
}

// Retry logic with proper error handling
async function retryRequest(
  requestFn,
  maxRetries = MAX_RETRIES,
  delay = RETRY_DELAY
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const isRetryableError =
        error.message.includes("timeout") ||
        error.message.includes("Invalid header value char") ||
        error.code === "ECONNABORTED" ||
        (error.response && error.response.status >= 500);

      if (!isRetryableError) {
        throw error;
      }

      logger.warn(
        `Retrying spatial API request in ${delay /
          1000}s... (attempt ${attempt}/${maxRetries}) - ${error.message}`
      );
      await sleep(delay);
    }
  }
}

// Phase 1: Collect sites needing categorization using direct DB access
async function collectSitesNeedingCategorization() {
  try {
    logText("=== PHASE 1: Collecting sites that need categorization ===");

    // Direct database query instead of API call
    const totalSites = await SitesModel("airqo").countDocuments({});
    logObject("totalSitesInSystem", totalSites);

    // Find sites that don't have proper categorization
    const sitesNeedingCategorization = await SitesModel("airqo")
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
          latitude: { $exists: true, $ne: null },
          longitude: { $exists: true, $ne: null },
        },
        {
          _id: 1,
          name: 1,
          latitude: 1,
          longitude: 1,
        }
      )
      .lean();

    const alreadyCategorized = totalSites - sitesNeedingCategorization.length;

    logObject("sitesAlreadyCategorized", alreadyCategorized);
    logObject("sitesNeedingCategorization", sitesNeedingCategorization.length);

    // Validate coordinates and filter invalid ones
    const validSites = sitesNeedingCategorization.filter((site) => {
      const validation = validateCoordinates(site.latitude, site.longitude);
      if (!validation.valid) {
        logger.warn(`Skipping site ${site._id}: ${validation.error}`);
        return false;
      }
      return true;
    });

    logObject("validSitesForProcessing", validSites.length);
    logObject(
      "invalidCoordinatesSkipped",
      sitesNeedingCategorization.length - validSites.length
    );

    return validSites;
  } catch (error) {
    logger.error(
      `Error collecting sites needing categorization: ${error.message}`
    );
    throw error;
  }
}

// Phase 2: Process sites for categorization with retry logic
async function processSitesForCategorization(sitesToProcess) {
  if (sitesToProcess.length === 0) {
    logText("No sites need categorization. Exiting.");
    return {
      processed: 0,
      successful: 0,
      failed: 0,
      successfulSites: [],
      failedSites: [],
    };
  }

  // Additional safety check for spatial API client
  if (!spatialApiClient) {
    const errorMessage =
      "Cannot process sites: Spatial API client not initialized";
    logText(`🚫 ${errorMessage}`);
    logger.error(errorMessage);
    return {
      processed: 0,
      successful: 0,
      failed: sitesToProcess.length,
      successfulSites: [],
      failedSites: [],
    };
  }

  logText("=== PHASE 2: Processing sites for categorization ===");
  logObject("totalSitesToProcess", sitesToProcess.length);

  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  const failedSites = [];
  const successfulSites = [];

  // Process sites in batches
  for (let i = 0; i < sitesToProcess.length; i += BATCH_SIZE) {
    // Check for shutdown signal
    if (global.isShuttingDown) {
      logText("Site categorization stopping due to application shutdown");
      break;
    }

    const batch = sitesToProcess.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(sitesToProcess.length / BATCH_SIZE);

    logText(
      `Processing batch ${batchNumber}/${totalBatches} (${batch.length} sites)`
    );

    // Process sites sequentially instead of concurrently
    for (let siteIndex = 0; siteIndex < batch.length; siteIndex++) {
      const site = batch[siteIndex];

      try {
        // Use retry logic for categorization
        const categorizedSite = await retryRequest(async () => {
          const response = await spatialApiClient.get(
            "/api/v2/spatial/categorize_site",
            {
              params: {
                latitude: site.latitude,
                longitude: site.longitude,
              },
            }
          );

          const osmInfo = response.data.site?.OSM_info;
          const siteCategoryInfo = response.data.site?.["site-category"];

          if (!siteCategoryInfo) {
            throw new Error("No site category info returned from spatial API");
          }

          const tags = extractTags(osmInfo);

          return {
            area_name: siteCategoryInfo.area_name || "Unknown",
            category: siteCategoryInfo.category || "Unknown",
            highway: siteCategoryInfo.highway || "Unknown",
            landuse: siteCategoryInfo.landuse || "Unknown",
            latitude: siteCategoryInfo.latitude || site.latitude,
            longitude: siteCategoryInfo.longitude || site.longitude,
            natural: siteCategoryInfo.natural || "Unknown",
            search_radius: siteCategoryInfo.search_radius || 0,
            waterway: siteCategoryInfo.waterway || "Unknown",
            tags,
          };
        });

        // Use retry logic for database updates
        await retryRequest(async () => {
          await SitesModel("airqo").updateOne(
            { _id: site._id },
            {
              $set: {
                site_category: categorizedSite,
                updated_at: new Date(),
              },
            }
          );
        });

        successfulSites.push({
          _id: site._id,
          name: site.name,
          latitude: site.latitude,
          longitude: site.longitude,
          category: categorizedSite.category,
          area_name: categorizedSite.area_name,
        });

        totalSuccessful++;
      } catch (error) {
        const errorReason = error.message.includes("Invalid header value char")
          ? `${error.message} (Header parsing issue)`
          : error.message;

        failedSites.push({
          _id: site._id,
          name: site.name,
          latitude: site.latitude,
          longitude: site.longitude,
          reason: errorReason,
        });

        totalFailed++;
        logger.error(
          `❌ Failed to categorize site ${site._id}: ${errorReason}`
        );
      }

      totalProcessed++;

      // Add delay between requests to be respectful to spatial API
      if (siteIndex < batch.length - 1) {
        await sleep(CATEGORIZATION_DELAY);
      }
    }

    // Progress logging
    const progressPercent = (
      (totalProcessed / sitesToProcess.length) *
      100
    ).toFixed(1);
    logText(
      `Batch ${batchNumber} complete. Overall progress: ${totalProcessed}/${sitesToProcess.length} (${progressPercent}%)`
    );

    // Add delay between batches
    if (i + BATCH_SIZE < sitesToProcess.length) {
      await sleep(BATCH_DELAY);
    }
  }

  // Final summary
  const successRate =
    totalProcessed > 0
      ? ((totalSuccessful / totalProcessed) * 100).toFixed(1)
      : 0;

  logText("=== CATEGORIZATION SUMMARY ===");
  logObject("totalProcessed", totalProcessed);
  logObject("totalSuccessful", totalSuccessful);
  logObject("totalFailed", totalFailed);
  logObject("successRate", `${successRate}%`);

  if (totalSuccessful > 0) {
    logText(`✅ Successfully categorized ${totalSuccessful} sites`);
  }

  if (totalFailed > 0) {
    logText(`❌ Failed to categorize ${totalFailed} sites`);
    logger.warn(`Failed sites: ${failedSites.map((s) => s._id).join(", ")}`);
  }

  return {
    processed: totalProcessed,
    successful: totalSuccessful,
    failed: totalFailed,
    successfulSites,
    failedSites,
  };
}

// Main job function with comprehensive configuration validation
const performSiteCategorization = async () => {
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

    // Validate required configuration before proceeding
    const configValidation = validateConfiguration();
    if (!configValidation.isValid) {
      const errorMessage = `🚫 Site categorization job skipped: Missing required configuration - ${configValidation.missingConfigs.join(
        ", "
      )}`;
      logText(errorMessage);
      logger.error(errorMessage);
      logger.error(
        `🔧 Please ensure the following environment variables/constants are set: ${configValidation.missingConfigs.join(
          ", "
        )}`
      );

      // Log specific instructions for missing configs
      if (configValidation.missingConfigs.includes("API_BASE_URL")) {
        logger.error(
          "💡 Set API_BASE_URL in your constants or environment variables"
        );
      }
      if (configValidation.missingConfigs.includes("API_TOKEN")) {
        logger.error(
          "💡 Set API_TOKEN in your environment variables or constants"
        );
      }

      return;
    }

    // Check if spatial API client was initialized successfully
    if (!spatialApiClient) {
      const errorMessage = `🚫 Site categorization job skipped: Spatial API client not initialized due to missing configuration`;
      logText(errorMessage);
      logger.error(errorMessage);
      return;
    }

    logText(
      `🚀 Starting site categorization job at ${startTime.format(
        "YYYY-MM-DD HH:mm:ss"
      )} EAT`
    );

    // Phase 1: Collect sites needing categorization
    const sitesToProcess = await collectSitesNeedingCategorization();

    // Phase 2: Process the collected sites
    const results = await processSitesForCategorization(sitesToProcess);

    const endTime = moment().tz(TIMEZONE);
    const duration = moment.duration(endTime.diff(startTime));

    logText(`✅ Site categorization job completed in ${duration.humanize()}`);
    logObject("jobResults", results);

    // Detailed final summary
    if (results.successful > 0) {
      logText(
        `🎉 Successfully categorized ${results.successful} sites during this run`
      );

      // Log some successful site details for monitoring
      results.successfulSites.slice(0, 5).forEach((site) => {
        logObject("successfulSite", {
          id: site._id,
          name: site.name,
          category: site.category,
          area: site.area_name,
        });
      });
    }

    if (results.failed > 0) {
      logText(`⚠️ Failed to categorize ${results.failed} sites`);

      // Log some failed site details for debugging
      results.failedSites.slice(0, 3).forEach((site) => {
        logObject("failedSite", {
          id: site._id,
          name: site.name,
          reason: site.reason,
        });
      });
    }
  } catch (error) {
    const errorMessage = `Site categorization job failed: ${error.message}`;
    logText(`🐛🐛 ${errorMessage}`);
    logger.error(`🐛🐛 ${errorMessage}`);
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);

    // Log error for monitoring
    logText(
      `💥 Site categorization job encountered an error and will retry on next schedule`
    );
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// Wrapper function for graceful shutdown handling
const jobWrapper = async () => {
  currentJobPromise = performSiteCategorization();
  await currentJobPromise;
};

// Create and start the cron job
const startSiteCategorizationJob = () => {
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
    logText("Site categorization job is now running every 5 hours...");

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

// Start the job with configuration validation
try {
  // Validate configuration on startup
  const configValidation = validateConfiguration();
  if (!configValidation.isValid) {
    logger.warn(
      `⚠️ ${JOB_NAME} started with missing configuration: ${configValidation.missingConfigs.join(
        ", "
      )}`
    );
    logger.warn("🔧 Job will skip execution until configuration is provided");

    // Still start the job but it will skip execution
    startSiteCategorizationJob();
    logText(
      `⚠️ ${JOB_NAME} initialization complete but will skip execution due to missing configuration`
    );
  } else {
    startSiteCategorizationJob();
    logText(`🎉 ${JOB_NAME} initialization complete with valid configuration`);
  }
} catch (error) {
  logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  process.exit(1);
}

// Export for testing or manual control
module.exports = {
  JOB_NAME,
  JOB_SCHEDULE,
  startSiteCategorizationJob,
  performSiteCategorization,
  collectSitesNeedingCategorization,
  processSitesForCategorization,
  validateConfiguration,
  stopJob: async () => {
    if (global.cronJobs && global.cronJobs[JOB_NAME]) {
      await global.cronJobs[JOB_NAME].stop();
    }
  },
};
