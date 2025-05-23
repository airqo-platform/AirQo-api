const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-duplicate-site-fields-job`
);
const SitesModel = require("@models/Site");
const cron = require("node-cron");
const { logObject, logText } = require("@utils/shared");

// Fields to check for duplicates - easily modifiable
const FIELDS_TO_CHECK = ["name", "search_name", "description"];

// Frequency configuration
const WARNING_FREQUENCY_HOURS = 6; // Change this value to adjust frequency

//job identification
const JOB_NAME = "check-duplicate-site-fields-job";
const JOB_SCHEDULE = `45 */${WARNING_FREQUENCY_HOURS} * * *`;

// Helper function to group sites by field value
const groupSitesByFieldValue = (sites, fieldName) => {
  return sites.reduce((acc, site) => {
    const fieldValue = site[fieldName];
    if (!fieldValue) return acc;

    if (!acc[fieldValue]) {
      acc[fieldValue] = [];
    }
    acc[fieldValue].push(site);
    return acc;
  }, {});
};

// Function to find duplicates for a specific field
const findDuplicatesForField = (groupedSites) => {
  return Object.entries(groupedSites)
    .filter(([_, sites]) => sites.length > 1)
    .map(([value, sites]) => ({
      value,
      sites: sites.map((site) => ({
        id: site._id,
        generated_name: site.generated_name,
      })),
    }));
};

// Main function to check for duplicate field values
const checkDuplicateSiteFields = async () => {
  try {
    // Get all active sites
    const fieldsToProject = FIELDS_TO_CHECK.concat([
      "_id",
      "generated_name",
    ]).join(" ");
    const sites = await SitesModel("airqo").find(
      { isOnline: true },
      fieldsToProject
    );

    logObject("Total sites checked", sites.length);

    const duplicateReport = {};

    // Check each field for duplicates
    for (const field of FIELDS_TO_CHECK) {
      const groupedSites = groupSitesByFieldValue(sites, field);
      const duplicates = findDuplicatesForField(groupedSites);

      if (duplicates.length > 0) {
        duplicateReport[field] = duplicates;
      }
    }

    // Log results if duplicates found
    if (Object.keys(duplicateReport).length > 0) {
      logText("⚠️ Duplicate site field values detected!");

      // Combine all warning messages into one descriptive message
      let combinedWarningMessage = "⚠️ Duplicates found in fields:";

      for (const [field, duplicates] of Object.entries(duplicateReport)) {
        combinedWarningMessage += `\n- Field: ${field}`;
        duplicates.forEach(({ value, sites }) => {
          const siteNames = sites.map((site) => site.generated_name).join(", ");
          combinedWarningMessage += `\n  Value "${value}" shared by sites: ${siteNames}`;
        });
      }
      logger.warn(combinedWarningMessage); // Log the combined message
    } else {
      logText("✅ No duplicate Site field values found");
      logger.info("✅ No duplicate Site field values found");
    }
  } catch (error) {
    const errorMessage = `🐛 Error checking duplicate site fields: ${error.message}`;
    logText(errorMessage);
    logger.error(errorMessage);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

// Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    checkDuplicateSiteFields,
    {
      scheduled: true,
    }
  );

  // Initialize global registry
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  // Register for cleanup 👇 USING cronJobInstance HERE!
  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      cronJobInstance.stop();
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

// Start the job
startJob();

// Export for testing or manual execution
module.exports = {
  checkDuplicateSiteFields,
  FIELDS_TO_CHECK,
};
