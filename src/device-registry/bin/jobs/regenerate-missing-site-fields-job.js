const constants = require("@config/constants");
const cron = require("node-cron");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/regenerate-missing-site-fields-job`,
);
const SitesModel = require("@models/Site");
const { logText } = require("@utils/shared");
const { getSchedule } = require("@utils/common");
const createSite = require("@utils/site.util");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Fields whose absence (null / undefined / empty string) marks a site as
// needing regeneration. Any site missing at least one of these will be
// queued for a full refresh().
const REQUIRED_FIELDS = [
  "generated_name",
  "search_name",
  "description",
  "formatted_name",
  "location_name",
  "country",
  "district",
  "city",
  "region",
];

// How many sites to process per run. Kept deliberately small because each
// refresh() call hits the Google Maps Geocoding + Elevation APIs.
const BATCH_SIZE = 20;

// Milliseconds to wait between consecutive refresh() calls to avoid
// hammering external APIs.
const DELAY_BETWEEN_SITES_MS = 1500;

// Run once daily at 02:30 — well outside peak usage hours.
const JOB_NAME = "regenerate-missing-site-fields-job";
const JOB_SCHEDULE = getSchedule("30 2 * * *", constants.ENVIRONMENT);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the $match filter that selects sites with at least one missing
 * required field. Uses $or so that a site qualifies if *any* field is absent,
 * null, or empty string — not only if all are missing.
 *
 * @returns {Object} MongoDB $match filter object.
 */
const buildMissingFieldsFilter = () => {
  const orClauses = REQUIRED_FIELDS.map((field) => ({
    $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }],
  }));

  return { $or: orClauses };
};

/**
 * Pauses execution for a given number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Constructs a minimal req-shaped object that satisfies the signature
 * expected by createSite.refresh(req, next).
 *
 * @param {string} tenant
 * @param {string} siteId  — MongoDB ObjectId as string
 * @returns {Object}
 */
const buildRefreshRequest = (tenant, siteId) => ({
  query: { tenant, id: siteId },
  body: {},
});

/**
 * Identifies which required fields are missing on a given site document.
 * Used only for logging — the actual repair is delegated to refresh().
 *
 * @param {Object} site  — lean MongoDB document
 * @returns {string[]}   — array of field names that are missing
 */
const getMissingFields = (site) =>
  REQUIRED_FIELDS.filter(
    (field) =>
      site[field] === undefined || site[field] === null || site[field] === "",
  );

// ---------------------------------------------------------------------------
// Core job logic
// ---------------------------------------------------------------------------

/**
 * Fetches up to BATCH_SIZE sites that have at least one missing required
 * field, then calls createSite.refresh() for each one sequentially with a
 * short delay between calls to respect external API rate limits.
 *
 * Results are aggregated into a report that is logged at the end of each run.
 */
const regenerateMissingSiteFields = async () => {
  try {
    logText("Starting regenerate missing site fields process...");

    const filter = buildMissingFieldsFilter();

    // Fetch candidate sites — only the fields we need for identification and
    // logging; refresh() will re-fetch full details internally via list().
    const sites = await SitesModel("airqo")
      .find(filter)
      .select(
        "_id generated_name name search_name description formatted_name location_name country district city region",
      )
      .limit(BATCH_SIZE)
      .lean();

    if (!sites || sites.length === 0) {
      logText("✅ No sites with missing fields found — nothing to regenerate.");
      return;
    }

    logText(`Found ${sites.length} site(s) with missing fields. Processing...`);

    const report = {
      total: sites.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    for (const site of sites) {
      const siteId = site._id.toString();
      const siteName = site.generated_name || site.name || siteId;
      const missingFields = getMissingFields(site);

      logText(
        `Processing site ${siteName} — missing: [${missingFields.join(", ")}]`,
      );

      // Build a no-op next() for the util — errors are captured via the
      // return value of refresh() and logged below.
      let capturedError = null;
      const next = (err) => {
        capturedError = err;
      };

      try {
        const req = buildRefreshRequest("airqo", siteId);
        const response = await createSite.refresh(req, next);

        if (capturedError) {
          logger.error(
            `Failed to regenerate site ${siteName}: ${capturedError.message}`,
          );
          report.failed++;
          report.details.push({
            siteId,
            siteName,
            missingFields,
            status: "failed",
            reason: capturedError.message,
          });
        } else if (!response || response.success === false) {
          const reason =
            response?.errors?.message || response?.message || "unknown error";
          logger.error(`Failed to regenerate site ${siteName}: ${reason}`);
          report.failed++;
          report.details.push({
            siteId,
            siteName,
            missingFields,
            status: "failed",
            reason,
          });
        } else {
          logText(`✅ Successfully regenerated site ${siteName}`);
          report.succeeded++;
          report.details.push({
            siteId,
            siteName,
            missingFields,
            status: "succeeded",
          });
        }
      } catch (err) {
        logger.error(
          `Unexpected error regenerating site ${siteName}: ${err.message}`,
        );
        report.failed++;
        report.details.push({
          siteId,
          siteName,
          missingFields,
          status: "failed",
          reason: err.message,
        });
      }

      // Respect external API rate limits between sites.
      await sleep(DELAY_BETWEEN_SITES_MS);
    }

    // ---------------------------------------------------------------------------
    // Final report
    // ---------------------------------------------------------------------------
    logText("🔄 Regenerate missing site fields run complete!");

    let summary =
      `Results: ${report.succeeded} succeeded, ` +
      `${report.failed} failed, ` +
      `${report.skipped} skipped ` +
      `(out of ${report.total} candidate sites).`;

    logText(`✨ 🏥 🔧 📝 ${summary}`);

    if (report.failed > 0) {
      const failedNames = report.details
        .filter((d) => d.status === "failed")
        .map((d) => `  - ${d.siteName}: ${d.reason}`)
        .join("\n");
      logger.error(`🐛 Failed sites:\n${failedNames}`);
    }

    if (report.succeeded > 0) {
      const succeededNames = report.details
        .filter((d) => d.status === "succeeded")
        .map(
          (d) =>
            `  - ${d.siteName} (was missing: ${d.missingFields.join(", ")})`,
        )
        .join("\n");
      logText(`Healed sites:\n${succeededNames}`);
    }
  } catch (error) {
    const errorMessage = `🐛 Error in regenerate-missing-site-fields-job: ${error.message}`;
    logText(errorMessage);
    logger.error(errorMessage);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

// ---------------------------------------------------------------------------
// Job registration — mirrors update-duplicate-site-fields-job.js exactly
// ---------------------------------------------------------------------------

logText("Regenerate missing site fields job is now running.....");

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = regenerateMissingSiteFields();
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

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

// ---------------------------------------------------------------------------
// Exports — main function + helpers exposed for testing or manual execution
// ---------------------------------------------------------------------------
module.exports = {
  regenerateMissingSiteFields,
  REQUIRED_FIELDS,
  BATCH_SIZE,
  // Export helpers for testing
  buildMissingFieldsFilter,
  getMissingFields,
  buildRefreshRequest,
};
