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

const JOB_NAME = "health-tip-checker-job";
const JOB_SCHEDULE = "0 */2 * * *"; // At minute 0 of every 2nd hour

// ============================================================================
// EXTRACTED BUSINESS LOGIC FUNCTIONS (Easily testable)
// ============================================================================

/**
 * Build a MongoDB filter for a specific AQI range
 * @param {Object} range - AQI range object with min and max properties
 * @returns {Object} MongoDB filter object
 */
function buildRangeFilter(range) {
  const filter = {
    "aqi_category.min": range.min,
  };

  // Handle null max values (for hazardous category: 301+)
  filter["aqi_category.max"] = range.max === null ? null : range.max;

  return filter;
}

/**
 * Find the category name for a given AQI range
 * @param {Object} range - AQI range object with min and max properties
 * @param {Object} aqiIndex - Constants AQI_INDEX object
 * @returns {string|null} Category name or null if not found
 */
function findCategoryName(range, aqiIndex = constants.AQI_INDEX) {
  const EPSILON = 0.001; // For floating point comparison

  return (
    Object.keys(aqiIndex).find((key) => {
      const indexRange = aqiIndex[key];

      // Compare min values
      const minMatches = Math.abs(indexRange.min - range.min) < EPSILON;

      // Compare max values (handling null cases)
      const maxMatches =
        (indexRange.max === null && range.max === null) ||
        (indexRange.max !== null &&
          range.max !== null &&
          Math.abs(indexRange.max - range.max) < EPSILON);

      return minMatches && maxMatches;
    }) || null
  );
}

/**
 * Check a single AQI range for health tip coverage
 * @param {Object} range - AQI range to check
 * @param {Function} healthTipModel - HealthTip model function
 * @param {string} tenant - Tenant identifier
 * @returns {Promise<Object|null>} Category info if no tips found, null otherwise
 */
async function checkSingleRangeForTips(range, healthTipModel, tenant) {
  const filter = buildRangeFilter(range);
  const count = await healthTipModel(tenant)
    .countDocuments(filter)
    .exec();

  if (count === 0) {
    const categoryName = findCategoryName(range);
    return {
      name: categoryName || "unknown",
      min: range.min,
      max: range.max,
    };
  }

  return null;
}

/**
 * Find all AQI categories without health tips
 * @param {Function} healthTipModel - HealthTip model function
 * @param {Array} validAqiRanges - Array of AQI range objects
 * @param {string} tenant - Tenant identifier
 * @returns {Promise<Array>} Array of categories without tips
 */
async function findCategoriesWithoutTips(
  healthTipModel,
  validAqiRanges,
  tenant
) {
  const categoriesWithoutTips = [];

  // Check each range in parallel for better performance
  const checkPromises = validAqiRanges.map((range) =>
    checkSingleRangeForTips(range, healthTipModel, tenant)
  );

  const results = await Promise.all(checkPromises);

  // Filter out null results and collect categories without tips
  results.forEach((result) => {
    if (result !== null) {
      categoriesWithoutTips.push(result);
    }
  });

  return categoriesWithoutTips;
}

/**
 * Format AQI range for display
 * @param {Object} category - Category object with min, max, and name
 * @returns {string} Formatted range description
 */
function formatAqiRange(category) {
  return category.max === null
    ? `${category.min}+`
    : `${category.min}-${category.max}`;
}

/**
 * Log health tip coverage results
 * @param {Array} categoriesWithoutTips - Array of categories missing tips
 */
function logCoverageResults(categoriesWithoutTips) {
  if (categoriesWithoutTips.length > 0) {
    // Log alerts for missing health tips
    const alertMessage = `⚠️ Health tip coverage alert: Found ${categoriesWithoutTips.length} AQI categories without health tips`;
    logText(alertMessage);
    logger.warn(alertMessage);

    categoriesWithoutTips.forEach((category) => {
      const rangeDesc = formatAqiRange(category);
      const categoryMsg = `🔍 Missing health tips for AQI category "${category.name}" (${rangeDesc})`;
      logText(categoryMsg);
      logger.warn(categoryMsg);
    });
  } else {
    const successMsg = "✅ All AQI categories have health tips";
    logText(successMsg);
  }
}

/**
 * Validate configuration before running checks
 * @returns {Object} Validation result with success flag and details
 */
function validateConfiguration() {
  const errors = [];

  if (!constants.AQI_INDEX) {
    errors.push("AQI_INDEX configuration is missing");
  }

  if (!constants.DEFAULT_TENANT) {
    errors.push("DEFAULT_TENANT configuration is missing");
  }

  const validAqiRanges = Object.values(constants.AQI_INDEX || {});
  if (validAqiRanges.length === 0) {
    errors.push("No valid AQI ranges found in configuration");
  }

  return {
    success: errors.length === 0,
    errors,
    validRanges: validAqiRanges,
  };
}

// ============================================================================
// MAIN EXECUTION FUNCTION (Orchestrates the above functions)
// ============================================================================

/**
 * Main function to check health tip coverage across all AQI categories
 * Now much simpler and focused on orchestration
 */
const checkHealthTipsCoverage = async () => {
  try {
    logText("Checking for AQI categories without health tips...");

    // Validate configuration first
    const validation = validateConfiguration();
    if (!validation.success) {
      const errorMsg = `🐛🐛 Configuration validation failed: ${validation.errors.join(
        ", "
      )}`;
      logText(errorMsg);
      logger.error(errorMsg);
      return;
    }

    const tenant = constants.DEFAULT_TENANT || "airqo";

    // Find categories without tips using extracted business logic
    const categoriesWithoutTips = await findCategoriesWithoutTips(
      HealthTipModel,
      validation.validRanges,
      tenant
    );

    // Log results using extracted logging function
    logCoverageResults(categoriesWithoutTips);

    // Return results for testing purposes
    return {
      success: true,
      categoriesWithoutTips,
      totalCategories: validation.validRanges.length,
    };
  } catch (error) {
    const errorMsg = `🐛🐛 Error checking health tip coverage: ${error.message}`;
    logText(errorMsg);
    logger.error(errorMsg);
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);

    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// JOB MANAGEMENT (Unchanged from original)
// ============================================================================

logText("Health tip coverage checker job is now running...");

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = checkHealthTipsCoverage();
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
    scheduled: true,
    timezone: TIMEZONE,
  });

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      logText(`🛑 Stopping ${JOB_NAME}...`);
      cronJobInstance.stop();
      logText(`📅 ${JOB_NAME} schedule stopped.`);
      if (currentJobPromise) {
        await currentJobPromise;
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
  return cronJobInstance;
};

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

// Export individual functions for unit testing
module.exports = {
  // Main functions
  checkHealthTipsCoverage,
  startJob,

  // Testable business logic functions
  buildRangeFilter,
  findCategoryName,
  checkSingleRangeForTips,
  findCategoriesWithoutTips,
  formatAqiRange,
  logCoverageResults,
  validateConfiguration,

  // Job configuration
  JOB_NAME,
  JOB_SCHEDULE,
};

// Only start the job if this file is run directly (not when imported for testing)
if (require.main === module) {
  // Start the job
  startJob();

  // Run initial check on startup
  checkHealthTipsCoverage();
}
