const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-duplicate-site-fields-job`
);
const SitesModel = require("@models/Site");
const cron = require("node-cron");
const { logText, logObject } = require("@utils/log");

// Fields to check for duplicates - easily modifiable
const FIELDS_TO_CHECK = ["name", "search_name", "description"];

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
    // const sites = await SitesModel("airqo").find({ isOnline: true });
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

      for (const [field, duplicates] of Object.entries(duplicateReport)) {
        logText(`\nField: ${field}`);
        logger.warn(`⚠️ Duplicates found in field: ${field}`);

        duplicates.forEach(({ value, sites }) => {
          const siteNames = sites.map((site) => site.generated_name).join(", ");
          const message = `⚠️ Value "${value}" shared by sites: ${siteNames}`;
          logText(message);
          logger.warn(message);
        });
      }
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

// Initial run message
logText("Duplicate site fields checker job is now running.....");
checkDuplicateSiteFields();
// Schedule the job to run every 2 hours at minute 45
const schedule = "45 */2 * * *";
cron.schedule(schedule, checkDuplicateSiteFields, {
  scheduled: true,
});

// Export for testing or manual execution
module.exports = {
  checkDuplicateSiteFields,
  FIELDS_TO_CHECK,
};
