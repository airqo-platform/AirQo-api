const constants = require("@config/constants");
const cron = require("node-cron");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/update-duplicate-site-fields-job`
);
const SitesModel = require("@models/Site");
const { logObject, logText } = require("@utils/shared");
const { getSchedule } = require("@utils/common");

// Fields to check and update duplicates
const FIELDS_TO_UPDATE = ["name", "search_name", "description"];

// Frequency configuration
const WARNING_FREQUENCY_HOURS = 4; // Change this value to adjust frequency

const JOB_NAME = "update-duplicate-site-fields-job";
const JOB_SCHEDULE = getSchedule(
  `15 */${WARNING_FREQUENCY_HOURS} * * *`,
  constants.ENVIRONMENT
);

// Helper function to extract site number from generated_name
const extractSiteNumber = (generated_name) => {
  const match = generated_name.match(/site_(\d+)/);
  return match ? match[1] : null;
};

// Function to generate unique field value using site number
const generateUniqueFieldValue = (originalValue, siteNumber) => {
  return `${originalValue} ${siteNumber}`;
};

// Function to update duplicate fields for a specific field
const updateDuplicatesForField = async (groupedSites, fieldName) => {
  const bulkOps = [];
  const updateLogs = new Set();

  for (const group of groupedSites) {
    const { sites, fieldValue } = group;
    if (sites && sites.length > 1) {
      // Sort sites by generated_name to ensure consistent numbering
      sites.sort((a, b) => a.generated_name.localeCompare(b.generated_name));

      // Update all sites except the first one (keep original for the first occurrence)
      for (let i = 1; i < sites.length; i++) {
        const site = sites[i];
        const siteNumber = extractSiteNumber(site.generated_name);

        if (siteNumber) {
          const newValue = generateUniqueFieldValue(
            group.fieldValue,
            siteNumber
          );
          bulkOps.push({
            updateOne: {
              filter: { _id: site._id },
              update: { $set: { [fieldName]: newValue } },
              upsert: false,
            },
          });
          updateLogs.add(
            `${site.generated_name}: ${fieldValue} -> ${newValue}`
          );
        }
      }
    }
  }
  if (bulkOps.length > 0) {
    try {
      const result = await SitesModel("airqo").bulkWrite(bulkOps, {
        ordered: false,
      });
      const updatedCount =
        (result && (result.modifiedCount ?? result.nModified)) || 0;
      return {
        field: fieldName,
        updatedCount,
        updates: Array.from(updateLogs),
      };
    } catch (error) {
      logger.error(`Error updating ${fieldName}: ${error.message}`);
      throw error;
    }
  }

  return null;
};

// Main function to update duplicate field values
const updateDuplicateSiteFields = async () => {
  try {
    logText("Starting duplicate site fields update process...");
    const updateReport = {
      totalUpdates: 0,
      fieldReports: [],
    };

    for (const field of FIELDS_TO_UPDATE) {
      logText(`Processing field: ${field}...`);

      // Use aggregation to find duplicates directly in the database
      const duplicateGroups = await SitesModel("airqo").aggregate([
        {
          $match: {
            isOnline: true,
            [field]: { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: `$${field}`,
            sites: {
              $push: { _id: "$_id", generated_name: "$generated_name" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
        { $project: { fieldValue: "$_id", sites: 1, _id: 0 } },
      ]);

      const updateResult = await updateDuplicatesForField(
        duplicateGroups,
        field
      );

      if (updateResult) {
        updateReport.totalUpdates += Number(updateResult.updatedCount || 0);
        updateReport.fieldReports.push(updateResult);
      }
    }

    // Log results
    if (updateReport.totalUpdates > 0) {
      logText("🔄 Site field updates completed!");
      let updateMessage = `Updated ${updateReport.totalUpdates} duplicate values:\n`;

      updateReport.fieldReports.forEach((report) => {
        updateMessage += `\nField: ${report.field} (${report.updatedCount} updates)`;
        report.updates.forEach((update) => {
          updateMessage += `\n  - ${update}`;
        });
      });

      logText(`✨ ✏️ 🆙 📝 🔄 ${updateMessage}`);
    } else {
      logText("✅ No duplicate fields requiring updates");
    }
  } catch (error) {
    const errorMessage = `🐛 Error updating duplicate site fields: ${error.message}`;
    logText(errorMessage);
    logger.error(errorMessage);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

// Initial run message
logText("Update duplicate site fields job is now running.....");
// Schedule the job to run every 4 hours at minute 15

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = updateDuplicateSiteFields();
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// 3. Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
    scheduled: true,
    timezone: constants.TIMEZONE,
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
};

startJob();

// Export for testing or manual execution
module.exports = {
  updateDuplicateSiteFields,
  FIELDS_TO_UPDATE,
  // Export helpers for testing
  extractSiteNumber,
  generateUniqueFieldValue,
};
